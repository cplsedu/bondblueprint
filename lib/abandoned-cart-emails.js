/**
 * BondBlueprint™ — Abandoned Cart Email Sequence
 *
 * Set these up in ConvertKit as a Sequence triggered by the
 * "viewed_checkout" tag (CONVERTKIT_CHECKOUT_TAG_ID).
 *
 * Remove someone from the sequence when they receive the
 * "paid" tag (CONVERTKIT_PAID_TAG_ID) — set this as an
 * exclusion filter on each sequence step in ConvertKit.
 *
 * CTA link: https://bond.coupleseducator.com?back=1
 * (drops them straight to the pre-checkout screen)
 */

const CART_URL = 'https://bond.coupleseducator.com?back=1';

// ─── Shared layout helpers ────────────────────────────────────────────────────

const WRAPPER_OPEN = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<div style="max-width:560px;margin:0 auto;padding:28px 16px 40px">`;

const WRAPPER_CLOSE = `
  <!-- Footer -->
  <p style="text-align:center;font-size:11px;color:#9A908A;line-height:1.8;margin:0">
    BondBlueprint™ · CouplesEducator.com<br>
    Psychoeducational content only — not therapy or clinical advice.<br>
    <a href="{{unsubscribe_url}}" style="color:#9A908A;text-decoration:underline">Unsubscribe</a>
  </p>
</div>
</body>
</html>`;

function header({ label = 'BONDBLUEPRINT™', accent = '#C4516A' }) {
  return `
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1A1030 0%,#2E1A5A 55%,#1E2D4E 100%);border-radius:14px;padding:26px 28px 22px;margin-bottom:20px;position:relative;overflow:hidden">
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:3px;color:${accent};font-weight:700;text-transform:uppercase">${label}</p>
    <div style="width:36px;height:2px;background:${accent};border-radius:2px"></div>
  </div>`;
}

function card(content) {
  return `
  <!-- Body -->
  <div style="background:#FFFFFF;border-radius:14px;padding:30px 28px;border:1.5px solid #DDD7CE;margin-bottom:16px">
    ${content}
  </div>`;
}

function ctaButton({ text, url, color = '#7C5CBF' }) {
  return `
    <div style="text-align:center;margin:28px 0 8px">
      <a href="${url}" style="display:inline-block;background:${color};color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;padding:14px 36px;letter-spacing:0.3px">${text}</a>
    </div>`;
}

function signature() {
  return `
    <p style="margin:24px 0 0;font-size:14px;color:#6B6560;line-height:1.6">— Ashley</p>`;
}

function p(text, { mt = '0', mb = '18px', color = '#5A5450', size = '15px', weight = '400' } = {}) {
  return `<p style="margin:${mt} 0 ${mb};font-size:${size};color:${color};line-height:1.75;font-weight:${weight}">${text}</p>`;
}

function bold(text) { return `<strong style="color:#1E1E1E;font-weight:700">${text}</strong>`; }
function em(text)   { return `<em style="font-style:italic">${text}</em>`; }

function callout({ icon = '', text, accent = '#7C5CBF', bg = '#F2EEFB' }) {
  return `
    <div style="background:${bg};border-left:3px solid ${accent};border-radius:0 10px 10px 0;padding:14px 18px;margin:20px 0">
      <p style="margin:0;font-size:14px;color:#3A2060;line-height:1.7;font-weight:600">${icon ? icon + '&nbsp;&nbsp;' : ''}${text}</p>
    </div>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 1 — You Were Already Moving (send 1–2 hours after tag)
// Subject: "You didn't finish this"
// ─────────────────────────────────────────────────────────────────────────────

const email1 = {
  subject: 'You didn\'t finish this',
  delay: '1 hour',
  html: WRAPPER_OPEN + header({ accent: '#C4516A' }) + card(`
    ${p('You were right there.', { mb: '16px', color: '#1E1E1E', size: '18px', weight: '700' })}

    ${p('Something made you pause on that page. And it wasn\'t an accident.')}

    ${p('You\'ve probably been feeling it for a while now — that same pattern, playing out again. The same pull. The same confusion about why it keeps going this way.')}

    ${p('You found something that was actually built around ${em('your')} situation. Not a generic attachment explainer. Not a list of tips. Something that was going to tell you specifically what\'s been happening.')}

    ${p('You didn\'t imagine it. That feeling that something was finally making sense?')}

    ${p(bold('That was real.'))}

    ${callout({ icon: '↩', text: 'You don\'t need to start over. Just pick up where you left off.', accent: '#C4516A', bg: '#FCEEF1' })}

    ${ctaButton({ text: 'Go back to it →', url: CART_URL, color: '#C4516A' })}

    ${signature()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 2 — You Know Why You Hesitated (send 24 hours after tag)
// Subject: "Be honest with yourself for a second"
// ─────────────────────────────────────────────────────────────────────────────

const email2 = {
  subject: 'Be honest with yourself for a second',
  delay: '24 hours',
  html: WRAPPER_OPEN + header({ accent: '#7C5CBF' }) + card(`
    ${p('You didn\'t just forget to finish this.', { mb: '16px', color: '#1E1E1E', size: '17px', weight: '700' })}

    ${p('Part of you wants to understand what\'s been happening. What keeps pulling you into the same dynamic, the same arguments, the same silence.')}

    ${p('But another part of you is asking: ${em('what if I go through this and nothing\'s different?')}')}

    ${p('Of course you\'d hesitate. You\'ve probably already tried things. You\'ve probably already had the conversations, made the efforts, waited for things to shift on their own.')}

    ${p('That\'s not weakness. That\'s just what it looks like when you\'ve been living inside something for too long without being able to see the full picture.')}

    ${callout({
      text: 'Most people who go through this start in the same place — unsure, skeptical, and tired of repeating patterns. Then something clicks.',
      accent: '#7C5CBF',
      bg: '#F2EEFB',
    })}

    ${p('You\'re not trying to become someone new.')}
    ${p('You\'re trying to finally understand what\'s ${bold('actually')} been happening.')}

    ${ctaButton({ text: 'Take another look →', url: CART_URL, color: '#7C5CBF' })}

    ${signature()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 3 — You've Seen This Before (send 48–72 hours after tag)
// Subject: "You've seen this before"
// ─────────────────────────────────────────────────────────────────────────────

const email3 = {
  subject: 'You\'ve seen this before',
  delay: '48 hours',
  html: WRAPPER_OPEN + header({ accent: '#2E8B8B' }) + card(`
    ${p('You\'ve probably seen this pattern before.', { mb: '16px', color: '#1E1E1E', size: '17px', weight: '700' })}

    ${p('You start to feel something real. Something that could go somewhere. Then something shifts — a text goes unanswered, someone pulls back, or you find yourself doing all the work again.')}

    ${p('And before you know it, you\'re right back in the same place.')}

    ${p('You don\'t need more time. You don\'t need a different person. You need ${bold('clarity on what\'s been driving this')} — in you, in them, and in the space between you.')}

    ${callout({
      icon: '',
      text: 'The pattern isn\'t random. It has a shape. And once you can see the shape, you can actually do something about it.',
      accent: '#2E8B8B',
      bg: '#EAF6F6',
    })}

    ${p('You can keep hoping the next time will be different.')}

    ${p('Or you can understand what\'s been underneath it this whole time.')}

    ${p(`${bold('You\'re already choosing')} — whether you realize it or not.`)}

    ${ctaButton({ text: 'Change the pattern →', url: CART_URL, color: '#2E8B8B' })}

    ${signature()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 4 — This Might Not Be For You (send 5–7 days after tag)
// Subject: "This might not be for you"
// ─────────────────────────────────────────────────────────────────────────────

const email4 = {
  subject: 'This might not be for you',
  delay: '5 days',
  html: WRAPPER_OPEN + header({ accent: '#C4860A' }) + card(`
    ${p('You might not be ready for this.', { mb: '16px', color: '#1E1E1E', size: '17px', weight: '700' })}

    ${p('And you don\'t have to be.')}

    ${p('Looking at yourself this honestly isn\'t something you force. It only works when you actually want to see it.')}

    ${p('But here\'s the thing.')}

    ${p('If something in you hasn\'t let this go — if you\'ve thought about it more than once, found yourself coming back to it — that\'s not nothing.')}

    ${callout({
      text: 'You don\'t keep coming back to something like this for no reason.',
      accent: '#C4860A',
      bg: '#FBF5E6',
    })}

    ${p('The people who do go through it usually say the same thing: ${em('I wish I\'d understood this sooner.')} Not because it magically fixed everything. Because they stopped wasting time on the wrong explanations.')}

    ${p('No pressure. The page will be there when you\'re ready.')}

    ${ctaButton({ text: 'Go back to it →', url: CART_URL, color: '#C4860A' })}

    ${signature()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 5 — What Actually Stopped You (send 10–14 days after tag)
// Subject: "What actually stopped you?"
// ─────────────────────────────────────────────────────────────────────────────

const email5 = {
  subject: 'What actually stopped you?',
  delay: '10 days',
  html: WRAPPER_OPEN + header({ accent: '#6B6560' }) + card(`
    ${p('What actually stopped you?', { mb: '16px', color: '#1E1E1E', size: '17px', weight: '700' })}

    ${p('Was it that you weren\'t sure it would work?')}
    ${p('That it felt uncomfortable to actually look at this?')}
    ${p('Or that part of you would rather not know?')}

    ${p('Usually it\'s that last one.', { color: '#1E1E1E', weight: '700' })}

    ${p('Not because you\'re avoidant or in denial. But because you\'ve probably learned that looking at things clearly sometimes means seeing something you can\'t unsee.')}

    ${p('And that\'s true. It does.')}

    ${p('But here\'s what\'s also true: ${bold('you\'re already living inside this pattern.')} It\'s already affecting how you show up, what you put up with, what you\'re afraid to ask for.')}

    ${callout({
      text: 'You\'re not protecting yourself by not looking. You\'re just staying stuck in something you could finally understand.',
      accent: '#6B6560',
      bg: '#F7F3EE',
    })}

    ${p('If it\'s still sitting in the back of your mind, it\'s probably not finished yet.')}

    ${ctaButton({ text: 'Come back to it →', url: CART_URL, color: '#1E2D4E' })}

    ${signature()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

const ABANDONED_CART_SEQUENCE = [email1, email2, email3, email4, email5];

module.exports = { ABANDONED_CART_SEQUENCE, CART_URL };

/*
─── CONVERTKIT SETUP INSTRUCTIONS ────────────────────────────────────────────

1. In ConvertKit → Sequences → New Sequence → "BondBlueprint Abandoned Cart"

2. Add each email as a step with these delays (set relative to sequence start):
   Email 1 — immediately (or 1 hour)
   Email 2 — 1 day
   Email 3 — 2 days
   Email 4 — 5 days
   Email 5 — 10 days

3. For each email step:
   - Set status to "Published"
   - Paste the HTML from ABANDONED_CART_SEQUENCE[n].html into the HTML editor
   - Use ABANDONED_CART_SEQUENCE[n].subject as the subject line

4. Trigger: Automations → New Automation
   - Trigger: "Tag is added" → tag = viewed_checkout (ID 19165223)
   - Action: "Subscribe to sequence" → BondBlueprint Abandoned Cart

5. Stop condition (IMPORTANT): Automations → New Automation
   - Trigger: "Tag is added" → tag = paid (ID 19165224)
   - Action: "Unsubscribe from sequence" → BondBlueprint Abandoned Cart
   (This stops the sequence the moment someone purchases)

─────────────────────────────────────────────────────────────────────────────
*/
