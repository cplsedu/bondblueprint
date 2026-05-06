require('dotenv').config();

const express     = require('express');
const Anthropic   = require('@anthropic-ai/sdk');
const rateLimit   = require('express-rate-limit');
const helmet      = require('helmet');
const stripe      = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path        = require('path');

const { upsertLead, updateLeadSituation, getLeadByEmail, createPurchase, completePurchase, markEmailSent, getPurchaseBySession, getAnalytics, getUnclaimedPurchasesForReminder, markReminderSent } = require('./lib/db');
const { sendBlueprintEmail, sendClaimReminderEmail } = require('./lib/email');
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
app.use('/api/v2/create-payment-intent', checkoutLimiter);

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

// ─── V2 TEST FLOW ─────────────────────────────────────────────────────────────

app.get('/v2', (req, res) => {
  res.sendFile(path.join(__dirname, 'v2/index.html'));
});

app.get('/v2/confirm', (req, res) => {
  res.sendFile(path.join(__dirname, 'v2/confirm.html'));
});

// ─── V2: CHECKOUT (email-only, quiz happens post-purchase) ───────────────────

app.post('/api/v2/checkout', checkoutLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    await upsertLead({ email });

    subscribeToConvertKit({
      email,
      tags: [process.env.CONVERTKIT_CHECKOUT_TAG_ID].filter(Boolean)
    }).catch(() => {});

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
        email: email.toLowerCase().trim(),
        flow:  'v2'
      },
      success_url:            `${origin}/v2/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:             `${origin}/v2`,
      allow_promotion_codes:  true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('V2 checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// ─── V2: DEBUG (temporary — remove after testing) ────────────────────────────

app.get('/api/v2/debug', async (req, res) => {
  const { pi } = req.query;
  if (!pi) return res.json({ error: 'Add ?pi=pi_xxx to the URL' });
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(pi);
    const purchase      = await getPurchaseBySession(pi);
    res.json({
      stripe: {
        id:       paymentIntent.id,
        status:   paymentIntent.status,
        amount:   paymentIntent.amount,
        metadata: paymentIntent.metadata,
        livemode: paymentIntent.livemode,
      },
      db: purchase ? {
        id:             purchase.id,
        status:         purchase.status,
        blueprint_data: purchase.blueprint_data,
        email:          purchase.email,
      } : null
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ─── V2: CONFIG (publishable key for Stripe.js) ──────────────────────────────

app.get('/api/v2/config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '' });
});

// ─── V2: CREATE PAYMENT INTENT (inline checkout) ─────────────────────────────

app.post('/api/v2/create-payment-intent', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  try {
    await upsertLead({ email });

    subscribeToConvertKit({
      email,
      tags: [process.env.CONVERTKIT_CHECKOUT_TAG_ID].filter(Boolean)
    }).catch(() => {});

    const paymentIntent = await stripe.paymentIntents.create({
      amount:        1900,
      currency:      'usd',
      receipt_email: email.toLowerCase().trim(),
      metadata:      { email: email.toLowerCase().trim(), flow: 'v2' },
      automatic_payment_methods: { enabled: true }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('V2 payment intent error:', err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// ─── V2: PURCHASE STATUS (polled by confirm page while waiting for webhook) ──

app.get('/api/v2/purchase-status', async (req, res) => {
  const { session_id, payment_intent_id } = req.query;
  const id = session_id || payment_intent_id;
  if (!id) return res.status(400).json({ error: 'session_id or payment_intent_id required' });

  try {
    let purchase = await getPurchaseBySession(id);

    // Fallback: if no DB record yet and this is a PaymentIntent ID,
    // verify directly with Stripe and process it now (handles slow/failed webhooks)
    if (!purchase && id.startsWith('pi_')) {
      try {
        const pi = await stripe.paymentIntents.retrieve(id);
        if (pi.status === 'succeeded' && pi.metadata?.flow === 'v2') {
          await processV2PaymentIntent(pi);
          purchase = await getPurchaseBySession(id);
        }
      } catch (stripeErr) {
        console.error('V2 Stripe fallback lookup failed:', stripeErr.message);
      }
    }

    if (!purchase) return res.json({ status: 'not_found' });

    if (purchase.blueprint_data?._pending === true) {
      return res.json({ status: 'quiz_ready', email: purchase.email });
    }
    return res.json({ status: 'quiz_done', email: purchase.email });
  } catch (err) {
    console.error('V2 status error:', err.message);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// ─── V2: SUBMIT QUIZ (one-time — generates blueprint and emails it) ───────────

app.post('/api/v2/submit-quiz', aiLimiter, async (req, res) => {
  const { sessionId, name, who, attachmentStyle, partnerStyle, situation, goal } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const purchase = await getPurchaseBySession(sessionId);
    if (!purchase)                            return res.status(404).json({ error: 'Purchase not found' });
    if (purchase.blueprint_data?._pending !== true) return res.status(409).json({ error: 'Quiz already submitted' });

    const email = purchase.email;

    // Save quiz data to the lead
    await upsertLead({
      email,
      name:            name || '',
      attachmentStyle: attachmentStyle || '',
      partnerStyle:    partnerStyle || '',
      quizData:        { who: who || 'my partner', goal: goal || '' },
      situation:       (situation || '').slice(0, 800)
    });

    // Lock the record immediately so double-submits are rejected
    await completePurchase({
      stripeSessionId: sessionId,
      paymentIntent:   purchase.stripe_payment_intent,
      blueprintData:   { _processing: true, flow: 'v2' }
    });

    // Respond to client now — blueprint generation happens async below
    res.json({ success: true });

    const theme = resolveTheme(attachmentStyle, partnerStyle);

    let blueprint;
    try {
      blueprint = await generateBlueprint({
        situation: (situation || '').slice(0, 700),
        who:       who || 'my partner',
        theme,
        goal:      goal || 'feel safe in love'
      });
    } catch (err) {
      console.error('V2 blueprint generation failed:', err.message);
      blueprint = buildFallbackBlueprint(attachmentStyle, partnerStyle);
    }

    await completePurchase({
      stripeSessionId: sessionId,
      paymentIntent:   purchase.stripe_payment_intent,
      blueprintData:   blueprint
    });

    let pdfBuffer;
    try {
      pdfBuffer = await generateBlueprintPdf(blueprint, {
        name:            name || '',
        attachmentStyle: formatStyle(attachmentStyle),
        partnerStyle:    formatStyle(partnerStyle)
      });
    } catch (err) {
      console.error('V2 PDF generation failed (will send without attachment):', err.message);
    }

    try {
      await sendBlueprintEmail({
        to:              email,
        name:            name || '',
        pdfBuffer,
        blueprintTitle:  blueprint.title,
        attachmentStyle: formatStyle(attachmentStyle),
        partnerStyle:    formatStyle(partnerStyle)
      });
      await markEmailSent(sessionId);
    } catch (err) {
      console.error('V2 email send failed:', err.message);
    }

    sendOwnerNotification({
      email,
      name:            name || '',
      attachmentStyle,
      partnerStyle,
      amountCents:     purchase.amount_cents,
      lead:            { situation, quiz_data: { who, goal } },
      pdfBuffer
    }).catch(() => {});

    removeTag({ email, tagId: process.env.CONVERTKIT_CHECKOUT_TAG_ID }).catch(() => {});
    tagSubscriber({ email, tagId: process.env.CONVERTKIT_PAID_TAG_ID }).catch(() => {});

    console.log(`✅ V2 blueprint delivered to ${email} (session ${sessionId})`);
  } catch (err) {
    console.error('V2 quiz submit error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Submission failed' });
  }
});

// ─── ACCOUNT / LEAD CAPTURE ──────────────────────────────────────────────────

app.post('/api/account', async (req, res) => {
  const { email, name, firstName, lastName, attachmentStyle, partnerStyle, quizData } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const lead = await upsertLead({ email, name, attachmentStyle, partnerStyle, quizData });

    // Add to ConvertKit and start abandoned cart sequence immediately.
    // We apply the checkout tag here (not just at checkout) so anyone who
    // enters their email — and doesn't buy — gets the full follow-up sequence.
    // The "paid" tag (applied on purchase) stops the sequence automatically.
    subscribeToConvertKit({
      email,
      name,
      firstName,
      lastName,
      tags: [
        process.env.CONVERTKIT_QUIZ_TAG_ID,     // marks as quiz lead
        process.env.CONVERTKIT_CHECKOUT_TAG_ID, // triggers abandoned cart sequence
      ].filter(Boolean)
    }).then(result => {
      if (!result) console.error(`[ConvertKit] Failed to subscribe ${email} — check CONVERTKIT_API_KEY and tag IDs in Railway`);
      else console.log(`[ConvertKit] Subscribed ${email} and queued abandoned cart sequence`);
    }).catch(err => {
      console.error(`[ConvertKit] Unexpected error for ${email}:`, err.message);
    });

    res.json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error('Account upsert error:', err.message);
    res.status(500).json({ error: 'Failed to save account' });
  }
});

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/admin/config', (req, res) => {
  const { key } = req.query;
  if (!key || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    phKey: process.env.POSTHOG_PERSONAL_KEY || '',
    phPid: process.env.POSTHOG_PROJECT_ID   || '',
  });
});

app.get('/api/admin/stats', async (req, res) => {
  const { key, from, to } = req.query;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to dates required' });
  }
  try {
    const stats = await getAnalytics({ from, to });
    res.json(stats);
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ─── ADMIN: BULK LEAD LOOKUP BY EMAIL (for funnel drilldown) ─────────────────

app.get('/api/admin/leads-by-email', async (req, res) => {
  const { key, emails } = req.query;
  if (!key || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  if (!emails) return res.status(400).json({ error: 'emails required' });

  const emailList = String(emails)
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@') && e.includes('.'))
    .slice(0, 50);

  if (!emailList.length) return res.json([]);

  try {
    const results = await Promise.all(emailList.map(email => getLeadByEmail(email).catch(() => null)));
    res.json(
      results
        .filter(Boolean)
        .map(l => ({
          email:           l.email,
          name:            l.name            || '',
          attachmentStyle: l.attachment_style || '',
          partnerStyle:    l.partner_style    || '',
          createdAt:       l.created_at,
        }))
    );
  } catch (err) {
    console.error('leads-by-email error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// ─── LEAD LOOKUP (returning users from cart emails) ──────────────────────────

app.get('/api/lead', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  try {
    const lead = await getLeadByEmail(email);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    // Only return what's needed for abandoned-cart quiz restoration.
    // Never expose situation text or raw quiz answers to the client.
    const qd = lead.quiz_data || {};
    res.json({
      email:           lead.email,
      name:            lead.name || '',
      attachmentStyle: lead.attachment_style || '',
      partnerStyle:    lead.partner_style || '',
      quizData: {
        myAnswers: qd.myAnswers || [],
        ptAnswers: qd.ptAnswers || [],
        theme:     qd.theme    || '',
        goal:      qd.goal     || ''
      }
    });
  } catch (err) {
    console.error('Lead lookup error:', err.message);
    res.status(500).json({ error: 'Lookup failed' });
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
    res.status(200).json({ received: true });
    processCompletedCheckout(session).catch(err => {
      console.error('Post-payment processing error:', err.message);
    });

  } else if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    res.status(200).json({ received: true });
    if (pi.metadata?.flow === 'v2') {
      processV2PaymentIntent(pi).catch(err => {
        console.error('V2 payment intent processing error:', err.message);
      });
    }

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
  const flow            = session.metadata?.flow || 'v1';

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

  // V2: record payment and wait for quiz submission before generating blueprint
  if (flow === 'v2') {
    await upsertLead({ email });
    await createPurchase({ email, stripeSessionId: sessionId, amountCents });
    await completePurchase({ stripeSessionId: sessionId, paymentIntent, blueprintData: { _pending: true, flow: 'v2' } });
    console.log(`✅ V2 payment recorded for ${email} (session ${sessionId}) — awaiting quiz`);
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

  // Generate PDF (non-fatal — email still sends if PDF fails)
  let pdfBuffer;
  try {
    pdfBuffer = await generateBlueprintPdf(blueprint, {
      name: name || lead?.name || '',
      attachmentStyle: formatStyle(attachmentStyle),
      partnerStyle:    formatStyle(partnerStyle)
    });
  } catch (err) {
    console.error('PDF generation failed (will send email without attachment):', err.message);
  }

  // Send email — always send even if PDF failed
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
  }

  // Notify owner (with PDF copy for records)
  sendOwnerNotification({ email, name: name || lead?.name || '', attachmentStyle, partnerStyle, amountCents, lead, pdfBuffer }).catch(() => {});

  // ConvertKit: remove from abandoned cart sequence, add "paid" tag
  removeTag({ email, tagId: process.env.CONVERTKIT_CHECKOUT_TAG_ID }).catch(() => {});
  tagSubscriber({ email, tagId: process.env.CONVERTKIT_PAID_TAG_ID }).catch(() => {});

  console.log(`✅ Blueprint delivered to ${email} (session ${sessionId})`);
}

async function processV2PaymentIntent(pi) {
  const email = pi.metadata?.email;
  const piId  = pi.id;

  if (!email) {
    console.error('V2 PI webhook: no email in metadata', piId);
    return;
  }

  const existing = await getPurchaseBySession(piId);
  if (existing?.status === 'completed') {
    console.log('V2 PI: already processed', piId);
    return;
  }

  await upsertLead({ email });
  await createPurchase({ email, stripeSessionId: piId, amountCents: pi.amount });
  await completePurchase({
    stripeSessionId: piId,
    paymentIntent:   piId,
    blueprintData:   { _pending: true, flow: 'v2' }
  });
  console.log(`✅ V2 payment intent recorded for ${email} (${piId}) — awaiting quiz`);
}

// ─── AI: BLUEPRINT GENERATION ─────────────────────────────────────────────────

async function generateBlueprint({ situation, who, theme, goal }) {
  const themeLabels = {
    pullaway:     'one partner pulling away / avoidant withdrawal',
    rollercoaster:'anxious-avoidant push-pull cycle',
    pip:          'persistent conflict / communication breakdown',
    secure:       'building deeper security together'
  };

  const SYSTEM = `You are writing a personal relationship guide. Make it specific, validating, and actionable. Every sentence should feel like it was written about THIS person, not a generic relationship type.

Write at a 5th grade reading level. Short sentences. Plain English. No jargon without immediate explanation.
Mirror their exact words back. Use phrases they used. Make them feel seen, not analyzed.
Never be clinical. Never be generic.
Never use em-dashes (— or &mdash;). Use commas or periods instead.

STRICT RULE — NO HALLUCINATION: Only reference events, behaviors, feelings, and details that the person explicitly wrote about in their situation text. If they did not mention pulling away, do not write about pulling away. If they did not mention a specific behavior, do not invent it. If their situation is brief or vague, write about what they DID say — do not fill in details they never provided. Every specific claim must trace back to their actual words.

STRICT RULE — USE THEIR EXACT LANGUAGE FOR PEOPLE: The person may be writing about a boyfriend, girlfriend, husband, wife, situationship, someone they are seeing, someone outside their relationship, or multiple people at once. Do not assume it is one person or a traditional partner. Refer to the people in their situation exactly the way they referred to them. If they said "he," use "he." If they named someone, use that name. If they mentioned two different people, keep them distinct. Never replace their words with generic labels like "your partner" if that is not what they wrote.

Return ONLY valid JSON. No markdown, no explanation, no code fences. Just the raw JSON object.`;

  const USER_PROMPT = `Here is someone's real situation. Read every word carefully. Then write their personal relationship guide.

THEIR SITUATION (their exact words):
"${situation.trim().slice(0, 700) || 'They did not provide specific details.'}"

CONTEXT:
- Who this is about: ${who}
- Main relationship pattern: ${themeLabels[theme] || theme}
- What they want most: ${goal}

IMPORTANT: Only reference what is in the situation text above. Do not invent behaviors they did not describe. If they did not mention something, leave it out. Write only about what they actually shared.

Return a JSON object with EXACTLY this structure (no extra fields, no missing fields):

{
  "title": "A title specific to their situation. Personal and vivid. Not product-sounding. Under 10 words.",
  "coverIntro": "2-3 sentences using their exact words as a mirror. Validating. Specific to what they wrote. No em-dashes.",
  "situationSummary": "3-4 sentences that name what is actually happening between these two people. Use their words as evidence. Plain English.",
  "cycleLeft": "The pursuing side: what that person does when disconnected. Active verbs. Under 12 words.",
  "cycleRight": "The withdrawing side: what that person does when overwhelmed. Active verbs. Under 12 words.",
  "understandingPartner": [
    "Paragraph 1: What is actually going on inside their partner. Name the nervous system response. Use their specific words as evidence. 2-3 sentences.",
    "Paragraph 2: Why this pattern exists for their partner. One research-grounded explanation in plain English. 2-3 sentences.",
    "Paragraph 3: What the partner actually needs that they cannot ask for. How knowing this changes the dynamic. 2-3 sentences."
  ],
  "partnerBehaviors": [
    { "behavior": "A specific behavior from their situation (under 8 words)", "translation": "What it actually means emotionally (under 15 words)", "move": "The one right response (under 12 words)" },
    { "behavior": "Second specific behavior", "translation": "What it means", "move": "Right response" },
    { "behavior": "Third behavior", "translation": "What it means", "move": "Right response" },
    { "behavior": "Fourth behavior", "translation": "What it means", "move": "Right response" }
  ],
  "scripts": [
    { "context": "When [specific trigger from their situation]", "theirMessage": "What their partner typically says or does (under 15 words)", "say": "Exact words to say. Calm. Non-blaming. Under 20 words.", "note": "Short note on tone or timing (under 10 words)", "why": "Why this exact wording works psychologically. 1 sentence." },
    { "context": "When [second specific trigger]", "theirMessage": "What partner says or does", "say": "What to say", "note": "Tone note", "why": "Why it works" },
    { "context": "When [third trigger]", "theirMessage": "Partner behavior", "say": "What to say", "note": "Tone note", "why": "Why it works" },
    { "context": "When [fourth trigger]", "theirMessage": "Partner behavior", "say": "What to say", "note": "Tone note", "why": "Why it works" },
    { "context": "When [fifth trigger]", "theirMessage": "Partner behavior", "say": "What to say", "note": "Tone note", "why": "Why it works" },
    { "context": "When [sixth trigger]", "theirMessage": "Partner behavior", "say": "What to say", "note": "Tone note", "why": "Why it works" },
    { "context": "When [seventh trigger]", "theirMessage": "Partner behavior", "say": "What to say", "note": "Tone note", "why": "Why it works" },
    { "context": "When [eighth trigger]", "theirMessage": "Partner behavior", "say": "What to say", "note": "Tone note", "why": "Why it works" }
  ],
  "inPersonScripts": [
    { "context": "A face-to-face moment from their situation", "say": "Exact words for in-person. Under 20 words.", "note": "Body language or delivery note" },
    { "context": "Second in-person moment", "say": "What to say", "note": "Delivery note" },
    { "context": "Third in-person moment", "say": "What to say", "note": "Delivery note" },
    { "context": "Fourth in-person moment", "say": "What to say", "note": "Delivery note" }
  ],
  "actions": [
    "Most important action this week. Specific to their situation. Start with a verb. Under 15 words.",
    "Second action, different type.",
    "A communication action tied to their pattern.",
    "An action for when the cycle triggers.",
    "An action for their own regulation.",
    "A longer-term action for building what they actually want."
  ],
  "avoid": [
    "Most important thing to stop. Specific to their situation. Start with Stop or Do not. Under 12 words.",
    "Second pattern to stop, different type.",
    "Something they probably do not realize is making it worse.",
    "A subtle one most people miss."
  ],
  "plan": [
    "Day 1: [specific action tied to their situation]",
    "Day 2: [specific action]",
    "Day 3: [specific action]",
    "Day 4: [specific action]",
    "Day 5: [specific action]",
    "Day 6: [specific action]",
    "Day 7: [reflection: what they now understand that they did not before]"
  ]
}`;

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4000,
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

async function sendOwnerNotification({ email, name, attachmentStyle, partnerStyle, amountCents, lead, pdfBuffer }) {
  const { sendOwnerNotificationEmail } = require('./lib/email');
  const amount  = amountCents ? `$${(amountCents / 100).toFixed(2)}` : 'unknown';
  const source  = lead?.quiz_data?.source || lead?.quiz_data?.ref || 'direct / unknown';
  const situation = (lead?.situation || '').slice(0, 300);
  await sendOwnerNotificationEmail({ email, name, attachmentStyle, partnerStyle, amount, source, situation, pdfBuffer });
}

function resolveTheme(myStyle, partnerStyle) {
  const s = (myStyle + partnerStyle).toLowerCase();
  if (s.includes('aa') && (s.includes('da') || s.includes('fa'))) return 'pullaway';
  if (s.includes('fa')) return 'rollercoaster';
  return 'pip';
}

function formatStyle(code) {
  const map = { AA:'Anxious', DA:'Dismissive-Avoidant', FA:'Fearful-Avoidant', SA:'Secure' };
  return map[code] || code;
}

function buildFallbackBlueprint(myStyle, partnerStyle) {
  return {
    title:             'Your Relationship Guide',
    coverIntro:        'You showed up. That matters. This guide was built from what you shared and what the research says about this exact pattern. You are not the problem. The cycle is.',
    situationSummary:  'The pattern between you is driven by differing attachment strategies, not a lack of love. Both of you are responding from nervous systems shaped long before this relationship. Neither of you is the problem. The cycle is.',
    cycleLeft:         'Seeks connection, reaches for closeness',
    cycleRight:        'Seeks distance, needs space to regulate',
    understandingPartner: [
      'Your partner\'s responses in conflict are driven by their nervous system, not by how much they care about you. Early attachment experiences create automatic responses to closeness and disconnection that run below conscious awareness.',
      'Research by John Bowlby shows that these patterns form in childhood and become the default template for adult relationships. Your partner is not choosing to respond this way. Their system is doing what it was trained to do.',
      'What they actually need, even if they cannot say it, is a partner who stays steady and does not escalate when things get hard. Calm, consistent responses over time are what shift the dynamic.'
    ],
    partnerBehaviors: [
      { behavior: 'Goes quiet during conflict',         translation: 'Overwhelmed and self-regulating, not abandoning you', move: 'One warm message. Then give space.' },
      { behavior: 'Says "I\'m fine" when they\'re not', translation: 'No language for feelings yet, or fears your reaction', move: 'Okay. I\'m here when you\'re ready.' },
      { behavior: 'Needs space after intensity',        translation: 'Their nervous system needs to reset, not rejection',   move: 'Give space without withdrawing warmth.' },
      { behavior: 'Returns warm after a hard moment',  translation: 'Regulated and missing connection. The bond is real.',  move: 'Welcome them back without punishment.' },
    ],
    scripts: [
      { context: 'When you feel the distance growing',           theirMessage: 'Silent, cold, or suddenly distant',             say: 'I notice I am feeling disconnected. Can we check in?',                        note: 'Calm voice. Not urgent.',      why: 'Names the feeling without blame, keeping them from going defensive.' },
      { context: 'When they pull away',                          theirMessage: 'Going quiet or pulling back',                   say: 'I am not going anywhere. Take the space you need.',                           note: 'Say it once. Then let it land.', why: 'Removes the threat of abandonment, which is what drives their withdrawal.' },
      { context: 'When the cycle starts again',                  theirMessage: 'Pattern beginning to repeat',                   say: 'I think our cycle just started. Can we pause?',                               note: 'Say it softly, not accusingly.', why: 'Naming the pattern out loud interrupts the automatic nervous system response.' },
      { context: 'When you need connection but they need space', theirMessage: 'Asking for space or going distant',             say: 'I need to feel close to you. What would work for both of us?',               note: 'Genuine question, not a demand.', why: 'Expresses need without demand, inviting collaboration instead of conflict.' },
      { context: 'When things feel good',                        theirMessage: 'Warm, present, connected',                     say: 'This feels really good. I want more of this between us.',                     note: 'Simple. Sincere.',              why: 'Reinforces positive connection and sets a shared intention without pressure.' },
      { context: 'When you feel triggered and want to spiral',   theirMessage: 'Late reply or brief response',                 say: 'I am feeling a little anxious. I am going to give myself an hour and then check in.', note: 'To yourself, not them.',   why: 'Interrupts the pursue-withdraw loop before it escalates.' },
      { context: 'When they come back after going cold',         theirMessage: 'Suddenly warm again',                         say: 'I am glad you are here.',                                                     note: 'Short and warm. No punishment.', why: 'Welcomes reconnection without reinforcing the cycle.' },
      { context: 'When you want to talk about the pattern',      theirMessage: 'A calm, neutral moment',                      say: 'I want to understand us better. Can we talk about what happens when we disconnect?', note: 'Not during conflict.',    why: 'Opens the meta-conversation from a place of curiosity, not blame.' },
    ],
    inPersonScripts: [
      { context: 'When they go quiet in person',          say: 'Hey. I notice you have gone quiet. I am here.',                                note: 'Sit close. Keep your voice soft.' },
      { context: 'When you need to slow a fight down',   say: 'I want to hear you. Can we slow down for a second?',                          note: 'Lower your voice. Make eye contact.' },
      { context: 'When you want to reconnect after conflict', say: 'I do not want to go to bed feeling distant from you.',                  note: 'Touch their arm. Mean it.' },
      { context: 'When closeness feels good',            say: 'This is what I want. Just this.',                                            note: 'No phones. Just presence.' },
    ],
    actions: [
      'Name the cycle out loud together once this week.',
      'Send one low-pressure message when you notice the urge to over-pursue.',
      'Ask one open question instead of making an assumption.',
      'Take a 20-minute walk alone when you feel triggered before responding.',
      'Write down what safety feels like to you. Not what your partner does, what YOU feel.',
      'Find one therapist who specializes in attachment for even one session together.'
    ],
    avoid: [
      'Stop pursuing harder when they go quiet. It accelerates withdrawal.',
      'Do not interpret silence as rejection before asking directly.',
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
    ]
  };
}

// ─── UNCLAIMED BLUEPRINT REMINDERS ────────────────────────────────────────────
// Runs every 30 min — sends 1hr and 7-day nudges to buyers who never finished the quiz

async function checkUnclaimedPurchases() {
  console.log('[Reminders] Checking for unclaimed blueprints...');
  try {
    const origin = process.env.APP_URL || 'https://bondblueprint.com';

    const [oneHrList, sevenDayList] = await Promise.all([
      getUnclaimedPurchasesForReminder('1hr').catch(() => []),
      getUnclaimedPurchasesForReminder('7d').catch(() => []),
    ]);

    for (const p of oneHrList) {
      try {
        await sendClaimReminderEmail({ to: p.email, piId: p.stripe_session_id, type: '1hr', origin });
        await markReminderSent(p.stripe_session_id, '1hr');
        console.log(`[Reminders] 1hr reminder sent -> ${p.email}`);
      } catch (err) {
        console.error(`[Reminders] 1hr failed for ${p.email}:`, err.message);
      }
    }

    for (const p of sevenDayList) {
      try {
        await sendClaimReminderEmail({ to: p.email, piId: p.stripe_session_id, type: '7d', origin });
        await markReminderSent(p.stripe_session_id, '7d');
        console.log(`[Reminders] 7d reminder sent -> ${p.email}`);
      } catch (err) {
        console.error(`[Reminders] 7d failed for ${p.email}:`, err.message);
      }
    }

    const total = oneHrList.length + sevenDayList.length;
    if (total === 0) console.log('[Reminders] None pending.');
    else console.log(`[Reminders] Sent ${total} reminder(s).`);
  } catch (err) {
    console.error('[Reminders] Check failed:', err.message);
  }
}

// Run every 30 minutes; also do a first pass 2 minutes after server start
setInterval(checkUnclaimedPurchases, 30 * 60 * 1000);
setTimeout(checkUnclaimedPurchases,   2 * 60 * 1000);

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅  BondBlueprint™ running at http://localhost:${PORT}`);
  console.log(`🤖  AI:     ${process.env.ANTHROPIC_API_KEY ? 'Connected' : 'MISSING ANTHROPIC_API_KEY'}`);
  console.log(`💳  Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Connected' : 'MISSING STRIPE_SECRET_KEY'}`);
  console.log(`🗄️   DB:     ${process.env.SUPABASE_URL ? 'Connected' : 'MISSING SUPABASE_URL'}`);
  console.log(`📧  Email:  ${process.env.RESEND_API_KEY ? 'Connected' : 'MISSING RESEND_API_KEY'}\n`);
});
