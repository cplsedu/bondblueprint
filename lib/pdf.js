const puppeteer = require('puppeteer');

// ── Quadrant positions (x%, y%) — x: anxiety (left=low, right=high), y: avoidance (top=high, bottom=low)
const QUADRANT_POS = {
  'Dismissive-Avoidant': { x: 27, y: 27 },   // low anxiety, high avoidance  → top-left
  'Fearful-Avoidant':    { x: 73, y: 27 },   // high anxiety, high avoidance → top-right
  'Secure':              { x: 27, y: 73 },   // low anxiety, low avoidance   → bottom-left
  'Anxious':             { x: 73, y: 73 },   // high anxiety, low avoidance  → bottom-right
};

// ── Style card data ──────────────────────────────────────────────────────────
const STYLE_INFO = {
  'Anxious': {
    color: '#E07A3A', light: '#FDF0E6', border: '#F0C0A0', ac: 'ac-rose',
    pct: '~20%', tagline: 'Craves closeness. Worries it won\'t last.',
    desc: 'When you feel disconnected, your nervous system sounds the alarm, fast. You reach out more, check in, and try to fix it. This isn\'t neediness. It\'s your attachment system doing exactly what it was built to do. The goal is to learn to calm the alarm before you act on it.',
  },
  'Fearful-Avoidant': {
    color: '#D4A843', light: '#E6F0E9', border: '#B8C8A0', ac: 'ac-violet',
    pct: '~5–10%', tagline: 'Wants closeness. Also afraid of it.',
    desc: 'You can feel pulled toward someone and pushed away at the same time. That\'s not confusion, that\'s two attachment systems running at once. You learned that closeness can be dangerous, so part of you wants it badly and part of you protects against it.',
  },
  'Secure': {
    color: '#4A7A5A', light: '#FBF5E6', border: '#9CC49C', ac: 'ac-teal',
    pct: '~50%', tagline: 'Comfortable with both closeness and independence.',
    desc: 'You\'re able to ask for what you need without panic, and give space without fear. Security isn\'t the absence of fear, it\'s knowing how to handle it. This is the direction everyone is moving toward, and you can build it even if you weren\'t born into it.',
  },
  'Dismissive-Avoidant': {
    color: '#2C4A35', light: '#E8EEE9', border: '#9CB89C', ac: 'ac-navy',
    pct: '~25%', tagline: 'Values independence. Pulls back when things get close.',
    desc: 'When emotional demands feel high, your instinct is to step back and create space. This isn\'t coldness, it\'s how you learned to cope. Closeness can feel overwhelming or suffocating, even with someone you genuinely care about. Understanding this changes how the dynamic plays out.',
  },
};

// ── Static content: Protest Behaviors ───────────────────────────────────────
const PROTEST_BEHAVIORS = [
  {
    num: '1', color: '#E07A3A', title: 'Pursuit Escalation',
    body: 'The double text. The "are we okay?" follow-up. The long message explaining how their silence makes you feel. Each one feels necessary. To someone who pulls back, they register as pressure, and pressure triggers more distance, not less.',
    rule: 'The rule: One message. Then you wait. The urgency you feel is a chemical state, not a deadline.',
  },
  {
    num: '2', color: '#E07A3A', title: 'The Anger Protest',
    body: 'Picking a fight about something small when the real issue is disconnection. The anger is real, but the target is usually a stand-in for "I need you to acknowledge I exist." Any response, even a bad one, feels better than silence. But it confirms to them that closeness is dangerous.',
    rule: 'The rule: Name what\'s actually happening. "I felt disconnected and it scared me" lands differently than a fight about plans.',
  },
  {
    num: '3', color: '#E07A3A', title: 'Going Cold Yourself',
    body: 'Disappearing for a few days to see if they reach out. It feels like taking back control, but it\'s still protest, you\'re trying to trigger their fear of losing you. The problem is they often feel relief when the pressure lifts, which makes the silence even more painful for you.',
    rule: 'The rule: Going cold to get a reaction is still the attachment system in protest mode. It rarely produces what you actually want.',
  },
  {
    num: '4', color: '#E07A3A', title: 'The Ultimatum That Isn\'t Real',
    body: '"Maybe we should just end this." Said not because you mean it, but because you need them to say they don\'t want that. To someone who shuts down, a threat to leave, even an unmeant one, is a reason to start preparing for exactly that.',
    rule: 'The rule: Only say things you mean. Fake ultimatums erode trust on both sides.',
  },
  {
    num: '5', color: '#E07A3A', title: 'Erasing Yourself to Not Trigger Them',
    body: 'You stop having needs. You agree to things that don\'t work for you. You make yourself smaller, hoping that if you stop triggering the pull-away, they\'ll finally stay. This doesn\'t create security. It creates resentment, and a version of you that\'s increasingly invisible.',
    rule: 'The rule: Shrinking yourself isn\'t the same as being secure. You cannot earn consistent love by making yourself easier to leave.',
  },
];

// ── Standard Setter — per partner style ─────────────────────────────────────
const STANDARD_SETTER = {
  'Dismissive-Avoidant': {
    callout: 'Using these scripts and staying regulated will often prompt them to re-engage. The calm, non-chasing energy lowers a dismissive avoidant\'s defenses — it removes the pressure that triggers their withdrawal. But re-engagement is not the goal. It is information. What they actually do when the pressure is off tells you everything.',
    script: '"I genuinely care about this and I want to keep showing up. But I need to feel like you\'re actually in this with me — not just when it\'s convenient. I\'m not asking you to be a different person. I\'m asking for some emotional follow-through. Is that something you can work toward?"',
    explain: 'You are naming a specific need without attacking their character. You are not asking them to become anxious or emotionally intense. You are asking whether they can show up even a little more. Watch what they do next, not just what they say in this moment.',
    badTitle: 'They Keep Pulling Back',
    badText: 'That is your answer. Not a maybe. A dismissive avoidant who is willing to grow will show it in their behavior over time. You are not asking too much.',
  },
  'Fearful-Avoidant': {
    callout: 'Using these scripts and keeping your cool will often make them come back. The calm, unbothered, not-chasing energy actually lowers a fearful avoidant\'s defenses. It works. But them coming back is not the goal. It is information. What they do when they re-enter — whether the warmth is consistent or the cold returns — tells you almost everything.',
    script: '"I genuinely like spending time with you, and I want to see where this goes. But I need consistency to feel safe. The hot and cold is hard on me. I\'m not asking for perfection, just honesty and follow-through. Is that something you can do right now?"',
    explain: 'You are naming a need without attacking them. You are asking about their capacity with real curiosity, not as a threat. If they say yes, watch their actions over the next few weeks. If the pattern repeats, you have your answer.',
    badTitle: 'They Go Hot &amp; Cold Again',
    badText: 'That is your answer. Not a maybe. Fearful avoidants who are doing their own work will show up differently over time. You deserve someone who shows up consistently.',
  },
  'Anxious': {
    callout: 'Staying regulated and consistent is what an anxious partner needs most. Your calm is the answer to their fear. But whether they can receive that calm — whether their anxiety decreases over time with your steadiness — is what you need to watch for. Re-engagement after a spiral is not resolution. What they do between spirals is the measure.',
    script: '"I care about you and I want this to work. But I need to know that my consistency is landing — that when I stay calm and give you space, it is actually helping. Can we talk honestly about what security looks like for both of us?"',
    explain: 'This is not a confrontation. It is a check-in on whether your steadiness is being received and reciprocated. An anxious partner who is growing will need less and less reassurance over time. Watch the trend, not just the moment.',
    badTitle: 'The Anxiety Keeps Escalating',
    badText: 'You cannot regulate another person\'s nervous system indefinitely. If nothing shifts despite your consistency, that is important information about fit, not just attachment.',
  },
  'Secure': {
    callout: 'A secure partner can handle direct, honest conversations without shutting down or escalating. That is the advantage. Use it. The goal here is not to manage them — it is to make sure you are both genuinely aligned on what you want and what you need.',
    script: '"Things feel good between us and I want to keep building on that. I just want to make sure we\'re both being honest about what we need so this keeps feeling right. What does that look like for you?"',
    explain: 'This is a deepening conversation, not a repair conversation. Secure partners appreciate directness. This check-in strengthens trust rather than threatening it.',
    badTitle: 'Something Still Feels Off',
    badText: 'Trust what your nervous system is telling you. Even with a secure partner, genuine mismatches in needs exist. Naming it is not a problem — it is the most secure thing you can do.',
  },
};

// ── Static content: Standard Setter ─────────────────────────────────────────
const SIGNS_OF_CHANGE = [
  'They acknowledge what happened instead of acting like nothing did',
  'They come back with words AND follow-through',
  'The cycles get shorter over time',
  'They bring up the pattern themselves without you having to',
];
const BREADCRUMBS = [
  'Acts warm and close but never names what happened',
  'Says all the right things but behavior doesn\'t change',
  'The cycle repeats with no growth between rounds',
  'Gets defensive or vague when you try to name the pattern',
];

// ── Static content: Science ──────────────────────────────────────────────────
const SCIENCE_CITATIONS = [
  { icon: '📚', label: 'Attachment Theory · Why We Love the Way We Love', text: 'Levine & Heller (2010) built on Bowlby\'s and Ainsworth\'s work to show that attachment styles drive adult romantic behavior. The patterns in this guide, pursuit, withdrawal, the anxious-avoidant cycle, are well-documented. You are not the first person in this situation. And you are not broken.', cite: 'Levine & Heller (2010) · Attached · Bowlby (1969) · Ainsworth (1978)' },
  { icon: '🧠', label: 'Brain Scans · Rejection Hurts Like Physical Pain', text: 'Dr. Naomi Eisenberger used brain imaging to show that social rejection activates the same brain regions as physical pain. When they go cold, your body is responding to a real threat signal. The chest tightness, the stomach knot, the racing heart, all real. You are not being dramatic.', cite: 'Eisenberger et al. (2003) · UCLA · Kross et al. (2011) · PNAS' },
  { icon: '🧘', label: 'Polyvagal Theory · Your Body\'s Calm Switch', text: 'Dr. Stephen Porges showed that your vagus nerve plays a key role in regulating your stress response. When you extend your exhale, it shifts your body out of panic mode and into a calmer state. A 2023 Stanford study found the double-inhale breath pattern is one of the most effective real-time stress reducers ever tested.', cite: 'Porges (2011) · Polyvagal Theory · Balban et al. (2023) · Stanford' },
  { icon: '🎰', label: 'Intermittent Reinforcement · Why You Can\'t Stop Thinking About Them', text: 'B.F. Skinner found that when rewards are unpredictable, the drive to chase them gets stronger, not weaker. This is called Variable Ratio Reinforcement, the same mechanism that makes gambling addictive. The hot-and-cold pattern is not just confusing. It is neurologically addictive.', cite: 'Skinner (1957) · Reinforcement Schedules · Fisher et al. (2005) · Romantic Love Neuroimaging' },
  { icon: '✨', label: 'Earned Secure Attachment · You Can Change', text: 'Attachment styles are formed in childhood but they are not permanent. Research shows that adults can build what scientists call Earned Secure Attachment, moving toward security through self-awareness, healthier relationships, and support. The work you are doing right now counts.', cite: 'Main (1990) · Adult Attachment Interview · Siegel (1999) · The Developing Mind' },
];

const BOOKS = [
  'Attached by Amir Levine &amp; Rachel Heller (start here)',
  'Hold Me Tight by Dr. Sue Johnson',
  'Wired for Love by Stan Tatkin',
  'The Body Keeps the Score by Bessel van der Kolk',
];

// ── HTML escape helper ────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Build full HTML document ──────────────────────────────────────────────────
function buildHTML(blueprint, { name = '', attachmentStyle = 'Anxious', partnerStyle = 'Dismissive-Avoidant' } = {}) {
  const firstName  = (name || 'You').split(' ')[0];
  const dateStr    = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const myInfo     = STYLE_INFO[attachmentStyle]  || STYLE_INFO['Anxious'];
  const ptInfo     = STYLE_INFO[partnerStyle]     || STYLE_INFO['Dismissive-Avoidant'];
  const myQ        = QUADRANT_POS[attachmentStyle]  || QUADRANT_POS['Anxious'];
  const ptQ        = QUADRANT_POS[partnerStyle]     || QUADRANT_POS['Dismissive-Avoidant'];

  const scripts      = blueprint.scripts      || [];
  const inPerson     = blueprint.inPersonScripts || [];
  const actions      = blueprint.actions      || [];
  const avoid        = blueprint.avoid        || [];
  const plan         = blueprint.plan         || [];
  const understandPt = blueprint.understandingPartner || [];
  const behaviors    = blueprint.partnerBehaviors || [];
  const safetyNotes  = blueprint.safetyNote || [];
  const safetyHTML   = safetyNotes.map(n => `<div class="safety-note"><div class="heading">${esc(n.heading)}</div><p>${esc(n.message)}</p></div>`).join('');

  // ── Compatibility disclosure page ────────────────────────────────────────
  // Hardcoded (never AI-generated) so the core claim can't be softened away.
  const ANXIOUS_LIKE  = ['Anxious', 'Fearful-Avoidant'];
  const AVOIDANT_LIKE = ['Dismissive-Avoidant', 'Fearful-Avoidant'];
  const meAnxious  = ANXIOUS_LIKE.includes(attachmentStyle);
  const meAvoidant = AVOIDANT_LIKE.includes(attachmentStyle);
  const ptAnxious  = ANXIOUS_LIKE.includes(partnerStyle);
  const ptAvoidant = AVOIDANT_LIKE.includes(partnerStyle);
  // True for the classic anxious↔avoidant pairing this disclosure is about.
  const isAnxAvoPair = (meAnxious && ptAvoidant) || (meAvoidant && ptAnxious);
  // Which side of the pairing each person sits on (you-first when you're the anxious one)
  const youAreAnxiousSide = meAnxious && ptAvoidant;
  const anxSideLabel = youAreAnxiousSide ? `The Anxious Side &mdash; You` : `The Anxious Side &mdash; Them`;
  const avoSideLabel = youAreAnxiousSide ? `The Avoidant Side &mdash; Them` : `The Avoidant Side &mdash; You`;

  // Need Beneath the Trigger page data
  const CORE_NEEDS = [
    { key: 'contact',      label: 'Contact',      sub: 'closeness & presence'    },
    { key: 'comfort',      label: 'Comfort',      sub: 'soothed, not fixed'      },
    { key: 'care',         label: 'Care',         sub: 'they look out for me'    },
    { key: 'acceptance',   label: 'Acceptance',   sub: 'enough as I am'          },
    { key: 'belonging',    label: 'Belonging',    sub: 'part of an us'           },
    { key: 'togetherness', label: 'Togetherness', sub: 'shared time & presence'  },
    { key: 'love',         label: 'Love',         sub: 'genuinely loved'         },
    { key: 'value',        label: 'Value',        sub: 'I matter to them'        },
    { key: 'safety',       label: 'Safety',       sub: 'emotionally safe'        },
  ];
  const needsSelected  = blueprint.needsSelected || [];
  const insecurity     = blueprint.insecurity || '';
  const triggeredSteps = blueprint.triggeredSteps || [];
  const innerDialogue  = blueprint.innerDialogue || [];
  const secureCope     = blueprint.secureCope || '';
  const needPillsHTML  = CORE_NEEDS.map(n =>
    `<div class="need-pill${needsSelected.includes(n.key) ? ' picked' : ''}">${n.label} <span class="nsub">&middot; ${n.sub}</span></div>`
  ).join('');
  const pickedLabels = CORE_NEEDS.filter(n => needsSelected.includes(n.key)).map(n => n.label);

  // scripts page 1 (first 4) and page 2 (next 4)
  const scripts1 = scripts.slice(0, 3);
  const scripts2 = scripts.slice(3, 6);
  const scripts3 = scripts.slice(6, 8);

  // ── CSS ──────────────────────────────────────────────────────────────────
  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700;800&display=swap');

:root {
  --navy:    #2C4A35;
  --rose:    #E07A3A;
  --violet:  #D4A843;
  --teal:    #4A7A5A;
  --amber:   #C4860A;
  --cream:   #FAF7F3;
  --card:    #FFFFFF;
  --border:  #DDD7CE;
  --text:    #1E1E1E;
  --muted:   #6B6560;
  --lt-rose:   #FDF0E6;
  --lt-violet: #E6F0E9;
  --lt-teal:   #FBF5E6;
  --lt-amber:  #FBF5E6;
  --lt-navy:   #E8EEE9;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: 'Nunito', sans-serif; background: var(--cream); color: var(--text); font-size: 13px; line-height: 1.6; }
.page { width: 816px; margin: 0 auto; }

@page { size: Letter; margin: 0; }
.section-page { background: var(--cream); padding: 22px 48px; min-height: 1056px; page-break-before: always; page-break-after: always; break-before: page; break-after: page; }
@media print { .section-page { page-break-before: always; } }

/* COVER */
.cover { background: linear-gradient(140deg, #0F1A10 0%, #1E3526 55%, #2C4A35 100%); min-height: 1056px; display: flex; flex-direction: column; padding: 42px 52px; position: relative; overflow: hidden; }
.cover-orb-1 { position: absolute; right: -100px; top: -100px; width: 480px; height: 480px; border-radius: 50%; background: radial-gradient(circle, rgba(224,122,58,0.18) 0%, transparent 70%); }
.cover-orb-2 { position: absolute; left: -80px; bottom: -80px; width: 380px; height: 380px; border-radius: 50%; background: radial-gradient(circle, rgba(212,168,67,0.18) 0%, transparent 70%); }
.cover-orb-3 { position: absolute; right: 120px; bottom: 200px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(74,122,90,0.18) 0%, transparent 70%); }
.cover-label { font-size: 10px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; color: var(--rose); margin-bottom: 14px; }
.cover-badge { display: block; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 100px; padding: 8px 20px; margin: 0 auto 18px; width: fit-content; align-self: center; text-align: center; }
.cover-badge span { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.7); }
.cover h1 { font-family: 'Playfair Display', serif; font-size: 46px; font-weight: 800; color: #FFFFFF; line-height: 1.05; margin-bottom: 8px; max-width: 560px; }
.cover h1 .accent { color: #F4C44A; }
.cover-sub { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.6); margin-bottom: 20px; max-width: 500px; line-height: 1.6; }
.cover-divider { width: 48px; height: 3px; background: var(--rose); margin-bottom: 18px; border-radius: 2px; }
.cover-stat-row { display: flex; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
.cover-stat { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 10px 16px; flex: 1; min-width: 120px; }
.cover-stat .num { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #fff; }
.cover-stat .lbl { font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-top: 2px; }
.cover-intro { background: rgba(255,255,255,0.06); border-left: 3px solid var(--rose); border-radius: 0 10px 10px 0; padding: 12px 16px; max-width: 600px; margin-bottom: 18px; }
.cover-intro p { font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.82); line-height: 1.65; }
.safety-note { background: rgba(229,72,77,0.14); border-left: 3px solid #E5484D; border-radius: 0 10px 10px 0; padding: 14px 18px; max-width: 600px; margin-bottom: 16px; }
.safety-note .heading { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #FF9B9B; margin-bottom: 6px; }
.safety-note p { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.85); line-height: 1.65; }

/* COMPATIBILITY DISCLOSURE */
.disc-box { background: #FBF0EC; border: 2px solid var(--rose); border-radius: 12px; padding: 15px 18px; margin-bottom: 12px; }
.disc-box .disc-label { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--rose); margin-bottom: 7px; }
.disc-box p { font-size: 12.5px; font-weight: 700; color: var(--text); line-height: 1.7; margin-bottom: 8px; }
.disc-box p:last-child { margin-bottom: 0; }
.disc-box .disc-hard { font-size: 13px; font-weight: 800; color: #A33A2A; }
.disc-note { background: var(--lt-navy); border-left: 3px solid var(--navy); border-radius: 0 10px 10px 0; padding: 12px 16px; margin-bottom: 12px; }
.disc-note p { font-size: 12px; font-weight: 600; color: var(--text); line-height: 1.7; }
.accom-card { border-radius: 12px; padding: 12px 15px; border: 1.5px solid; }
.accom-card .accom-title { font-size: 10.5px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px; }
.accom-card ul { list-style: none; }
.accom-card li { display: flex; gap: 8px; margin-bottom: 6px; font-size: 11.5px; font-weight: 600; color: var(--text); line-height: 1.55; }
.accom-card li:last-child { margin-bottom: 0; }
.accom-card .tick { font-weight: 800; flex-shrink: 0; }
.disc-choice { background: linear-gradient(135deg, #0F1A10 0%, #1E3526 100%); border-radius: 12px; padding: 14px 18px; margin-top: 12px; }
.disc-choice .choice-label { font-size: 9.5px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; }
.disc-choice p { font-size: 12.5px; font-weight: 700; color: rgba(255,255,255,0.9); line-height: 1.7; }

/* NUMBERED STEP CARDS */
.cyc-ask { display: flex; align-items: flex-start; gap: 12px; background: var(--card); border: 1.5px solid var(--border); border-radius: 12px; padding: 9px 14px; margin-bottom: 6px; }
.cyc-ask-num { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--rose); flex-shrink: 0; line-height: 1.2; }
.cyc-ask-text { font-size: 12.5px; font-weight: 700; color: var(--text); line-height: 1.55; padding-top: 3px; }

/* THE NEED BENEATH THE TRIGGER */
.insec-block { background: var(--lt-amber); border-left: 3px solid var(--amber); border-radius: 0 10px 10px 0; padding: 11px 16px; margin-bottom: 10px; }
.insec-block .insec-label { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--amber); margin-bottom: 5px; }
.insec-block p { font-size: 12px; font-weight: 600; color: var(--text); line-height: 1.7; }
.needs-wrap { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 8px; }
.need-pill { border: 1.5px solid var(--border); background: var(--card); border-radius: 100px; padding: 6px 13px; font-size: 10.5px; font-weight: 700; color: var(--muted); }
.need-pill .nsub { font-weight: 600; opacity: 0.75; }
.need-pill.picked { background: var(--navy); border-color: var(--navy); color: #fff; }
.needs-note { font-size: 11.5px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.needs-note b { color: var(--teal); }
.dlg-pair { background: var(--card); border: 1.5px solid var(--border); border-radius: 12px; padding: 7px 12px; margin-bottom: 5px; }
.dlg-instead { font-size: 11px; font-weight: 700; color: var(--rose); line-height: 1.5; }
.dlg-try { font-size: 12px; font-weight: 700; color: var(--text); line-height: 1.55; margin-top: 3px; }
.dlg-try .arrow { color: var(--teal); }
.secure-block { background: var(--lt-violet); border-left: 3px solid var(--teal); border-radius: 0 10px 10px 0; padding: 11px 16px; }
.secure-block p { font-size: 12px; font-weight: 600; color: var(--text); line-height: 1.7; }
.cover-prepared { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); margin-bottom: 14px; letter-spacing: 0.5px; }
.toc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; max-width: 600px; margin-bottom: 18px; }
.toc-item { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 6px 12px; }
.toc-num { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.18); flex-shrink: 0; width: 20px; }
.toc-text { font-size: 10.5px; font-weight: 700; color: rgba(255,255,255,0.65); line-height: 1.3; }
.cover-footer { margin-top: auto; font-size: 10px; color: rgba(255,255,255,0.2); font-weight: 600; letter-spacing: 1px; }

/* PAGE HEADER */
.page-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--border); }
.page-header-num { font-family: 'Playfair Display', serif; font-size: 52px; font-weight: 700; line-height: 1; opacity: 0.08; color: var(--text); flex-shrink: 0; margin-top: -4px; }
.page-header-content { flex: 1; }
.page-header-label { font-size: 9.5px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 2px; }
.page-header-title { font-family: 'Playfair Display', serif; font-size: 23px; font-weight: 700; line-height: 1.15; color: var(--text); }
.page-header-sub { font-size: 11.5px; font-weight: 600; color: var(--muted); margin-top: 3px; }

/* CARDS */
.card { background: var(--card); border-radius: 12px; border: 1.5px solid var(--border); padding: 12px 16px; margin-bottom: 8px; }
.card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 7px; }
.bg-rose   { background: var(--lt-rose);   border-color: #F0C0A0; }
.bg-violet { background: var(--lt-violet); border-color: #B8C8A0; }
.bg-teal   { background: var(--lt-teal);   border-color: #9CC49C; }
.bg-amber  { background: var(--lt-amber);  border-color: #D4C08A; }
.bg-navy   { background: var(--lt-navy);   border-color: #9CB89C; }
.ac-rose   { color: var(--rose); }
.ac-violet { color: var(--violet); }
.ac-teal   { color: var(--teal); }
.ac-amber  { color: var(--amber); }
.ac-navy   { color: var(--navy); }

/* GRIDS */
.two-col   { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }

/* SCIENCE BLOCK */
.science-block { background: var(--navy); border-radius: 12px; padding: 13px 16px; color: rgba(255,255,255,0.9); margin: 9px 0; display: flex; gap: 12px; align-items: flex-start; }
.science-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
.science-label { font-size: 9px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 3px; }
.science-text { font-size: 11.5px; font-weight: 600; line-height: 1.6; color: rgba(255,255,255,0.88); }
.science-cite { font-size: 9.5px; font-weight: 700; color: rgba(255,255,255,0.4); margin-top: 4px; font-style: italic; }

/* CALLOUTS */
.callout { border-radius: 12px; padding: 10px 14px; margin: 8px 0; border-left: 4px solid; display: flex; gap: 11px; align-items: flex-start; }
.callout-icon { font-size: 18px; flex-shrink: 0; }
.callout-text { font-size: 11.5px; font-weight: 600; line-height: 1.55; }
.callout-title { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.callout-rose   { background: var(--lt-rose);   border-color: var(--rose); }
.callout-violet { background: var(--lt-violet); border-color: var(--violet); }
.callout-teal   { background: var(--lt-teal);   border-color: var(--teal); }
.callout-amber  { background: var(--lt-amber);  border-color: var(--amber); }
.callout-navy   { background: var(--lt-navy);   border-color: var(--navy); }

/* PULL QUOTE */
.pull-quote { position: relative; padding: 9px 18px 9px 52px; border-radius: 12px; margin: 10px 0; }
.pull-quote::before { content: '\\201C'; position: absolute; left: 8px; top: -2px; font-family: 'Playfair Display', serif; font-size: 72px; line-height: 1; }
.pull-quote p { font-size: 13px; font-weight: 700; line-height: 1.6; font-style: italic; }
.pq-violet { background: var(--lt-violet); border-left: 4px solid var(--violet); }
.pq-violet::before { color: rgba(212,168,67,0.22); }
.pq-violet p { color: #1A3020; }
.pq-rose { background: var(--lt-rose); border-left: 4px solid var(--rose); }
.pq-rose::before { color: rgba(224,122,58,0.22); }
.pq-rose p { color: #5A3A1A; }
.pq-navy { background: var(--lt-navy); border-left: 4px solid var(--navy); }
.pq-navy::before { color: rgba(44,74,53,0.18); }
.pq-navy p { color: #2C4A35; }

/* BIG STAT STRIP */
.big-stat-strip { display: grid; grid-template-columns: repeat(3,1fr); gap: 0; border-radius: 12px; overflow: hidden; margin: 10px 0; border: 1.5px solid var(--border); }
.big-stat-cell { padding: 14px 12px; text-align: center; border-right: 1px solid var(--border); }
.big-stat-cell:last-child { border-right: none; }
.big-stat-num { font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 800; line-height: 1; }
.big-stat-lbl { font-size: 10.5px; font-weight: 700; color: var(--muted); margin-top: 4px; line-height: 1.4; }

/* PHONE / CHAT MOCKUP */
.phone-wrap { background: #18181B; border-radius: 16px; padding: 9px 12px; margin: 5px 0; }
.phone-header { font-size: 9.5px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.28); margin-bottom: 5px; text-align: center; }
.bubble-row { display: flex; margin-bottom: 5px; }
.bubble-row.sent { justify-content: flex-end; }
.bubble { max-width: 72%; padding: 5px 10px; font-size: 11px; font-weight: 600; line-height: 1.5; border-radius: 16px; }
.bubble.received { background: #2C2C30; color: rgba(255,255,255,0.88); border-radius: 16px 16px 16px 4px; }
.bubble.sent     { background: var(--violet); color: #fff; border-radius: 16px 16px 4px 16px; }
.bubble.sent-rose { background: var(--rose); color: #fff; border-radius: 16px 16px 4px 16px; }
.bubble.sent-teal { background: var(--teal); color: #fff; border-radius: 16px 16px 4px 16px; }
.bubble.sent-navy { background: var(--navy); color: #fff; border-radius: 16px 16px 4px 16px; }
.bubble-time { font-size: 9.5px; color: rgba(255,255,255,0.28); text-align: center; margin: 4px 0 5px; font-weight: 600; }
.bubble-note { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); font-style: italic; padding: 3px 0; }

/* SECTION LABEL */
.section-label { font-size: 9.5px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: var(--muted); margin: 11px 0 7px; display: flex; align-items: center; gap: 10px; }
.section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* CYCLE */
.cycle-container { display: flex; align-items: stretch; gap: 0; margin: 10px 0; border-radius: 12px; overflow: hidden; border: 1.5px solid var(--border); }
.cycle-step { flex: 1; padding: 12px 6px; text-align: center; position: relative; }
.cycle-step::after { content: '›'; position: absolute; right: -8px; top: 50%; transform: translateY(-50%); font-size: 20px; color: var(--muted); z-index: 2; }
.cycle-step:last-child::after { display: none; }
.cycle-emoji { font-size: 22px; margin-bottom: 4px; }
.cycle-title { font-size: 9.5px; font-weight: 800; letter-spacing: 0.5px; line-height: 1.3; }
.cycle-sub { font-size: 8.5px; font-weight: 600; color: var(--muted); margin-top: 2px; line-height: 1.3; }

/* SCENARIO BOX */
.scenario-box { background: linear-gradient(135deg, #1A2A1A, #2C4A35); border-radius: 12px; padding: 14px 18px; margin: 9px 0; }
.scenario-label { font-size: 8.5px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; }
.scenario-text { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.9); line-height: 1.65; font-style: italic; }
.scenario-explain { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.55); margin-top: 7px; }

/* SCRIPT BOX */
.script-box { background: linear-gradient(135deg, #0F1A10 0%, #1E3526 100%); border-radius: 12px; padding: 10px 16px; margin: 5px 0; }
.script-label { font-size: 8.5px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 6px; }
.script-line { background: rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; margin-bottom: 4px; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.92); line-height: 1.6; border-left: 3px solid rgba(224,122,58,0.6); }
.script-why { font-size: 10.5px; font-weight: 700; color: rgba(255,255,255,0.48); margin-top: 6px; font-style: italic; line-height: 1.5; }

/* NUMBERED STEPS */
.step-list { list-style: none; }
.step-item { display: flex; gap: 12px; align-items: flex-start; padding: 4px 0; border-bottom: 1px solid var(--border); }
.step-item:last-child { border-bottom: none; }
.step-num { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; color: #fff; }
.step-title { font-size: 12.5px; font-weight: 800; margin-bottom: 3px; }
.step-body { font-size: 11.5px; font-weight: 600; color: var(--muted); line-height: 1.55; }
.step-why { font-size: 11px; font-weight: 700; color: var(--teal); margin-top: 4px; line-height: 1.5; }

/* BULLET LIST */
.bullet-list { list-style: none; }
.bullet-list li { display: flex; gap: 9px; align-items: flex-start; font-size: 12px; font-weight: 600; line-height: 1.5; padding: 4px 0; border-bottom: 1px solid var(--border); }
.bullet-list li:last-child { border-bottom: none; }
.bullet-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }

/* CHECKLIST */
.checklist { list-style: none; }
.checklist li { display: flex; gap: 9px; align-items: flex-start; font-size: 12px; font-weight: 600; line-height: 1.5; padding: 5px 0; border-bottom: 1px solid var(--border); }
.checklist li:last-child { border-bottom: none; }
.check-icon { width: 19px; height: 19px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; flex-shrink: 0; margin-top: 1px; color: #fff; }
.check-yes { background: var(--teal); }
.check-no  { background: var(--rose); }

/* TRANSLATION TABLE */
.translate-table { border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; margin: 10px 0; }
.translate-header { display: grid; grid-template-columns: 1fr 1fr 1fr; background: var(--navy); padding: 8px 12px; }
.translate-header span { font-size: 9px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
.translate-row { display: grid; grid-template-columns: 1fr 1fr 1fr; border-bottom: 1px solid var(--border); }
.translate-row:last-child { border-bottom: none; }
.translate-cell { padding: 9px 12px; font-size: 11.5px; font-weight: 600; line-height: 1.5; }
.translate-cell.col1 { border-right: 1px solid var(--border); color: var(--rose); font-style: italic; }
.translate-cell.col2 { border-right: 1px solid var(--border); color: var(--navy); }
.translate-cell.col3 { color: var(--teal); font-weight: 700; }

/* AFFIRMATION GRID */
.affirmation-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
.affirmation-card { background: linear-gradient(135deg, var(--lt-violet), var(--lt-rose)); border-radius: 10px; padding: 12px 14px; border: 1px solid #C8B8E8; text-align: center; }
.affirmation-card p { font-size: 12px; font-weight: 800; line-height: 1.5; color: #1A3020; }

/* GRADIENT HIGHLIGHT */
.gradient-highlight { background: linear-gradient(135deg, #0F1A10, #1E3526, #2C4A35); border-radius: 14px; padding: 18px 22px; margin: 10px 0; color: rgba(255,255,255,0.9); }
.gh-label { font-size: 8.5px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 8px; }
.gh-big { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 8px; }
.gh-sub { font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,0.7); line-height: 1.6; }

/* DAY PLAN */
.day-row { display: flex; align-items: flex-start; gap: 14px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.day-row:last-child { border-bottom: none; }
.day-badge { background: var(--navy); color: white; font-size: 8px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; padding: 5px 10px; border-radius: 6px; white-space: nowrap; min-width: 52px; text-align: center; flex-shrink: 0; margin-top: 1px; }
.day-text { font-size: 12px; font-weight: 600; line-height: 1.55; color: var(--text); }

/* QUADRANT */
.quadrant-outer { margin: 16px 0 18px; }
.quadrant-axis-label { text-align: center; font-size: 8px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
.quadrant-axis-label.top { margin-bottom: 5px; }
.quadrant-axis-label.bottom { margin-top: 5px; }
.quadrant-row { display: flex; align-items: center; gap: 6px; }
.quadrant-side { font-size: 7.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); width: 28px; text-align: center; line-height: 1.4; flex-shrink: 0; }
.quadrant-inner { flex: 1; position: relative; height: 210px; border: 2px solid var(--border); border-radius: 10px; background: #FAFAF8; overflow: hidden; }
.q-hline { position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--border); }
.q-vline { position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: var(--border); }
.q-qlabel { position: absolute; font-size: 8.5px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; color: var(--muted); line-height: 1.35; padding: 9px 11px; }
.q-dot { position: absolute; transform: translate(-50%, -50%); width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 900; color: white; letter-spacing: 0.3px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }

/* STYLE CARDS GRID */
.style-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
.style-card { border-radius: 12px; padding: 11px 14px; border: 1.5px solid; }
.style-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.style-card-name { font-size: 12px; font-weight: 800; }
.style-card-pct { font-size: 9.5px; font-weight: 700; opacity: 0.7; }
.style-card-tag { font-size: 10.5px; font-weight: 700; font-style: italic; margin-bottom: 6px; }
.style-card-desc { font-size: 10.5px; font-weight: 600; line-height: 1.55; color: var(--muted); }
.style-card-you { font-size: 8.5px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 7px; padding: 3px 8px; border-radius: 20px; display: inline-block; color: white; }
.style-highlight { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }

/* DECISION FLOW */
.decision-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.decision-box { border-radius: 12px; padding: 13px 15px; }

/* ACTION ITEMS */
.action-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--border); }
.action-item:last-child { border-bottom: none; }
.action-num { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: white; background: var(--teal); }
.action-text { font-size: 12.5px; font-weight: 600; line-height: 1.55; padding-top: 2px; }

/* AVOID ITEMS */
.avoid-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 12px; background: var(--lt-rose); border-radius: 10px; border-left: 4px solid var(--rose); margin-bottom: 7px; }
.avoid-x { font-size: 13px; font-weight: 900; color: var(--rose); flex-shrink: 0; margin-top: 1px; }
.avoid-text { font-size: 12px; font-weight: 600; line-height: 1.5; }

/* TAG PILLS */
.tag { display: inline-block; padding: 2px 9px; border-radius: 100px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.5px; margin: 2px; }
.tag-rose { background: var(--lt-rose); color: var(--rose); }
.tag-violet { background: var(--lt-violet); color: var(--violet); }
.tag-teal { background: var(--lt-teal); color: var(--teal); }
.tag-navy { background: var(--lt-navy); color: var(--navy); }

/* METER (speedo) */
.meter-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.meter-label { font-size: 11px; font-weight: 700; width: 140px; flex-shrink: 0; }
.meter-bar-bg { flex: 1; height: 13px; background: #E8E2D8; border-radius: 100px; overflow: hidden; }
.meter-fill { height: 100%; border-radius: 100px; display: flex; align-items: center; padding-left: 8px; }
.meter-fill span { font-size: 9px; font-weight: 800; color: white; }
`;

  // ── Quadrant dot helper ───────────────────────────────────────────────────
  function qDot(x, y, color, label) {
    return `<div class="q-dot" style="left:${x}%;top:${y}%;background:${color}">${label}</div>`;
  }
  // Offset THEM dot slightly if they share the same quadrant as YOU
  const sameQuadrant = attachmentStyle === partnerStyle;
  const ptQx = sameQuadrant ? ptQ.x + 8 : ptQ.x;
  const ptQy = sameQuadrant ? ptQ.y - 8 : ptQ.y;

  // ── Style card ─────────────────────────────────────────────────────────────
  function styleCard(styleName, isMe, isThem) {
    const info = STYLE_INFO[styleName] || STYLE_INFO['Anxious'];
    const highlight = isMe || isThem;
    const badges = [
      isMe   ? `<span class="style-card-you" style="background:${info.color}">YOU</span>` : '',
      isThem ? `<span class="style-card-you" style="background:#444">THEM</span>` : '',
    ].filter(Boolean).join('');
    return `
    <div class="style-card ${highlight ? 'style-highlight' : ''}" style="background:${info.light};border-color:${info.border}">
      <div class="style-card-header">
        <div class="style-card-name" style="color:${info.color}">${styleName}</div>
        <div class="style-card-pct" style="color:${info.color}">${info.pct}</div>
      </div>
      <div class="style-card-tag" style="color:${info.color}">${info.tagline}</div>
      <div class="style-card-desc">${info.desc}</div>
      ${badges ? `<div style="margin-top:8px">${badges}</div>` : ''}
    </div>`;
  }

  // ── Script block with phone mockup ─────────────────────────────────────────
  function scriptBlock(s, bubbleColor = 'sent') {
    const chat = (s.theirMessage && s.say) ? `
    <div class="phone-wrap">
      <div class="phone-header">📱 How This Plays Out</div>
      <div class="bubble-row"><div class="bubble received">${esc(s.theirMessage)}</div></div>
      <div class="bubble-row sent"><div class="bubble ${bubbleColor}">${esc(s.say)}</div></div>
      ${s.note ? `<div class="bubble-time">${esc(s.note)}</div>` : ''}
    </div>` : '';
    return `
    <div class="section-label">${esc(s.context || 'WHEN TO USE')}</div>
    <div class="script-box">
      <div class="script-label">The Secure Script</div>
      <div class="script-line">&ldquo;${esc(s.say)}&rdquo;</div>
      ${s.why ? `<div class="script-why">Why this works: ${esc(s.why)}</div>` : ''}
    </div>
    ${chat}`;
  }

  // ── In-person script card ──────────────────────────────────────────────────
  function inPersonCard(s) {
    return `
    <div class="card bg-violet">
      <div class="card-title ac-violet">${esc(s.context || 'In Person')}</div>
      <div style="font-size:12px;font-weight:600;font-style:italic;color:#1A3020;margin-bottom:6px;">&ldquo;${esc(s.say)}&rdquo;</div>
      ${s.note ? `<div style="font-size:11px;font-weight:700;color:var(--violet);">${esc(s.note)}</div>` : ''}
    </div>`;
  }

  // ── Protest behavior item ──────────────────────────────────────────────────
  function protestItem(p) {
    return `
    <li class="step-item">
      <div class="step-num" style="background:var(--rose)">${p.num}</div>
      <div>
        <div class="step-title ac-rose">${p.title}</div>
        <div class="step-body">${p.body}</div>
        <div class="step-why">${p.rule}</div>
      </div>
    </li>`;
  }

  // ── Citation block ─────────────────────────────────────────────────────────
  function citationBlock(c) {
    return `
    <div class="science-block">
      <div class="science-icon">${c.icon}</div>
      <div>
        <div class="science-label">${c.label}</div>
        <div class="science-text">${c.text}</div>
        <div class="science-cite">${c.cite}</div>
      </div>
    </div>`;
  }

  // ── Partner behavior rows ──────────────────────────────────────────────────
  const behaviorRows = behaviors.map(b => `
    <div class="translate-row">
      <div class="translate-cell col1">${esc(b.behavior)}</div>
      <div class="translate-cell col2">${esc(b.translation)}</div>
      <div class="translate-cell col3">${esc(b.move)}</div>
    </div>`).join('');

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD HTML PAGES
  // ─────────────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(blueprint.title || 'Your BondBlueprint')}</title>
<style>${CSS}</style>
</head>
<body>
<div class="page">

<!-- ═══ PAGE 1: COVER ════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-orb-1"></div><div class="cover-orb-2"></div><div class="cover-orb-3"></div>
  <div class="cover-label">By Ash · Couples Educator</div>
  <div class="cover-badge"><span>Science-Backed · Attachment-Informed Guide</span></div>
  <h1>${esc(blueprint.title || `${firstName}'s`)} <span class="accent">BondBlueprint</span></h1>
  <div class="cover-sub">Your personalized guide, built from everything you shared. Real scripts. Real science. No guessing.</div>
  <div class="cover-divider"></div>
  <div class="cover-stat-row">
    <div class="cover-stat"><div class="num">${esc(attachmentStyle)}</div><div class="lbl">Your Style</div></div>
    <div class="cover-stat"><div class="num">${esc(partnerStyle)}</div><div class="lbl">Their Style</div></div>
    <div class="cover-stat"><div class="num">${scripts.length || 8}</div><div class="lbl">Scripts That Work</div></div>
    <div class="cover-stat"><div class="num">7-Day</div><div class="lbl">Action Plan</div></div>
  </div>
  <div class="cover-intro"><p>${esc(blueprint.coverIntro || `You are not too much. You are not broken. You have an attachment history, and now you have a map. This guide was built specifically from what you shared.`)}</p></div>
  ${safetyHTML}
  <div class="cover-prepared">Prepared for ${esc(firstName)} · ${dateStr}</div>
  <div class="toc-grid">
    <div class="toc-item"><div class="toc-num">1</div><div class="toc-text">You Are Not Alone In This</div></div>
    <div class="toc-item"><div class="toc-num">2</div><div class="toc-text">The Attachment Spectrum</div></div>
    <div class="toc-item"><div class="toc-num">3</div><div class="toc-text">Decoding Your Partner</div></div>
    <div class="toc-item"><div class="toc-num">4</div><div class="toc-text">What You Actually Need</div></div>
    <div class="toc-item"><div class="toc-num">5</div><div class="toc-text">Stop These First</div></div>
    <div class="toc-item"><div class="toc-num">6</div><div class="toc-text">Your Calm Switch</div></div>
    <div class="toc-item"><div class="toc-num">7</div><div class="toc-text">Scripts That Actually Work</div></div>
    <div class="toc-item"><div class="toc-num">8</div><div class="toc-text">Your 7-Day Plan</div></div>
  </div>
  <div class="cover-footer">For educational purposes only · Rooted in attachment science · Not therapy or clinical advice</div>
</div>

<!-- ═══ PAGE 2: YOU ARE NOT ALONE ════════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">1</div>
    <div class="page-header-content">
      <div class="page-header-label ac-violet">The Introduction</div>
      <div class="page-header-title">You Are Not Alone In This</div>
      <div class="page-header-sub">Why you feel the way you do, and why it makes complete sense</div>
    </div>
  </div>

  <div class="callout callout-violet">
    <div class="callout-icon">💜</div>
    <div>
      <div class="callout-title" style="color:var(--violet)">Before You Read Anything Else</div>
      <div class="callout-text">Take a breath. Drop your shoulders. Whatever is happening right now, the silence, the hot and cold, the feeling that you keep getting this wrong, none of it means you are broken. It means your nervous systems are doing exactly what they were built to do. This guide is going to show you why, and what to do instead.</div>
    </div>
  </div>

  ${blueprint.situationSummary ? `
  <div class="pull-quote pq-navy">
    <p>${esc(blueprint.situationSummary)}</p>
  </div>` : ''}

  <div class="science-block">
    <div class="science-icon">🧠</div>
    <div>
      <div class="science-label">Here Is the Science</div>
      <div class="science-text">Your brain is wired to treat losing someone close the same way it treats physical danger. When they pull away or go cold, the alarm center in your brain fires. Your body floods with cortisol. The urgency feels real because it IS real, your nervous system is responding to a genuine threat signal. Brain scans show that rejection activates the same regions as physical pain. You are not being dramatic.</div>
      <div class="science-cite">Eisenberger et al. (2003) · UCLA · Levine &amp; Heller (2010), Attached</div>
    </div>
  </div>

  <div class="big-stat-strip">
    <div class="big-stat-cell" style="background:var(--lt-rose)">
      <div class="big-stat-num ac-rose">🔥</div>
      <div class="big-stat-lbl">Rejection activates the<br>same brain regions as pain</div>
    </div>
    <div class="big-stat-cell" style="background:var(--lt-violet)">
      <div class="big-stat-num ac-violet">~20%</div>
      <div class="big-stat-lbl">of adults have an<br>anxious attachment style</div>
    </div>
    <div class="big-stat-cell" style="background:var(--lt-teal)">
      <div class="big-stat-num ac-teal">~25%</div>
      <div class="big-stat-lbl">have an avoidant<br>attachment style</div>
    </div>
  </div>

  <div class="section-label">Why the Loop Keeps Repeating</div>

  <div class="cycle-container">
    <div class="cycle-step" style="background:var(--lt-teal)">
      <div class="cycle-emoji">✨</div>
      <div class="cycle-title ac-teal">Things Feel Good</div>
      <div class="cycle-sub">Close, connected, hopeful</div>
    </div>
    <div class="cycle-step" style="background:var(--lt-violet)">
      <div class="cycle-emoji">😰</div>
      <div class="cycle-title ac-violet">They Get Overwhelmed</div>
      <div class="cycle-sub">Closeness triggers their alarm</div>
    </div>
    <div class="cycle-step" style="background:var(--lt-rose)">
      <div class="cycle-emoji">🚪</div>
      <div class="cycle-title ac-rose">${esc(blueprint.cycleRight || 'They Pull Away')}</div>
      <div class="cycle-sub">Cold, quiet, distant</div>
    </div>
    <div class="cycle-step" style="background:var(--lt-amber)">
      <div class="cycle-emoji">⚡</div>
      <div class="cycle-title ac-amber">${esc(blueprint.cycleLeft || 'You Panic and Reach')}</div>
      <div class="cycle-sub">Texts, worry, spiraling</div>
    </div>
    <div class="cycle-step" style="background:var(--lt-navy)">
      <div class="cycle-emoji">🔄</div>
      <div class="cycle-title ac-navy">Loop Repeats</div>
      <div class="cycle-sub">Your reach triggers their retreat</div>
    </div>
  </div>

  <div class="science-block">
    <div class="science-icon">🎰</div>
    <div>
      <div class="science-label">Why You Can't Stop Thinking About Them</div>
      <div class="science-text">The hot-and-cold pattern is not just confusing. It is neurologically addictive. B.F. Skinner found that when rewards are unpredictable, your brain chases them harder, not less, the same mechanism that makes gambling addictive. You are not obsessed because you are weak. You are responding to a pattern that was designed to hook you.</div>
      <div class="science-cite">Skinner (1957) · Variable Ratio Reinforcement · Fisher et al. (2005) · Romantic Love and Dopamine</div>
    </div>
  </div>
</div>

<!-- ═══ PAGE 3: ATTACHMENT SPECTRUM ════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">2</div>
    <div class="page-header-content">
      <div class="page-header-label ac-teal">Know Your Wiring</div>
      <div class="page-header-title">The Attachment Spectrum</div>
      <div class="page-header-sub">Every person is on a spectrum, not a fixed box. These are patterns, not permanent labels.</div>
    </div>
  </div>

  <div class="quadrant-outer">
    <div class="quadrant-axis-label top">▲ HIGH AVOIDANCE</div>
    <div class="quadrant-row">
      <div class="quadrant-side">LOW<br>ANXIETY</div>
      <div class="quadrant-inner">
        <div class="q-hline"></div>
        <div class="q-vline"></div>
        <div class="q-qlabel" style="top:0;left:0">DISMISSIVE-<br>AVOIDANT</div>
        <div class="q-qlabel" style="top:0;right:0;text-align:right">FEARFUL-<br>AVOIDANT</div>
        <div class="q-qlabel" style="bottom:0;left:0">SECURE</div>
        <div class="q-qlabel" style="bottom:0;right:0;text-align:right">ANXIOUS-<br>PREOCCUPIED</div>
        ${qDot(myQ.x, myQ.y, myInfo.color, 'YOU')}
        ${qDot(ptQx, ptQy, ptInfo.color, 'THEM')}
      </div>
      <div class="quadrant-side">HIGH<br>ANXIETY</div>
    </div>
    <div class="quadrant-axis-label bottom">▼ LOW AVOIDANCE</div>
  </div>

  <div class="callout callout-violet" style="margin-bottom:12px;">
    <div class="callout-icon">💡</div>
    <div>
      <div class="callout-title" style="color:var(--violet)">Remember: It's a Spectrum, Not a Box</div>
      <div class="callout-text">Your attachment style is a pattern, not a life sentence. Everyone falls somewhere on this line, and most people lean toward one side while having traits from others. The good news: all styles can move toward security. That's what this guide helps you do.</div>
    </div>
  </div>

  <div class="style-grid">
    ${styleCard('Anxious',               attachmentStyle === 'Anxious',               partnerStyle === 'Anxious')}
    ${styleCard('Fearful-Avoidant',      attachmentStyle === 'Fearful-Avoidant',      partnerStyle === 'Fearful-Avoidant')}
    ${styleCard('Secure',                attachmentStyle === 'Secure',                partnerStyle === 'Secure')}
    ${styleCard('Dismissive-Avoidant',   attachmentStyle === 'Dismissive-Avoidant',   partnerStyle === 'Dismissive-Avoidant')}
  </div>

  <div class="callout callout-teal" style="margin-top:12px;">
    <div class="callout-icon">🔬</div>
    <div>
      <div class="callout-title" style="color:var(--teal)">The Science of Why These Styles Attract Each Other</div>
      <div class="callout-text">Anxious and avoidant styles are drawn to each other more than any other pairing, and this is documented in research. The anxious person's intensity temporarily pierces the avoidant's defenses. The avoidant's cool independence feels safe to the anxious person. But without awareness, this pairing fuels the cycle rather than breaking it.</div>
      <div style="font-size:10.5px;font-weight:700;color:var(--teal);margin-top:5px;">Levine &amp; Heller (2010) · Attached · Bartholomew &amp; Horowitz (1991)</div>
    </div>
  </div>
</div>

<!-- ═══ PAGE 4: DECODING YOUR PARTNER ══════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">3</div>
    <div class="page-header-content">
      <div class="page-header-label ac-navy">Decode Them</div>
      <div class="page-header-title">What's Actually Going On Inside Them</div>
      <div class="page-header-sub">Their behavior isn't random. Here is what's driving it, in plain English.</div>
    </div>
  </div>

  ${understandPt.length ? understandPt.map(p => `
  <p style="font-size:13px;font-weight:600;line-height:1.7;color:var(--text);margin-bottom:12px;">${esc(p)}</p>`).join('') : `
  <p style="font-size:13px;font-weight:600;line-height:1.7;margin-bottom:12px;">When someone with a ${esc(partnerStyle)} attachment style pulls away, goes quiet, or runs hot and cold, it isn't about you. Their nervous system learned early on that closeness equals danger or loss of self. Pulling back is how they protect themselves, even from people they genuinely care about.</p>
  <p style="font-size:13px;font-weight:600;line-height:1.7;margin-bottom:12px;">The tragedy of this pattern is that the more you reach for them, the more overwhelmed they feel, and the more they pull back. Your reaching isn't wrong. Their pulling isn't wrong. Both are nervous systems doing what they were built to do. The cycle runs on autopilot until someone interrupts it.</p>
  <p style="font-size:13px;font-weight:600;line-height:1.7;margin-bottom:12px;">What they actually need, even if they can't say it, is a partner who stays calm and doesn't collapse when they need space. When you can give them that, their system starts to relax. The pull-away gets shorter. They come back faster.</p>`}

  ${behaviors.length ? `
  <div class="section-label">What They Do, and What It Actually Means</div>
  <div class="translate-table">
    <div class="translate-header">
      <span>When they...</span>
      <span>What it actually means</span>
      <span>Your move</span>
    </div>
    ${behaviorRows}
  </div>` : `
  <div class="section-label">What Their Behavior Actually Means</div>
  <div class="translate-table">
    <div class="translate-header">
      <span>When they...</span>
      <span>What it actually means</span>
      <span>Your move</span>
    </div>
    <div class="translate-row">
      <div class="translate-cell col1">Go quiet for days</div>
      <div class="translate-cell col2">They're overwhelmed and need space to regulate, not abandoning you</div>
      <div class="translate-cell col3">Give space. One warm message. Then stop.</div>
    </div>
    <div class="translate-row">
      <div class="translate-cell col1">Say "I'm fine" when they're not</div>
      <div class="translate-cell col2">They don't have language for their feelings yet, or fear your reaction</div>
      <div class="translate-cell col3">"Okay. I'm here when you're ready."</div>
    </div>
    <div class="translate-row">
      <div class="translate-cell col1">Pull away after closeness</div>
      <div class="translate-cell col2">Closeness triggered their alarm. This is them self-regulating, not rejecting you.</div>
      <div class="translate-cell col3">Don't chase. Stay steady. They'll return.</div>
    </div>
    <div class="translate-row">
      <div class="translate-cell col1">Come back warm after going cold</div>
      <div class="translate-cell col2">They regulated and missed you, the connection is real, even if the pattern is painful</div>
      <div class="translate-cell col3">Welcome them warmly. Don't punish.</div>
    </div>
  </div>`}

  <div class="two-col" style="margin-top:12px;">
    <div class="card bg-navy">
      <div class="card-title ac-navy">What They Actually Need From You</div>
      <ul class="bullet-list">
        <li><span class="bullet-dot" style="background:var(--navy)"></span><span>Consistency and predictability, no games</span></li>
        <li><span class="bullet-dot" style="background:var(--navy)"></span><span>Space given freely, not punished</span></li>
        <li><span class="bullet-dot" style="background:var(--navy)"></span><span>Low-pressure connection, warmth without demand</span></li>
        <li><span class="bullet-dot" style="background:var(--navy)"></span><span>You to stay calm when they pull back</span></li>
      </ul>
    </div>
    <div class="card bg-rose">
      <div class="card-title ac-rose">What Makes It Worse</div>
      <ul class="bullet-list">
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>Emotional intensity or urgency</span></li>
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>Chasing them when they need space</span></li>
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>Making them feel guilty for their needs</span></li>
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>Threats, even unmeant ones</span></li>
      </ul>
    </div>
  </div>
</div>

<!-- ═══ PAGE 4B: THE NEED BENEATH THE TRIGGER ═══════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">4</div>
    <div class="page-header-content">
      <div class="page-header-label ac-amber">The Need Beneath</div>
      <div class="page-header-title">What You Actually Need</div>
      <div class="page-header-sub">A trigger is an alarm. This is what the alarm is really asking for, and how to answer it yourself.</div>
    </div>
  </div>

  <div class="insec-block">
    <div class="insec-label">The Insecurity Underneath</div>
    <p>${esc(insecurity || 'Underneath the trigger, your attachment system is asking one simple question: am I safe with you, and do I matter to you? The reaction feels big because the question is big.')}</p>
  </div>

  <div class="section-label">The Nine Core Attachment Needs</div>
  <div class="needs-wrap">${needPillsHTML}</div>
  ${pickedLabels.length ? `<div class="needs-note">Reading what you shared, the needs underneath your trigger are: <b>${pickedLabels.map(l => esc(l)).join(' &middot; ')}</b>. Keep those in mind. Every step below is about getting them met the secure way.</div>` : ''}

  <div class="section-label">When You're Triggered, Do This</div>
  ${triggeredSteps.map((s, i) => `<div class="cyc-ask"><div class="cyc-ask-num">${i + 1}</div><div class="cyc-ask-text">${esc(s)}</div></div>`).join('')}

  <div class="section-label">The Inner Dialogue Shift</div>
  ${innerDialogue.map(d => `<div class="dlg-pair"><div class="dlg-instead">Instead of: &ldquo;${esc(d.instead || '')}&rdquo;</div><div class="dlg-try"><span class="arrow">&rarr;</span> Try: &ldquo;${esc(d.try || '')}&rdquo;</div></div>`).join('')}

  <div class="section-label">The Secure Way to Cope</div>
  <div class="secure-block">
    <p>${esc(secureCope || 'Soothe your body first and speak second. Regulate yourself, then reach out once, warmly and without pressure, naming the need underneath instead of protesting what they did.')}</p>
  </div>
</div>

<!-- ═══ PAGE 5: STOP THESE FIRST ═══════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">5</div>
    <div class="page-header-content">
      <div class="page-header-label ac-rose">Stop These First</div>
      <div class="page-header-title">The Do Not React List</div>
      <div class="page-header-sub">These feel like closeness to you. They feel like pressure to them. Every single time.</div>
    </div>
  </div>

  <div class="callout callout-rose">
    <div class="callout-icon">❤️</div>
    <div>
      <div class="callout-title" style="color:var(--rose)">What Protest Behaviors Actually Are</div>
      <div class="callout-text">Bowlby called them protest behaviors: automatic actions your attachment system takes when it senses your person slipping away. They are not character flaws. They are ancient survival wiring. A baby cries and the caregiver comes back. That system is still running in you. The problem is that protest behaviors backfire with avoidant partners, they read emotional intensity as a threat and move further away, not closer.</div>
    </div>
  </div>

  <div class="section-label">The 5 Forms Protest Takes — Some or All May Apply to You</div>

  <ul class="step-list">
    ${PROTEST_BEHAVIORS.map(protestItem).join('')}
  </ul>

  <div class="two-col" style="margin-top:14px;">
    <div class="card bg-rose">
      <div class="card-title ac-rose">Protest in Action</div>
      <ul class="bullet-list">
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>"Hey" → "You there?" → "Are we okay?" → "Fine."</span></li>
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>Starting a fight about something unrelated</span></li>
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>Going cold and waiting to see if they notice</span></li>
        <li><span class="bullet-dot" style="background:var(--rose)"></span><span>Posting something to look wanted or fine</span></li>
      </ul>
    </div>
    <div class="card bg-teal">
      <div class="card-title ac-teal">Regulated Response (Do This)</div>
      <ul class="bullet-list">
        <li><span class="bullet-dot" style="background:var(--teal)"></span><span>One message. Phone down. Regulate first.</span></li>
        <li><span class="bullet-dot" style="background:var(--teal)"></span><span>Name the real thing: "I felt disconnected."</span></li>
        <li><span class="bullet-dot" style="background:var(--teal)"></span><span>Stay visible as yourself, not a reaction to them</span></li>
        <li><span class="bullet-dot" style="background:var(--teal)"></span><span>Say what you need once, clearly, from a calm body</span></li>
      </ul>
    </div>
  </div>

  <div class="pull-quote pq-violet" style="margin-top:12px;">
    <p>Every protest behavior makes sense. Your nervous system is doing exactly what it was built to do. The goal is not to stop feeling it. The goal is to stop acting from it.</p>
  </div>
</div>

<!-- ═══ PAGE 6: YOUR CALM SWITCH ════════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">6</div>
    <div class="page-header-content">
      <div class="page-header-label ac-teal">Before You Do Anything</div>
      <div class="page-header-title">Your Calm Switch</div>
      <div class="page-header-sub">You cannot send a calm message from a panicking body. Fix your body first.</div>
    </div>
  </div>

  <div class="gradient-highlight">
    <div class="gh-label">The Core Rule</div>
    <div class="gh-big">Get out of panic mode before you touch your keyboard.</div>
    <div class="gh-sub">Right now, your body is flooded with stress chemicals that literally shut down the thinking part of your brain. Every decision you make from this state will come from panic, not wisdom. The urgency you feel is a chemical spike. Wait for it to pass.</div>
  </div>

  <div class="callout callout-amber">
    <div class="callout-icon">⏰</div>
    <div>
      <div class="callout-title" style="color:var(--amber)">The 2-to-4-Hour Rule</div>
      <div class="callout-text">If they send a triggering message, "I need space," "I've just been busy," or even silence, you are not allowed to reply for at least 2 to 4 hours. If it's late at night, sleep on it. The urgency you feel is a stress chemical spike. It will physically pass. Give your body time to settle before you touch your keyboard.</div>
    </div>
  </div>

  <div class="section-label">How to Flip Your Body's Calm Switch</div>

  <ul class="step-list">
    <li class="step-item">
      <div class="step-num" style="background:var(--teal)">1</div>
      <div>
        <div class="step-title">The Double Inhale: Fastest Anxiety Fix Proven by Science</div>
        <div class="step-body">Two quick sniffs in through your nose, then one long slow exhale through your mouth. Repeat three times. The long exhale activates your vagus nerve, your body's built-in calm switch. Do this before replying to any message that makes your chest tight.</div>
        <div class="step-why">Why this works: Stanford researchers (Balban et al., 2023) found this is the fastest breathing technique to lower heart rate and reduce anxiety. Faster than a single deep breath.</div>
      </div>
    </li>
    <li class="step-item">
      <div class="step-num" style="background:var(--teal)">2</div>
      <div>
        <div class="step-title">Cold Water on Your Face</div>
        <div class="step-body">Splashing cold water on your cheeks triggers the diving reflex, a hard-wired response that slows your heart rate almost immediately. Under one minute. Requires nothing except a sink.</div>
        <div class="step-why">Why this works: Your body physically cannot stay in full panic mode when the diving reflex activates. It is a biological override, not a mindset shift.</div>
      </div>
    </li>
    <li class="step-item">
      <div class="step-num" style="background:var(--teal)">3</div>
      <div>
        <div class="step-title">Pull Your Energy Back to Yourself</div>
        <div class="step-body">Right now, every bit of your mental energy is pointed at them. Go somewhere. Call a friend and actually enjoy the conversation. Work on something you care about. Make your life loud enough that their silence is just one thing happening, not everything.</div>
        <div class="step-why">Why this works: When your well-being doesn't depend entirely on their behavior, the silence hurts less. You stop reacting from panic and start responding from choice.</div>
      </div>
    </li>
  </ul>

  <div class="science-block" style="margin-top:14px;">
    <div class="science-icon">🧘</div>
    <div>
      <div class="science-label">Why Your Calm Changes Everything</div>
      <div class="science-text">Human nervous systems co-regulate, meaning your physiological calm can literally help regulate another person's stress response. When you stay grounded during a pull-away, your steady energy and slow reply speed physically lower their stress hormones. You become the safe signal their nervous system has been looking for.</div>
      <div class="science-cite">Porges (2011) · Polyvagal Theory · Coan et al. (2006) · Partner Regulation fMRI Study</div>
    </div>
  </div>
</div>

<!-- ═══ PAGE 7: SCRIPTS PART 1 ══════════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">7</div>
    <div class="page-header-content">
      <div class="page-header-label ac-violet">Copy These</div>
      <div class="page-header-title">What to Say, Exactly</div>
      <div class="page-header-sub">Warm and boundaried at the same time. The energy is secure, not desperate, not cold.</div>
    </div>
  </div>

  <div class="callout callout-violet">
    <div class="callout-icon">💬</div>
    <div>
      <div class="callout-title" style="color:var(--violet)">The Energy Behind Every Script</div>
      <div class="callout-text">Secure people don't play games. But they also don't stay silent when something isn't working. They say what they need clearly, without anger, and without begging. That is the energy in every script below. Not cold. Not desperate. Secure.</div>
    </div>
  </div>

  ${scripts1.length ? scripts1.map((s, i) => scriptBlock(s, i % 2 === 0 ? 'sent' : 'sent-rose')).join('') : `
  <div class="section-label">Scenario A: They Say "I Need Space"</div>
  <div class="script-box"><div class="script-label">The Secure Script</div><div class="script-line">&ldquo;Got it. Take the time you need. I'll be here when you're ready.&rdquo;</div><div class="script-why">Why this works: You gave them what they asked for and framed it as your choice, not you sitting around waiting. That one shift changes the dynamic.</div></div>
  <div class="phone-wrap"><div class="phone-header">📱 How This Plays Out</div><div class="bubble-row"><div class="bubble received">hey i've just been feeling really overwhelmed and i think i need some space</div></div><div class="bubble-row sent"><div class="bubble sent">Got it. Take the time you need. I'll be here when you're ready.</div></div><div class="bubble-time">You said it once. Then you put the phone down.</div><div class="bubble-note">One message. No follow-up. That is the move.</div></div>

  <div class="section-label">Scenario B: After Days of Silence, They Text "Hey"</div>
  <div class="script-box"><div class="script-label">The Secure Script</div><div class="script-line">&ldquo;Hey! Been a pretty full week over here. How are you?&rdquo;</div><div class="script-why">Why this works: Warm but not dropping everything. Not punishing them. Not acting like nothing happened. Living your life. That is the most attractive version of yourself.</div></div>
  <div class="phone-wrap"><div class="phone-header">📱 How This Plays Out</div><div class="bubble-row"><div class="bubble received">Hey</div></div><div class="bubble-row sent"><div class="bubble sent">Hey! Been a pretty full week over here. How are you?</div></div><div class="bubble-time">Warm. Not desperate. Not cold.</div></div>`}
</div>

<!-- ═══ PAGE 8: SCRIPTS PART 2 ══════════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">8</div>
    <div class="page-header-content">
      <div class="page-header-label ac-violet">More Scripts</div>
      <div class="page-header-title">More Situations, More Scripts</div>
      <div class="page-header-sub">Including face-to-face conversations that actually work</div>
    </div>
  </div>

  ${scripts2.length ? scripts2.map((s, i) => scriptBlock(s, i % 2 === 0 ? 'sent-rose' : 'sent-teal')).join('') : `
  <div class="section-label">Scenario C: They Text "I Miss You" After Going Cold</div>
  <div class="script-box"><div class="script-label">The Secure Script</div><div class="script-line">&ldquo;Miss you too. Want to actually catch up? I'm free later this week.&rdquo;</div><div class="script-why">Why this works: "I miss you" with no follow-through is a breadcrumb. This acknowledges the feeling without rewarding the disappearing act.</div></div>
  <div class="phone-wrap"><div class="phone-header">📱 How This Plays Out</div><div class="bubble-row"><div class="bubble received">i miss you</div></div><div class="bubble-row sent"><div class="bubble sent-rose">Miss you too. Want to actually catch up? I'm free later this week.</div></div><div class="bubble-time">Warm, but with an ask attached. That is the difference.</div></div>`}
</div>

<!-- ═══ PAGE 8B: SCRIPTS PART 3 + FACE TO FACE ══════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">9</div>
    <div class="page-header-content">
      <div class="page-header-label ac-violet">In the Room</div>
      <div class="page-header-title">The Last Two, Plus Face to Face</div>
      <div class="page-header-sub">Texts are practice. These are for when you're in the same room.</div>
    </div>
  </div>

  ${scripts3.length ? scripts3.map((s, i) => scriptBlock(s, i % 2 === 0 ? 'sent-teal' : 'sent-navy')).join('') : `
  <div class="section-label">Scenario D: Things Felt Good, Then They Went Cold Again</div>
  <div class="script-box"><div class="script-label">The Secure Script</div><div class="script-line">&ldquo;Hey, things have felt a bit off lately and I just wanted to name it. Not trying to start anything. Just noticed. I'm here.&rdquo;</div><div class="script-why">Why this works: You named the shift calmly, no accusation, no panic. You left the door open and stepped back.</div></div>
  <div class="phone-wrap"><div class="phone-header">📱 How This Plays Out</div><div class="bubble-row"><div class="bubble received">[No reply to your last message]</div></div><div class="bubble-row sent"><div class="bubble sent-teal">Hey, things have felt a bit off lately and I just wanted to name it. Not trying to start anything. Just noticed. I'm here.</div></div><div class="bubble-time">You named it once. Then you let it breathe.</div></div>`}

  ${inPerson.length ? `
  <div class="section-label" style="margin-top:16px;">When You're Face to Face</div>
  <div class="two-col">
    ${inPerson.slice(0,4).map(inPersonCard).join('')}
  </div>` : `
  <div class="section-label" style="margin-top:16px;">When You're Face to Face</div>
  <div class="two-col">
    <div class="card bg-violet"><div class="card-title ac-violet">They Act Like Nothing Happened</div><div style="font-size:12px;font-weight:600;font-style:italic;color:#1A3020;margin-bottom:5px;">&ldquo;Hey, it's good to see you. I did notice things felt a little off lately. Just wanted to say that out loud.&rdquo;</div><div style="font-size:11px;font-weight:700;color:var(--violet);">Say it once. Calm tone. No edge. Then let it breathe.</div></div>
    <div class="card bg-violet"><div class="card-title ac-violet">They Go Distant Mid-Conversation</div><div style="font-size:12px;font-weight:600;font-style:italic;color:#1A3020;margin-bottom:5px;">&ldquo;You seem a little far away right now. Everything okay?&rdquo;</div><div style="font-size:11px;font-weight:700;color:var(--violet);">Gentle curiosity, not accusation. Check in once. If they say "I'm fine," trust it.</div></div>
    <div class="card bg-violet"><div class="card-title ac-violet">"I Don't Know If I'm Ready"</div><div style="font-size:12px;font-weight:600;font-style:italic;color:#1A3020;margin-bottom:5px;">&ldquo;I appreciate you telling me. I'm not going to push. But I'm looking for something real. So if that's not where you are, I get it. I just need to know.&rdquo;</div><div style="font-size:11px;font-weight:700;color:var(--violet);">No tears, no convincing. Steady. You mean it.</div></div>
    <div class="card bg-violet"><div class="card-title ac-violet">They Shut Down During a Conflict</div><div style="font-size:12px;font-weight:600;font-style:italic;color:#1A3020;margin-bottom:5px;">&ldquo;I can see this is hard. I'm not going anywhere. Take a few minutes if you need it. I do want us to come back to this.&rdquo;</div><div style="font-size:11px;font-weight:700;color:var(--violet);">Give space without abandoning the conversation.</div></div>
  </div>`}
</div>

<!-- ═══ PAGE 8C: THE COMPATIBILITY DISCLOSURE ═══════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">10</div>
    <div class="page-header-content">
      <div class="page-header-label ac-rose">Full Disclosure</div>
      <div class="page-header-title">Scripts Are Not Enough</div>
      <div class="page-header-sub">You paid for honesty, not comfort. So here is the part most guides leave out.</div>
    </div>
  </div>

  ${isAnxAvoPair ? `
  <div class="disc-box">
    <div class="disc-label">Read This Twice</div>
    <p class="disc-hard">Anxious attachment and avoidant attachment are incompatible attachment styles. If both people stay exactly as they are, this relationship will not work.</p>
    <p>That is not a judgment about either of you, and it is not about how much love is there. It is about what the two strategies do when they meet. One person reaches harder when they feel scared. The other pulls further back when they feel crowded. Each move is the exact thing that sets off the other, so the harder you both try in your own style, the worse it gets.</p>
    <p>Nothing in this guide changes that math. Scripts can change a conversation. Only two people changing can change a relationship.</p>
  </div>

  <div class="disc-note">
    <p><b>Incompatible does not mean doomed.</b> It means the styles cannot stay as they are and still produce a relationship that feels good. Attachment patterns are learned, which means they can be updated. Research on this pairing is consistent: when both people move toward each other, it becomes workable. The condition is both. If the goal is to make this work, both partners have to accommodate for each other.</p>
  </div>

  <div class="section-label">What Accommodating Each Other Actually Looks Like</div>
  <div class="two-col">
    <div class="accom-card" style="background:var(--lt-amber);border-color:var(--amber)">
      <div class="accom-title ac-amber">${anxSideLabel}</div>
      <ul>
        <li><span class="tick ac-amber">&bull;</span><span>Settle your body first, so contact comes from calm instead of panic</span></li>
        <li><span class="tick ac-amber">&bull;</span><span>Ask for reassurance directly instead of testing, hinting, or protesting</span></li>
        <li><span class="tick ac-amber">&bull;</span><span>Let space be space, without reading abandonment into every quiet hour</span></li>
        <li><span class="tick ac-amber">&bull;</span><span>Trust what they actually said over the story your fear writes</span></li>
      </ul>
    </div>
    <div class="accom-card" style="background:var(--lt-navy);border-color:var(--navy)">
      <div class="accom-title ac-navy">${avoSideLabel}</div>
      <ul>
        <li><span class="tick ac-navy">&bull;</span><span>Say &ldquo;I need space and I am coming back,&rdquo; instead of just going quiet</span></li>
        <li><span class="tick ac-navy">&bull;</span><span>Offer reassurance before it is asked for, in small everyday doses</span></li>
        <li><span class="tick ac-navy">&bull;</span><span>Stay in the conversation a few minutes past comfortable</span></li>
        <li><span class="tick ac-navy">&bull;</span><span>Name feelings out loud even when the words come out clumsy</span></li>
      </ul>
    </div>
  </div>

  <div class="disc-note" style="margin-top:12px">
    <p><b>If only one of you moves, the pattern does not balance. It relocates.</b> The anxious partner who does all the self-soothing goes quiet and slowly gives up. The avoidant partner who does all the stretching goes along with it and slowly resents it. One-sided effort buys time. It does not change the cycle.</p>
  </div>

  <div class="disc-choice">
    <div class="choice-label">The Real Question</div>
    <p>The question was never &ldquo;do we love each other.&rdquo; It is: are we both willing to change how we do this? If the answer is yes from both of you, everything in this guide works. If the answer is no from either of you, no script closes that gap, and you deserve to know that now rather than two years from now.</p>
  </div>
  ` : `
  <div class="disc-box">
    <div class="disc-label">Read This Twice</div>
    <p class="disc-hard">A guide can only do half the work. If both people stay exactly as they are, the pattern between you stays exactly as it is.</p>
    <p>This matters most in one specific pairing: anxious and avoidant attachment are incompatible strategies on their own. One person reaches harder when scared, the other pulls back when crowded, and each move sets off the other. That is not your exact pairing, but the same principle applies to any two people running different strategies.</p>
    <p>Scripts can change a conversation. Only two people changing can change a relationship.</p>
  </div>

  <div class="disc-note">
    <p><b>What that means for you.</b> Patterns are learned, which means they can be updated. Research on couples is consistent: change holds when both people move toward each other. If the goal is to make this work, both partners have to accommodate for each other, not just the one who bought the guide.</p>
  </div>

  <div class="section-label">What Accommodating Each Other Actually Looks Like</div>
  <div class="two-col">
    <div class="accom-card" style="background:var(--lt-amber);border-color:var(--amber)">
      <div class="accom-title ac-amber">When Someone Needs More Closeness</div>
      <ul>
        <li><span class="tick ac-amber">&bull;</span><span>Settle your body first, so contact comes from calm instead of panic</span></li>
        <li><span class="tick ac-amber">&bull;</span><span>Ask for what you need directly instead of testing or hinting</span></li>
        <li><span class="tick ac-amber">&bull;</span><span>Let space be space, without reading abandonment into it</span></li>
        <li><span class="tick ac-amber">&bull;</span><span>Trust what they actually said over the story fear writes</span></li>
      </ul>
    </div>
    <div class="accom-card" style="background:var(--lt-navy);border-color:var(--navy)">
      <div class="accom-title ac-navy">When Someone Needs More Space</div>
      <ul>
        <li><span class="tick ac-navy">&bull;</span><span>Say &ldquo;I need space and I am coming back,&rdquo; instead of going quiet</span></li>
        <li><span class="tick ac-navy">&bull;</span><span>Offer reassurance before it is asked for, in small doses</span></li>
        <li><span class="tick ac-navy">&bull;</span><span>Stay in the conversation a few minutes past comfortable</span></li>
        <li><span class="tick ac-navy">&bull;</span><span>Name feelings out loud even when the words come out clumsy</span></li>
      </ul>
    </div>
  </div>

  <div class="disc-note" style="margin-top:12px">
    <p><b>If only one of you moves, the pattern does not balance. It relocates.</b> The person doing all the accommodating goes quiet and slowly gives up, or goes along with it and slowly resents it. One-sided effort buys time. It does not change the cycle.</p>
  </div>

  <div class="disc-choice">
    <div class="choice-label">The Real Question</div>
    <p>The question was never &ldquo;do we love each other.&rdquo; It is: are we both willing to change how we do this? If the answer is yes from both of you, everything in this guide works. If the answer is no from either of you, no script closes that gap, and you deserve to know that now rather than two years from now.</p>
  </div>
  `}
</div>

<!-- ═══ PAGE 9: ACTION PLAN ═══════════════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">11</div>
    <div class="page-header-content">
      <div class="page-header-label ac-teal">Your Action Plan</div>
      <div class="page-header-title">What to Do Starting Now</div>
      <div class="page-header-sub">Concrete steps rooted in attachment science, ordered by impact.</div>
    </div>
  </div>

  <div class="section-label">Actions to Take This Week</div>

  ${actions.length ? `<div>
  ${actions.map((a, i) => `
  <div class="action-item">
    <div class="action-num">${i + 1}</div>
    <div class="action-text">${esc(a)}</div>
  </div>`).join('')}
  </div>` : `<div>
  <div class="action-item"><div class="action-num">1</div><div class="action-text">Name the cycle out loud to yourself this week. Just saying "I'm in the loop" helps interrupt it.</div></div>
  <div class="action-item"><div class="action-num">2</div><div class="action-text">Use one script from this guide in a real situation, even a low-stakes one.</div></div>
  <div class="action-item"><div class="action-num">3</div><div class="action-text">Practice the 2-4 hour rule the next time you feel the urge to reach out urgently.</div></div>
  <div class="action-item"><div class="action-num">4</div><div class="action-text">Do one thing today that has nothing to do with them. Pull your energy back to yourself.</div></div>
  <div class="action-item"><div class="action-num">5</div><div class="action-text">Write down what the last trigger felt like in your body, this builds awareness over time.</div></div>
  <div class="action-item"><div class="action-num">6</div><div class="action-text">Look into a licensed therapist who works with attachment. Even one session changes things.</div></div>
  </div>`}

  <div class="section-label" style="margin-top:14px;">Patterns to Stop</div>

  ${avoid.length ? avoid.map(a => `
  <div class="avoid-item">
    <div class="avoid-x">✕</div>
    <div class="avoid-text">${esc(a)}</div>
  </div>`).join('') : `
  <div class="avoid-item"><div class="avoid-x">✕</div><div class="avoid-text">Stop pursuing harder when they go quiet. It accelerates withdrawal every time.</div></div>
  <div class="avoid-item"><div class="avoid-x">✕</div><div class="avoid-text">Do not interpret silence as rejection before asking. You are mind-reading.</div></div>
  <div class="avoid-item"><div class="avoid-x">✕</div><div class="avoid-text">Stop apologizing for having needs. They are valid. The delivery is what to work on.</div></div>
  <div class="avoid-item"><div class="avoid-x">✕</div><div class="avoid-text">Do not have the big conversations when either of you is flooded or overwhelmed.</div></div>`}
</div>

<!-- ═══ PAGE 10: 7-DAY PLAN ══════════════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">12</div>
    <div class="page-header-content">
      <div class="page-header-label ac-violet">Your 7-Day Plan</div>
      <div class="page-header-title">One Week to Change the Pattern</div>
      <div class="page-header-sub">Small, specific, doable. One thing per day. This is how cycles break.</div>
    </div>
  </div>

  <div class="callout callout-violet" style="margin-bottom:14px;">
    <div class="callout-icon">📅</div>
    <div>
      <div class="callout-title" style="color:var(--violet)">How to Use This Plan</div>
      <div class="callout-text">Don't try to do everything at once. Do the one thing listed for that day. If you miss a day, pick up the next one. The goal isn't perfection, it's building a new pattern, one small action at a time. Real change happens in the repetition, not the intensity.</div>
    </div>
  </div>

  ${plan.length ? plan.map((day, i) => {
    const match    = day.match(/^(Day \d+):?\s*(.*)/i);
    const dayLabel = match ? match[1] : `Day ${i + 1}`;
    const dayText  = match ? match[2] : day;
    return `
    <div class="day-row">
      <div class="day-badge">${esc(dayLabel)}</div>
      <div class="day-text">${esc(dayText)}</div>
    </div>`;
  }).join('') : `
  <div class="day-row"><div class="day-badge">Day 1</div><div class="day-text">Read this blueprint from start to finish. Underline one thing that resonates. Just reading counts.</div></div>
  <div class="day-row"><div class="day-badge">Day 2</div><div class="day-text">Use one of the scripts in a low-stakes moment. Notice how it feels different.</div></div>
  <div class="day-row"><div class="day-badge">Day 3</div><div class="day-text">Write down the last time the cycle happened. What triggered it? What did you do? What would you do differently?</div></div>
  <div class="day-row"><div class="day-badge">Day 4</div><div class="day-text">Do one thing today that is purely for your own regulation, not about them. Walk, call a friend, create something.</div></div>
  <div class="day-row"><div class="day-badge">Day 5</div><div class="day-text">Practice the 2-hour rule if triggered. Notice the urge to reach out, and wait. See what changes.</div></div>
  <div class="day-row"><div class="day-badge">Day 6</div><div class="day-text">Notice when the cycle starts and name it out loud to yourself: "This is the loop." Then choose a different response.</div></div>
  <div class="day-row"><div class="day-badge">Day 7</div><div class="day-text">Reflect: What is one thing you understand now that you didn't before? Write it down. This is your earned insight.</div></div>`}

  <div class="gradient-highlight" style="margin-top:16px;">
    <div class="gh-label">Remember</div>
    <div class="gh-sub">Progress isn't linear. There will be days the old pattern wins. That doesn't mean you failed, it means you're human. Every time you catch it earlier, every time you choose a different response, you are literally rewiring how your nervous system works. That is not nothing. That is everything.</div>
  </div>
</div>

<!-- ═══ PAGE 11: THE STANDARD SETTER ════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">13</div>
    <div class="page-header-content">
      <div class="page-header-label ac-rose">The Part Nobody Talks About</div>
      <div class="page-header-title">The Standard Setter</div>
      <div class="page-header-sub">Them coming back is a starting point, not a finish line</div>
    </div>
  </div>

  <div class="callout callout-rose">
    <div class="callout-icon">🔑</div>
    <div>
      <div class="callout-title" style="color:var(--rose)">Here Is What Everyone Skips</div>
      <div class="callout-text">${(STANDARD_SETTER[partnerStyle] || STANDARD_SETTER['Dismissive-Avoidant']).callout}</div>
    </div>
  </div>

  <div class="two-col">
    <div class="card bg-teal">
      <div class="card-title ac-teal">✅ Signs of Real Change</div>
      <ul class="checklist">
        ${SIGNS_OF_CHANGE.map(s => `
        <li><div class="check-icon check-yes">✓</div><span>${s}</span></li>`).join('')}
      </ul>
    </div>
    <div class="card bg-rose">
      <div class="card-title ac-rose">⚠️ Breadcrumbs to Watch For</div>
      <ul class="checklist">
        ${BREADCRUMBS.map(b => `
        <li><div class="check-icon check-no">✕</div><span>${b}</span></li>`).join('')}
      </ul>
    </div>
  </div>

  <div class="section-label" style="margin-top:14px;">The Standard Setter Conversation</div>

  <div class="scenario-box">
    <div class="scenario-label">Have This Conversation In Person or On a Call, Not Over Text</div>
    <div class="scenario-text">${(STANDARD_SETTER[partnerStyle] || STANDARD_SETTER['Dismissive-Avoidant']).script}</div>
    <div class="scenario-explain">${(STANDARD_SETTER[partnerStyle] || STANDARD_SETTER['Dismissive-Avoidant']).explain}</div>
  </div>

  <div class="decision-row">
    <div class="decision-box" style="background:var(--lt-teal);border:1.5px solid #9CC49C;">
      <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--teal);margin-bottom:7px;">They Show Up Consistently</div>
      <div style="font-size:12px;font-weight:600;line-height:1.55;">Keep watching their actions. Words are nice. Behavior is the truth. Give it 2-4 weeks of real-world evidence before deciding.</div>
    </div>
    <div class="decision-box" style="background:var(--lt-rose);border:1.5px solid #F0C0A0;">
      <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--rose);margin-bottom:7px;">${(STANDARD_SETTER[partnerStyle] || STANDARD_SETTER['Dismissive-Avoidant']).badTitle}</div>
      <div style="font-size:12px;font-weight:600;line-height:1.55;">${(STANDARD_SETTER[partnerStyle] || STANDARD_SETTER['Dismissive-Avoidant']).badText}</div>
    </div>
  </div>

  <div class="affirmation-grid" style="margin-top:12px;">
    <div class="affirmation-card"><p>I can love someone and still decide this is not working for me.</p></div>
    <div class="affirmation-card"><p>My nervous system deserves peace. Not constant activation.</p></div>
    <div class="affirmation-card"><p>Watching their actions is not punishment. It is self-respect.</p></div>
    <div class="affirmation-card"><p>Choosing myself is not giving up. It is the most secure thing I can do.</p></div>
  </div>
</div>

<!-- ═══ PAGE 12: THE SCIENCE ════════════════════════════════════════════ -->
<div class="section-page">
  <div class="page-header">
    <div class="page-header-num">14</div>
    <div class="page-header-content">
      <div class="page-header-label" style="color:var(--muted)">The Appendix</div>
      <div class="page-header-title">The Science Behind This Guide</div>
      <div class="page-header-sub">Because "too needy" was never a diagnosis. It was a misread of your nervous system.</div>
    </div>
  </div>

  <div class="callout callout-navy" style="margin-bottom:14px;">
    <div class="callout-icon">🔬</div>
    <div>
      <div class="callout-title" style="color:var(--navy)">Why This Section Exists</div>
      <div class="callout-text">Every concept in this guide comes from real peer-reviewed research. Read this on the nights when your brain tells you your reaction is irrational. It is not. There is a reason you feel the way you do, and the science backs it up completely.</div>
    </div>
  </div>

  ${SCIENCE_CITATIONS.map(citationBlock).join('')}

  <div class="section-label" style="margin-top:14px;">Books Worth Reading</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">
    ${BOOKS.map(b => `
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:8px;">
      <span style="color:var(--rose);font-weight:900;">📚</span>
      <span style="font-size:11.5px;font-weight:700;">${b}</span>
    </div>`).join('')}
  </div>
</div>

<!-- ═══ PAGE 13: CLOSING ══════════════════════════════════════════════════ -->
<div class="section-page">
  <div style="padding: 48px 0 32px; text-align:center;">
    <div style="font-size:9px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:var(--muted);margin-bottom:16px;">BONDBLUEPRINT™</div>
    <h2 style="font-family:'Playfair Display',serif;font-size:32px;font-weight:800;color:var(--text);line-height:1.2;margin-bottom:16px;max-width:500px;margin-left:auto;margin-right:auto;">You Are Not Too Much.</h2>
    <div style="width:48px;height:3px;background:var(--rose);margin:0 auto 24px;border-radius:2px;"></div>
  </div>

  <div class="gradient-highlight" style="margin-bottom:20px;">
    <div class="gh-label">A Note From Ash</div>
    <div class="gh-sub" style="font-size:13px;line-height:1.75;">${esc(blueprint.closingMessage || `You came into this guide with a knot in your stomach. You now know why your body reacts the way it does. You know how to stop the behaviors that make things worse. You know how to calm yourself down. And you know what to say in every scenario. More than any of that: you are not too much. You are not broken. You are someone whose nervous system responds to connection the way it was built to, and who now has the tools to respond from security instead of panic.`)}</div>
  </div>

  <div class="pull-quote pq-violet">
    <p>A person with secure attachment does not stay in something that keeps their nervous system in permanent emergency mode. You were not built for a constant loop of chase and pull-away. You deserve something consistent.</p>
  </div>

  <div style="text-align:center;margin:24px 0 20px;">
    <div style="font-size:14px;font-weight:700;color:var(--muted);margin-bottom:18px;">If you want to go deeper on your specific situation with me directly:</div>
    <a href="https://stan.store/Ashcoupleseducator/p/book-a-11-call-with-me-y42st9i5" style="display:inline-block;background:#E07A3A;color:#FFFFFF;font-size:14px;font-weight:900;text-decoration:none;border-radius:100px;padding:14px 36px;letter-spacing:0.3px;">Book a 1:1 with Ash</a>
    <div style="font-size:13px;font-weight:800;color:var(--teal);margin-top:20px;">With love and attachment science, Ash · Couples Educator</div>
  </div>

  <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;">
    <span class="tag tag-violet">Attachment Science</span>
    <span class="tag tag-rose">Real Scripts</span>
    <span class="tag tag-teal">Nervous System Tools</span>
    <span class="tag tag-navy">Secure Patterns</span>
    <span class="tag tag-violet">7-Day Plan</span>
  </div>

  <div style="border-top:1px solid var(--border);padding-top:16px;text-align:center;">
    <p style="font-size:10px;font-weight:600;color:var(--muted);line-height:1.7;">BondBlueprint™ by CouplesEducator.com · For educational purposes only · Not therapy or clinical advice<br>For mental health support, consult a licensed therapist or counselor.</p>
  </div>
</div>

</div><!-- end .page -->
</body>
</html>`;
}

// ── Puppeteer PDF renderer ────────────────────────────────────────────────────
async function generateBlueprintPdf(blueprint, opts = {}) {
  const html = buildHTML(blueprint, opts);

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  const browser = await puppeteer.launch({
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1500));

    const pdf = await page.pdf({
      format:          'Letter',
      printBackground: true,
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

module.exports = { generateBlueprintPdf };
