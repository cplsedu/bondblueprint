/**
 * BondBlueprint™ — Abandoned Cart Email Sequence
 *
 * Trigger:   Tag "viewed_checkout" added (CONVERTKIT_CHECKOUT_TAG_ID = 19165223)
 * Stop when: Tag "paid" added (CONVERTKIT_PAID_TAG_ID = 19165224)
 *
 * CTA link drops them straight back to the pre-checkout screen.
 */

const CART_URL = 'https://bond.coupleseducator.com?back=1';

// ── Shared pieces ────────────────────────────────────────────────────────────

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
  <p style="text-align:center;font-size:11px;color:#9A908A;line-height:1.8;margin:0">
    BondBlueprint™ · CouplesEducator.com<br>
    Psychoeducational content only, not therapy or clinical advice.<br>
    <a href="{{unsubscribe_url}}" style="color:#9A908A;text-decoration:underline">Unsubscribe</a>
  </p>
</div>
</body>
</html>`;

function header(accent = '#C4516A') {
  return `
  <div style="background:linear-gradient(135deg,#1A1030 0%,#2E1A5A 55%,#1E2D4E 100%);border-radius:14px;padding:26px 28px 22px;margin-bottom:20px">
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:3px;color:${accent};font-weight:700;text-transform:uppercase">BONDBLUEPRINT™</p>
    <div style="width:36px;height:2px;background:${accent};border-radius:2px"></div>
  </div>`;
}

function card(content) {
  return `
  <div style="background:#FFFFFF;border-radius:14px;padding:30px 28px;border:1.5px solid #DDD7CE;margin-bottom:16px">
    ${content}
  </div>`;
}

function cta(text, color) {
  return `<div style="text-align:center;margin:28px 0 8px">
    <a href="${CART_URL}" style="display:inline-block;background:${color};color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;padding:14px 36px">${text}</a>
  </div>`;
}

function callout(text, accent, bg) {
  return `<div style="background:${bg};border-left:3px solid ${accent};border-radius:0 10px 10px 0;padding:14px 18px;margin:20px 0">
    <p style="margin:0;font-size:14px;line-height:1.7;font-weight:600;color:#1E1E1E">${text}</p>
  </div>`;
}

function p(text, extra = '') {
  return `<p style="margin:0 0 14px;font-size:15px;color:#5A5450;line-height:1.75;${extra}">${text}</p>`;
}

function sig() {
  return `<p style="margin:20px 0 0;font-size:14px;color:#6B6560">Ash | Couples Educator</p>`;
}

function quote(text, name) {
  return `<div style="background:#F7F3EE;border-radius:10px;padding:14px 18px;margin:12px 0">
    <p style="margin:0 0 6px;font-size:14px;color:#1E1E1E;line-height:1.7;font-style:italic">"${text}"</p>
    <p style="margin:0;font-size:12px;color:#9A908A;font-weight:700">${name}</p>
  </div>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 1 — 1 hour after tag
// Subject: "You were right there"
// ─────────────────────────────────────────────────────────────────────────────

const email1 = {
  subject: 'You were right there',
  delay: '1 hour',
  html: WRAPPER_OPEN + header('#C4516A') + card(`
    ${p('You were right there.', 'font-size:18px;font-weight:700;color:#1E1E1E;')}

    ${p('Something made you stop on that page. And it wasn\'t random.')}

    ${p('You\'ve been feeling this for a while. The back and forth. Not knowing where you stand. The overthinking that won\'t stop, no matter how much you tell yourself to just let it go.')}

    ${p('You found something that was actually going to tell you what\'s been happening. Not a generic guide. Something built around your exact situation.')}

    ${p('That\'s still there waiting for you.')}

    ${callout('You don\'t have to start over. Just come back and finish what you started.', '#C4516A', '#FCEEF1')}

    ${cta('Get what you came for →', '#C4516A')}

    ${sig()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 2 — 24 hours after tag
// Subject: "You didn't just forget"
// ─────────────────────────────────────────────────────────────────────────────

const email2 = {
  subject: 'You didn\'t just forget',
  delay: '24 hours',
  html: WRAPPER_OPEN + header('#7C5CBF') + card(`
    ${p('You didn\'t just forget to finish this.', 'font-size:17px;font-weight:700;color:#1E1E1E;')}

    ${p('Part of you wants to finally understand what\'s been driving the pattern. Why you keep ending up here. What\'s actually going on underneath it all.')}

    ${p('And also to know what to do next.')}

    ${p('But another part of you is asking: <em>what if I go through this and nothing actually changes?</em>')}

    ${p('That\'s not doubt. That\'s someone who\'s already tried things and gotten nowhere.')}

    ${callout('Most people who get this start in the same place. Skeptical. Worn out. Not sure it\'ll be different. Then they read the breakdown of their situation and something shifts.', '#7C5CBF', '#F2EEFB')}

    ${p('You\'re not trying to fix yourself. You\'re trying to finally understand what\'s been happening, and get a clear next move.')}

    ${cta('Take another look →', '#7C5CBF')}

    ${sig()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 3 — 48 hours after tag
// Subject: "You already know how this goes"
// ─────────────────────────────────────────────────────────────────────────────

const email3 = {
  subject: 'You already know how this goes',
  delay: '48 hours',
  html: WRAPPER_OPEN + header('#2E8B8B') + card(`
    ${p('You\'ve been here before.', 'font-size:17px;font-weight:700;color:#1E1E1E;')}

    ${p('Things feel okay for a bit. Then something shifts. A message that doesn\'t land right, a moment where they pull back, or that familiar feeling of doing all the work while they stay just out of reach.')}

    ${p('And before you know it, you\'re in it again.')}

    ${p('You don\'t need more time. You don\'t need a different person. You need to understand the specific pattern that keeps replaying, and know exactly what to do when it starts.')}

    ${callout('This gives you both. The breakdown of what\'s been happening and a clear step-by-step for what to do next.', '#2E8B8B', '#EAF6F6')}

    ${p('You can keep waiting to see if it changes on its own.')}

    ${p('Or you can understand it today and go into the next conversation differently.')}

    ${cta('Change how it goes →', '#2E8B8B')}

    ${sig()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 4 — 5 days after tag
// Subject: "Here's why you probably shouldn't do this"
// ─────────────────────────────────────────────────────────────────────────────

const email4 = {
  subject: 'Here\'s why you probably shouldn\'t do this',
  delay: '5 days',
  html: WRAPPER_OPEN + header('#C4860A') + card(`
    ${p('Honestly? You might not want to go through this.', 'font-size:17px;font-weight:700;color:#1E1E1E;')}

    ${p('Because it\'s going to show you your side of the pattern. Not just theirs.')}

    ${p('It\'s going to point out the things you\'ve been doing that have been making this harder. The ways you\'ve been showing up that push people away, or pull them in too fast, or keep you stuck chasing something that keeps moving.')}

    ${p('That\'s uncomfortable. A lot of people would rather not see it.')}

    ${callout('The people who do go through it almost always say the same thing: they wish they\'d understood this sooner.', '#C4860A', '#FBF5E6')}

    ${quote('I finally understood why I kept ending up in the same situation. I thought it was them. Some of it was me. That was hard to see, but it changed everything.', 'K.T.')}

    ${quote('I used one of the scripts the same day. The conversation went completely differently than it ever had before.', 'M.R.')}

    ${quote('I\'ve tried journaling, therapy, talking to friends. This is the first thing that actually showed me what to do in the moment.', 'J.A.')}

    ${p('If you\'re not ready to look at it honestly, this isn\'t for you.')}

    ${p('But if you\'re tired of the same outcome and something in you knows you\'re part of why it keeps happening, that\'s exactly what this is for.')}

    ${p('I\'m here whenever you\'re ready.')}

    ${cta('I\'m ready →', '#C4860A')}

    ${sig()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 5 — 10 days after tag
// Subject: "One question"
// ─────────────────────────────────────────────────────────────────────────────

const email5 = {
  subject: 'One question',
  delay: '10 days',
  html: WRAPPER_OPEN + header('#6B6560') + card(`
    ${p('What actually stopped you?', 'font-size:17px;font-weight:700;color:#1E1E1E;')}

    ${p('Was it that you weren\'t sure it would help?')}

    ${p('That looking at this felt like too much right now?')}

    ${p('Or that part of you would rather not know?')}

    ${p('Usually it\'s that last one.', 'color:#1E1E1E;font-weight:700;')}

    ${p('Not because you\'re in denial. But because seeing the pattern clearly means you can\'t keep doing things the same way. And change, even change you want, can feel like a lot.')}

    ${callout('But here\'s what\'s also true: you\'re already living inside this pattern. It\'s already affecting you. Not looking at it isn\'t protecting you from it.', '#1E2D4E', '#EBF0F8')}

    ${p('If this is still sitting with you, there\'s probably a reason.')}

    ${cta('Come back to it →', '#1E2D4E')}

    ${sig()}
  `) + WRAPPER_CLOSE,
};


// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

const ABANDONED_CART_SEQUENCE = [email1, email2, email3, email4, email5];

module.exports = { ABANDONED_CART_SEQUENCE, CART_URL };

/*
── CONVERTKIT SETUP ──────────────────────────────────────────────────────────

1. Sequences → New Sequence → "BondBlueprint Abandoned Cart"

2. Add each email with these delays:
   Email 1 — immediately (or 1 hour)
   Email 2 — 1 day
   Email 3 — 2 days
   Email 4 — 5 days
   Email 5 — 10 days

3. For each step: paste the .html, use the .subject as subject line.

4. Automation A (trigger):
   Tag added = viewed_checkout (19165223)
   Action = subscribe to "BondBlueprint Abandoned Cart"

5. Automation B (stop condition):
   Tag added = paid (19165224)
   Action = unsubscribe from "BondBlueprint Abandoned Cart"

──────────────────────────────────────────────────────────────────────────────
*/
