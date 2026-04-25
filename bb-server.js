require('dotenv').config();

const express     = require('express');
const Anthropic   = require('@anthropic-ai/sdk');
const rateLimit   = require('express-rate-limit');
const helmet      = require('helmet');
const stripe      = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path        = require('path');

const { upsertLead, updateLeadSituation, getLeadByEmail, createPurchase, completePurchase, markEmailSent, getPurchaseBySession } = require('./lib/db');
const { sendBlueprintEmail }    = require('./lib/email');
const { generateBlueprintPdf }  = require('./lib/pdf');
const { subscribeToConvertKit, tagSubscriber, removeTag } = require('./lib/marketing');

const app       = express();
const PORT      = process.env.PORT || 3000;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.set('trust proxy', 1);

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: { error: 'Too many requests. Please wait a moment.' }
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many checkout attempts. Please wait.' }
});

app.use('/api', apiLimiter);
app.use('/api/reflect', aiLimiter);
app.use('/api/chat', aiLimiter);
app.use('/api/generate-blueprint', aiLimiter);
app.use('/api/create-checkout', checkoutLimiter);

// Stripe webhook MUST receive raw body before JSON parser
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'bondblueprint-free.html'));
});

// ─── ACCOUNT / LEAD CAPTURE ──────────────────────────────────────────────────

app.post('/api/account', async (req, res) => {
  const { email, name, firstName, lastName, attachmentStyle, partnerStyle, quizData } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const lead = await upsertLead({ email, name, attachmentStyle, partnerStyle, quizData });

    subscribeToConvertKit({
      email,
      name,
      firstName,
      lastName,
      tags: [process.env.CONVERTKIT_QUIZ_TAG_ID].filter(Boolean)
    }).catch(() => {});

    res.json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error('Account upsert error:', err.message);
    res.status(500).json({ error: 'Failed to save account' });
  }
});

// ─── STRIPE CHECKOUT ──────────────────────────────────────────────────────────

app.post('/api/create-checkout', async (req, res) => {
  const { email, name, situation, attachmentStyle, partnerStyle } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const cleanSituation = (situation || '').trim().slice(0, 800);

  try {
    // Save situation description to the lead record before checkout
    await updateLeadSituation(email, cleanSituation);

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'payment',
      customer_email:       email.toLowerCase().trim(),
      line_items: [{
        price:    process.env.STRIPE_PRICE_ID,
        quantity: 1
      }],
      metadata: {
        email:            email.toLowerCase().trim(),
        name:             (name || '').slice(0, 100),
        attachment_style: attachmentStyle || '',
        partner_style:    partnerStyle || ''
      },
      success_url: `${origin}/?paid=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?paid=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto'
    });

    // Tag in ConvertKit as "viewed checkout" for abandoned cart sequence
    tagSubscriber({
      email,
      tagId: process.env.CONVERTKIT_CHECKOUT_TAG_ID
    }).catch(() => {});

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ─── STRIPE WEBHOOK ───────────────────────────────────────────────────────────

async function handleStripeWebhook(req, res) {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Acknowledge Stripe immediately
    res.status(200).json({ received: true });

    // Process async (non-blocking response already sent)
    processCompletedCheckout(session).catch(err => {
      console.error('Post-payment processing error:', err.message);
    });
  } else {
    res.status(200).json({ received: true });
  }
}

async function processCompletedCheckout(session) {
  const email           = session.metadata?.email || session.customer_email;
  const name            = session.metadata?.name || '';
  const attachmentStyle = session.metadata?.attachment_style || '';
  const partnerStyle    = session.metadata?.partner_style || '';
  const amountCents     = session.amount_total;
  const sessionId       = session.id;
  const paymentIntent   = session.payment_intent;

  if (!email) {
    console.error('Webhook: no email in session', session.id);
    return;
  }

  // Check for duplicate processing
  const existing = await getPurchaseBySession(sessionId);
  if (existing?.status === 'completed') {
    console.log('Webhook: session already processed', sessionId);
    return;
  }

  // Record the purchase
  await createPurchase({ email, stripeSessionId: sessionId, amountCents });

  // Get lead data (includes the situation they described)
  const lead = await getLeadByEmail(email);
  const situation = lead?.situation || '';
  const who       = lead?.quiz_data?.who || 'my partner';
  const theme     = lead?.quiz_data?.theme || resolveTheme(attachmentStyle, partnerStyle);
  const goal      = lead?.quiz_data?.goal || 'feel safe in love';

  // Generate blueprint with Claude
  let blueprint;
  try {
    blueprint = await generateBlueprint({ situation, who, theme, goal });
  } catch (err) {
    console.error('Blueprint generation failed:', err.message);
    blueprint = buildFallbackBlueprint(attachmentStyle, partnerStyle);
  }

  // Save blueprint and mark complete
  await completePurchase({ stripeSessionId: sessionId, paymentIntent, blueprintData: blueprint });

  // Generate PDF
  let pdfBuffer;
  try {
    pdfBuffer = await generateBlueprintPdf(blueprint, {
      name: name || lead?.name || '',
      attachmentStyle: formatStyle(attachmentStyle),
      partnerStyle:    formatStyle(partnerStyle)
    });
  } catch (err) {
    console.error('PDF generation failed:', err.message);
    return;
  }

  // Send email with PDF
  try {
    await sendBlueprintEmail({
      to:             email,
      name:           name || lead?.name || '',
      pdfBuffer,
      blueprintTitle: blueprint.title,
      attachmentStyle: formatStyle(attachmentStyle),
      partnerStyle:    formatStyle(partnerStyle)
    });
    await markEmailSent(sessionId);
  } catch (err) {
    console.error('Email send failed:', err.message);
    return;
  }

  // ConvertKit: remove from abandoned cart sequence, add "paid" tag
  removeTag({ email, tagId: process.env.CONVERTKIT_CHECKOUT_TAG_ID }).catch(() => {});
  tagSubscriber({ email, tagId: process.env.CONVERTKIT_PAID_TAG_ID }).catch(() => {});

  console.log(`✅ Blueprint delivered to ${email} (session ${sessionId})`);
}

// ─── AI: BLUEPRINT GENERATION ─────────────────────────────────────────────────

async function generateBlueprint({ situation, who, theme, goal }) {
  const themeLabels = {
    pullaway:     'one partner pulling away / avoidant withdrawal',
    rollercoaster:'anxious-avoidant push-pull cycle',
    pip:          'persistent conflict / communication breakdown',
    secure:       'building deeper security together'
  };

  const SYSTEM = `You are writing a personal relationship guide, not a report. Make it specific, validating, and actionable. The person reading this should feel like you wrote it about THEM, not about a generic relationship type.

Your job is three things only:
1. NAME the dynamic: what is actually happening between these two people, in their specific situation.
2. EXPLAIN what is happening: why this pattern exists, what each person is experiencing inside. Use their exact words as evidence.
3. GIVE ONE CLEAR NEXT MOVE: the single most important thing they can do. Not a list. One move.

Write at a 5th grade reading level. Short sentences. Plain English. No jargon without immediate explanation.
Mirror their exact words back to them. Use phrases they used. Make them feel seen, not analyzed.
Never be clinical. Never be generic. Every sentence should feel like it could only be written about THIS person.
Never use em-dashes (— or —). Use commas or periods instead.

Return ONLY valid JSON. No markdown, no explanation, no code fences. Just the raw JSON object.`;

  const USER_PROMPT = `Here is someone's real situation. Read every word carefully. Then write their personal relationship guide.

THEIR SITUATION (their exact words, these are the most important thing):
"${situation.trim().slice(0, 700) || 'They did not provide specific details.'}"

CONTEXT:
- Who this is about: ${who}
- Main relationship pattern: ${themeLabels[theme] || theme}
- What they want most: ${goal}

Return a JSON object with EXACTLY this structure:

{
  "title": "A title specific to their situation, personal and vivid, not product-sounding. Under 10 words.",
  "situationBreakdown": [
    { "theyWrote": "a specific phrase or moment from their words (under 15 words)", "whatItMeans": "what that reveals about the dynamic, name it plainly. 1-2 sentences." },
    { "theyWrote": "a second specific phrase from their words", "whatItMeans": "go deeper, name the feeling underneath" },
    { "theyWrote": "a third phrase that shows the pattern clearly", "whatItMeans": "connect it to the bigger cycle" }
  ],
  "whatHappening": [
    "Paragraph 1: State clearly what is happening between these two people. Use their words as evidence. 2-3 sentences.",
    "Paragraph 2: Why does this pattern exist? Name one researcher and explain their finding in one plain sentence. 2-3 sentences.",
    "Paragraph 3: What does each person do that accidentally makes the cycle worse? 2-3 sentences."
  ],
  "keyInsight": "The one thing they most need to hear. Specific to their situation. 1-2 sentences.",
  "scienceCite": "One specific researcher + year + finding that directly explains the keyInsight (1 plain sentence, no jargon)",
  "cycleLeft": "The pursuing side: what that person does when they feel disconnected. Active verbs. Under 12 words.",
  "cycleRight": "The withdrawing side: what that person does when overwhelmed. Active verbs. Under 12 words.",
  "scripts": [
    { "context": "When [specific trigger from their situation]", "say": "Exact words — calm, non-blaming, direct. Under 20 words.", "why": "One sentence on why this exact wording works psychologically." },
    { "context": "When [a second specific moment from their situation]", "say": "Exact words", "why": "Why it works" },
    { "context": "When the pattern starts again", "say": "Exact words that interrupt the cycle", "why": "Why it works" },
    { "context": "When they need space but do not want to lose connection", "say": "Exact words", "why": "Why it works" },
    { "context": "When things feel good and they want it to last", "say": "Exact words", "why": "Why it works" }
  ],
  "actions": [
    "The single most important action this week. Specific to their situation. Start with a verb. Under 15 words.",
    "A second action, different type.",
    "A communication action tied to their exact pattern.",
    "An action for when the cycle triggers.",
    "An action for their own regulation, not about the other person.",
    "A longer-term action for building what they actually want."
  ],
  "avoid": [
    "The most important thing to stop doing, tied to their situation. Start with Stop or Do not. Under 12 words.",
    "A second pattern to stop, different type.",
    "Something they probably do not realize is making it worse.",
    "A subtle one they miss."
  ],
  "plan": [
    "Day 1: [specific action tied to their situation]",
    "Day 2: [specific action]",
    "Day 3: [specific action]",
    "Day 4: [specific action]",
    "Day 5: [specific action]",
    "Day 6: [specific action]",
    "Day 7: [reflection: what they now understand that they did not before]"
  ],
  "citations": [
    "Researcher name + one finding that explains something specific about their situation (1 plain sentence)",
    "Second researcher + finding relevant to their dynamic",
    "Third researcher + finding"
  ]
}`;

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2800,
    system:     SYSTEM,
    messages:   [{ role: 'user', content: USER_PROMPT }]
  });

  const raw     = message.content[0]?.text?.trim() || '';
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

// ─── AI: REFLECTION (free results page) ──────────────────────────────────────

app.post('/api/reflect', async (req, res) => {
  const { style, relationship, situation, pain, description, want, otherStyle } = req.body;

  const styleLabels = { secure:'Secure', anxious:'Anxious', avoidant:'Avoidant', fearful:'Fearful-Avoidant' };
  const relLabels   = { romantic:'a romantic relationship', dating:'someone they\'re dating', friendship:'a close friendship', self:'their relationships in general' };
  const sitLabels   = {
    always_anxious:'in something good but always anxious', pulling_away:'sensing their partner pulling away',
    post_breakup:'post-breakup', scared_to_try:'scared to date again',
    sabotage:'keeps sabotaging good relationships', suffocated:'feeling suffocated and lonely at once',
    push_regret:'pushes people away then regrets it', commitment:'commitment feels like a trap',
    hot_cold:'going hot and cold', wrong_people:'attracting the wrong people',
    self_sabotage:'self-sabotaging when things go well', trust:'unable to trust even safe people',
    insecure_partner:'has an insecure partner', deepen:'wants to deepen a good relationship',
    past_patterns:'wants to understand past patterns', general:'wants to keep growing'
  };
  const wantLabels = {
    stop_cycle:'stop the same pattern repeating', feel_safe:'feel secure in love',
    communicate:'communicate better', attract_better:'attract healthier partners', heal:'heal the root cause'
  };

  const SYSTEM = `You are a science-based relationship education tool. You help people understand what peer-reviewed attachment science might suggest about their specific situation. You are NOT a therapist, counselor, or mental health professional.

CRITICAL RULES:
1. NEVER diagnose. Don't say "you have X disorder" or "you are X type" definitively.
2. NEVER prescribe. Use "research suggests," "some people find," "one approach worth exploring."
3. ALWAYS hedge outcomes with "this may," "research suggests," "some people in similar situations."
4. ALWAYS recommend professional support at some point.
5. Reference specific peer-reviewed research by name (Bowlby, Ainsworth, Hazan & Shaver, Levine & Heller, Gottman, Johnson, Mikulincer & Shaver).
6. Keep tone warm, curious, and non-judgmental.
7. This is educational psychoeducation content only.`;

  const USER_PROMPT = `Write a genuinely personalized reflection for this person. Not generic advice — a direct response to what THIS person described.

— Their attachment style (quiz result): ${styleLabels[style] || style}
— Relationship type: ${relLabels[relationship] || relationship}
— Current situation: ${sitLabels[situation] || situation}
— Biggest pain point: ${pain}
— The other person's style: ${otherStyle && otherStyle !== 'unknown' ? styleLabels[otherStyle] : 'unknown/unsure'}
— What they want most: ${wantLabels[want] || want}
— Their exact words: "${description && description.trim().length > 5 ? description.trim() : '[They did not provide details]'}"

Write 4 paragraphs (plain text, no markdown headers or bullets):
1. Reflection: Acknowledge specifically what they described. Make them feel heard.
2. What research suggests: Connect to attachment science. Cite 1-2 specific researchers. Frame as "research suggests."
3. Possibilities worth exploring: 2-3 specific approaches. Hedged language. Specific to their situation.
4. Closing: Validate their awareness. Mention that a licensed therapist provides deeper support. Warm, not scary.`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1200,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: USER_PROMPT }]
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    res.json({ reflection: text });
  } catch (err) {
    console.error('Reflect API error:', err.message);
    res.status(500).json({ error: err.message, fallback: true });
  }
});

// ─── AI: CHAT ─────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages = [], context = {}, situation = '' } = req.body;

  const relLabels  = { romantic:'romantic partner', dating:'person they\'re dating', friendship:'close friend', self:'general self-reflection' };
  const wantLabels = { understand:'understand what\'s happening', say:'figure out what to say', feel:'feel less alone', decide:'decide what to do' };
  const isFirst    = messages.length <= 1;

  const SYSTEM = `You are a warm, science-based relationship guide powered by peer-reviewed attachment research. Educational and psychoeducational support only — not therapy, counseling, or clinical advice.

LANGUAGE AND TONE:
- Write at an 8th grade reading level. Short sentences. Plain English.
- Sound like a smart, warm friend who knows the science.
- Never use em-dashes (— or –). Use commas or periods instead.
- Never use bullet points or numbered lists. Write in paragraphs only.
- Never say "you should" or "you need to."
- Never promise outcomes.
- Do not repeat what you said in a previous message.

${isFirst ? `FIRST RESPONSE (5 paragraphs exactly, 350-500 words):
1. Echo something specific from what they described. Make them feel heard.
2. Name a specific researcher and finding. Explain it in plain English immediately.
3. A second distinct research insight with another name/citation.
4. A reflective angle tied to their specific words.
5. One follow-up question. One sentence reminding them this is educational content.` : `FOLLOW-UP (2-4 short paragraphs, 100-250 words): Acknowledge what they said, offer one research-based reflection, end with one follow-up question.`}`;

  const contextNote = [
    situation ? `Their opening situation: "${situation.substring(0, 200)}"` : '',
    context.rel  ? `Relationship type: ${relLabels[context.rel] || context.rel}` : '',
    context.want ? `What they want most: ${wantLabels[context.want] || context.want}` : ''
  ].filter(Boolean).join('\n');

  const claudeMessages = [];
  if (contextNote) {
    claudeMessages.push({ role: 'user', content: `[Session context]\n${contextNote}` });
    claudeMessages.push({ role: 'assistant', content: 'Understood. I have this context and will keep it in mind.' });
  }
  messages.forEach(m => {
    claudeMessages.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content });
  });

  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: isFirst ? 900 : 600,
      system:     SYSTEM,
      messages:   claudeMessages
    });
    const reply = response.content[0]?.text || '';
    res.json({ reply: reply.replace(/—/g, ',').replace(/–/g, ',').replace(/ -- /g, ', ') });
  } catch (err) {
    console.error('Chat API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI: GENERATE BLUEPRINT (preview endpoint, free) ─────────────────────────

app.post('/api/generate-blueprint', async (req, res) => {
  const { situation = '', who = 'my partner', theme = 'pullaway', goal = 'feel safe in love' } = req.body;

  try {
    const blueprint = await generateBlueprint({ situation, who, theme, goal });
    res.json({ blueprint });
  } catch (err) {
    console.error('Blueprint API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

// ─── TEST ENDPOINT (remove after go-live) ────────────────────────────────────
// Hit: GET /api/test-flow?email=you@example.com
// Generates a real blueprint with Claude, renders a PDF, and emails it to you.

app.get('/api/test-flow', async (req, res) => {
  const email = req.query.email;
  if (!email || !email.includes('@')) {
    return res.status(400).send('Add ?email=your@email.com to the URL');
  }

  try {
    res.write('Starting test...\n');

    // 1. Generate blueprint with Claude
    res.write('Calling Claude to generate blueprint...\n');
    const blueprint = await generateBlueprint({
      situation: "We have been together for two years. When things feel close and connected, she suddenly goes cold and distant for days without explanation. I reach out and she says nothing is wrong but pulls further away. I end up feeling desperate and clingy, which I hate. When I give her space she comes back warm and loving, but I never know how long it will last. I am exhausted from the cycle and do not know if I am the problem.",
      who: 'my partner',
      theme: 'pullaway',
      goal: 'feel safe in love'
    });
    res.write(`Blueprint generated: "${blueprint.title}"\n`);

    // 2. Render PDF
    res.write('Rendering PDF...\n');
    const pdfBuffer = await generateBlueprintPdf(blueprint, {
      name: 'Ashley',
      attachmentStyle: 'Anxious',
      partnerStyle: 'Avoidant'
    });
    res.write(`PDF rendered: ${Math.round(pdfBuffer.length / 1024)}KB\n`);

    // 3. Send email
    res.write(`Sending email to ${email}...\n`);
    await sendBlueprintEmail({
      to: email,
      name: 'Ashley',
      pdfBuffer,
      blueprintTitle: blueprint.title,
      attachmentStyle: 'Anxious',
      partnerStyle: 'Avoidant'
    });

    res.end(`\n✅ SUCCESS — Check ${email} for your test blueprint PDF.\nTitle: "${blueprint.title}"`);
  } catch (err) {
    res.end(`\n❌ ERROR: ${err.message}`);
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok:     true,
    ai:     !!process.env.ANTHROPIC_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    db:     !!process.env.SUPABASE_URL,
    email:  !!process.env.RESEND_API_KEY
  });
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function resolveTheme(myStyle, partnerStyle) {
  const s = (myStyle + partnerStyle).toLowerCase();
  if (s.includes('aa') && (s.includes('da') || s.includes('fa'))) return 'pullaway';
  if (s.includes('fa')) return 'rollercoaster';
  return 'pip';
}

function formatStyle(code) {
  const map = { AA:'Anxious', DA:'Avoidant', FA:'Fearful-Avoidant', SA:'Secure' };
  return map[code] || code;
}

function buildFallbackBlueprint(myStyle, partnerStyle) {
  return {
    title:              'Your Relationship Guide',
    situationBreakdown: [
      { theyWrote: 'the pattern that keeps repeating',   whatItMeans: 'This recurring dynamic reflects the nervous system responses each person learned in early attachment relationships.' },
      { theyWrote: 'feeling disconnected',               whatItMeans: 'Disconnection activates the attachment system, which drives the pursuit-withdrawal cycle.' },
      { theyWrote: 'wanting things to be different',     whatItMeans: 'Awareness of the pattern is the first and most important step toward changing it.' }
    ],
    whatHappening: [
      'The pattern between you is driven by differing attachment strategies, not a lack of love or effort.',
      'Research by John Bowlby shows that early attachment experiences shape how we respond to intimacy and perceived rejection throughout life.',
      "Each person's response to threat inadvertently triggers the other's fear, creating a self-reinforcing cycle."
    ],
    keyInsight:   'The cycle is not about you. It is two nervous systems responding to fear in the only ways they know.',
    scienceCite:  'Bowlby (1969): early attachment bonds become internal working models that shape how we respond to intimacy and perceived threat as adults.',
    cycleLeft:    'Reaches out, texts more, seeks reassurance',
    cycleRight:   'Goes quiet, needs space, pulls back',
    scripts: [
      { context: 'When you feel the distance growing',          say: 'I notice I am feeling disconnected. Can we check in for a few minutes?',        why: 'Names the feeling without blame, which keeps the partner from going defensive.' },
      { context: 'When they pull away',                         say: 'I am not going anywhere. Take the space you need. I will be here.',              why: 'Breaks the pursue-withdraw loop by removing the threat of abandonment.' },
      { context: 'When the pattern starts',                     say: 'I think our cycle just started. Can we pause?',                                  why: 'Naming the pattern out loud interrupts automatic nervous system responses.' },
      { context: 'When you need connection but they need space', say: 'I need to feel close to you. What would work for both of us right now?',        why: 'Expresses need without demand, inviting collaboration instead of conflict.' },
      { context: 'When things feel good',                       say: 'This feels really good. I want more of this between us.',                        why: 'Reinforces positive connection and sets a shared intention without pressure.' }
    ],
    actions: [
      'Name the cycle out loud together once this week.',
      'Send one low-pressure message when you notice the urge to over-pursue.',
      'Ask one open question instead of making an assumption.',
      'Take a 20-minute walk alone when you feel triggered before responding.',
      'Write down what safety feels like to you. Not what your partner does, but what YOU feel.',
      'Find one therapist who specializes in attachment to book even one session together.'
    ],
    avoid: [
      'Stop pursuing harder when they go quiet. It accelerates withdrawal.',
      'Do not interpret silence as rejection before asking.',
      'Stop apologizing for having needs. They are valid.',
      'Do not have the big conversations when either of you is flooded or overwhelmed.'
    ],
    plan: [
      'Day 1: Read this blueprint from start to finish. Underline one thing that resonates.',
      'Day 2: Use one of the scripts in a low-stakes moment.',
      'Day 3: Write down the last time the cycle happened. What triggered it?',
      'Day 4: Do one thing today that is purely for your own regulation.',
      'Day 5: Have a 10-minute check-in. No phones, no problem-solving. Just connect.',
      'Day 6: Notice when the cycle starts and name it out loud instead of following it.',
      'Day 7: Reflect: What is one thing you understand now that you did not before?'
    ],
    citations: [
      'John Bowlby: our earliest relationships create internal working models that shape how we seek closeness as adults.',
      'Stan Tatkin: partners co-regulate each other\'s nervous systems, making the relationship itself the healing environment.',
      'Sue Johnson: the antidote to the pursue-withdraw cycle is accessible, responsive emotional engagement.'
    ]
  };
}

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅  BondBlueprint™ running at http://localhost:${PORT}`);
  console.log(`🤖  AI:     ${process.env.ANTHROPIC_API_KEY ? 'Connected' : 'MISSING ANTHROPIC_API_KEY'}`);
  console.log(`💳  Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Connected' : 'MISSING STRIPE_SECRET_KEY'}`);
  console.log(`🗄️   DB:     ${process.env.SUPABASE_URL ? 'Connected' : 'MISSING SUPABASE_URL'}`);
  console.log(`📧  Email:  ${process.env.RESEND_API_KEY ? 'Connected' : 'MISSING RESEND_API_KEY'}\n`);
});
