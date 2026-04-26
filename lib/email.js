const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || 'Ashley @ CouplesEducator <hello@coupleseducator.com>';

async function sendBlueprintEmail({ to, name, pdfBuffer, blueprintTitle, attachmentStyle, partnerStyle }) {
  const firstName = name?.split(' ')[0] || 'there';
  const subject   = `Congratulations, ${firstName}. Your BondBlueprint is ready`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<div style="max-width:560px;margin:0 auto;padding:28px 16px 40px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1A1030 0%,#2E1A5A 55%,#1E2D4E 100%);border-radius:14px;padding:30px 28px 26px;text-align:center;margin-bottom:20px">
    <p style="margin:0 0 12px;font-size:10px;letter-spacing:3px;color:#E8758A;font-weight:700;text-transform:uppercase">BONDBLUEPRINT™</p>
    <h1 style="margin:0 0 8px;font-size:21px;color:#FFFFFF;line-height:1.3;font-weight:700">${blueprintTitle || 'Your Personal Relationship Guide'}</h1>
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);font-weight:600">Your steps to a healthier relationship start here.</p>
  </div>

  <!-- Body -->
  <div style="background:#FFFFFF;border-radius:14px;padding:30px 28px;border:1.5px solid #DDD7CE;margin-bottom:16px">
    <p style="margin:0 0 16px;font-size:16px;color:#1E1E1E;font-weight:600">Hi ${firstName},</p>

    <p style="margin:0 0 16px;font-size:15px;color:#5A5450;line-height:1.75">
      Congratulations on choosing yourself. That decision takes more courage than most people realize, and you made it.
    </p>

    <p style="margin:0 0 16px;font-size:15px;color:#5A5450;line-height:1.75">
      Your Blueprint is attached as a PDF.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#5A5450;line-height:1.75">
      The scripts, the 7-day plan, the breakdown of what's actually been happening. All of it was built from what you shared. It's yours.
    </p>

    <!-- Tips callout -->
    <div style="background:#F2EEFB;border-left:3px solid #7C5CBF;border-radius:0 10px 10px 0;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#7C5CBF;text-transform:uppercase;letter-spacing:1.5px">Where to start</p>
      <p style="margin:0 0 7px;font-size:14px;color:#3A2060;line-height:1.65;font-weight:600">💬&nbsp; Scripts first. Use one today.</p>
      <p style="margin:0 0 7px;font-size:14px;color:#3A2060;line-height:1.65;font-weight:600">📖&nbsp; Then read what's actually been happening and why.</p>
      <p style="margin:0 0 7px;font-size:14px;color:#3A2060;line-height:1.65;font-weight:600">📅&nbsp; Work through the 7-day plan when you're ready.</p>
      <p style="margin:0;font-size:14px;color:#3A2060;line-height:1.65;font-weight:600">📌&nbsp; Save it. You'll want to come back to it.</p>
    </div>

    <p style="margin:0 0 20px;font-size:15px;color:#5A5450;line-height:1.75">
      If you want to go deeper on any of this, you can book a 1:1 with me directly. No distractions, just us working through your situation together.
    </p>

    <div style="text-align:center;margin:0 0 20px">
      <a href="https://stan.store/Ashcoupleseducator/p/book-a-11-call-with-me-y42st9i5" style="display:inline-block;background:#E07A3A;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:100px;padding:12px 28px">Book a 1:1 with Ash →</a>
    </div>

    <p style="margin:0;font-size:15px;color:#6B6560;line-height:1.6">Ash | Couples Educator</p>
  </div>

  <!-- Footer -->
  <p style="text-align:center;font-size:11px;color:#9A908A;line-height:1.8;margin:0">
    BondBlueprint™ · CouplesEducator.com<br>
    Psychoeducational content only, not therapy or clinical advice.<br>
    <a href="{{unsubscribe_url}}" style="color:#9A908A;text-decoration:underline">Unsubscribe</a>
  </p>

</div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from:        FROM,
    to,
    subject,
    html,
    attachments: [
      {
        filename: 'Bond-Blueprint.pdf',
        content:  pdfBuffer.toString('base64')
      }
    ]
  });

  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  return data;
}

async function sendOwnerNotificationEmail({ email, name, attachmentStyle, partnerStyle, amount, source, situation }) {
  const confettiColors = ['#E07A3A', '#D4A843', '#2C4A35', '#4A7A5A', '#FAF7F3'];
  const confettiPieces = Array.from({ length: 30 }, (_, i) => {
    const color = confettiColors[i % confettiColors.length];
    const left  = Math.round(Math.random() * 100);
    const delay = (Math.random() * 1.5).toFixed(2);
    const size  = 6 + Math.round(Math.random() * 6);
    return `<div style="position:absolute;left:${left}%;top:-${size}px;width:${size}px;height:${size}px;background:${color};border-radius:2px;animation:fall 2s ${delay}s ease-in forwards;opacity:0.9"></div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@keyframes fall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(600px) rotate(720deg);opacity:0} }
</style>
</head>
<body style="margin:0;padding:0;background:#FAF7F3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px 40px">

  <!-- Confetti banner -->
  <div style="position:relative;background:linear-gradient(140deg,#0F1A10,#1E3526,#2C4A35);border-radius:14px;padding:28px 24px 20px;text-align:center;margin-bottom:20px;overflow:hidden">
    ${confettiPieces}
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:3px;color:#E07A3A;font-weight:700;text-transform:uppercase">KA-CHING</p>
    <h1 style="margin:0 0 6px;font-size:28px;color:#fff;font-weight:800">New BondBlueprint Sale!</h1>
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);font-weight:600">${amount} just landed</p>
  </div>

  <!-- Details card -->
  <div style="background:#fff;border-radius:14px;padding:24px;border:1.5px solid #DDD7CE;margin-bottom:16px">
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid #EEE8E0">
        <td style="padding:10px 0;font-size:12px;font-weight:700;color:#9A908A;text-transform:uppercase;letter-spacing:1px;width:130px">Buyer</td>
        <td style="padding:10px 0;font-size:14px;font-weight:700;color:#1E1E1E">${name || '(no name)'}</td>
      </tr>
      <tr style="border-bottom:1px solid #EEE8E0">
        <td style="padding:10px 0;font-size:12px;font-weight:700;color:#9A908A;text-transform:uppercase;letter-spacing:1px">Email</td>
        <td style="padding:10px 0;font-size:14px;color:#1E1E1E"><a href="mailto:${email}" style="color:#2C4A35;text-decoration:none">${email}</a></td>
      </tr>
      <tr style="border-bottom:1px solid #EEE8E0">
        <td style="padding:10px 0;font-size:12px;font-weight:700;color:#9A908A;text-transform:uppercase;letter-spacing:1px">Their Style</td>
        <td style="padding:10px 0;font-size:14px;color:#1E1E1E">${formatStyleLabel(attachmentStyle)}</td>
      </tr>
      <tr style="border-bottom:1px solid #EEE8E0">
        <td style="padding:10px 0;font-size:12px;font-weight:700;color:#9A908A;text-transform:uppercase;letter-spacing:1px">Partner Style</td>
        <td style="padding:10px 0;font-size:14px;color:#1E1E1E">${formatStyleLabel(partnerStyle)}</td>
      </tr>
      <tr style="border-bottom:1px solid #EEE8E0">
        <td style="padding:10px 0;font-size:12px;font-weight:700;color:#9A908A;text-transform:uppercase;letter-spacing:1px">Amount</td>
        <td style="padding:10px 0;font-size:14px;font-weight:800;color:#2C4A35">${amount}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-size:12px;font-weight:700;color:#9A908A;text-transform:uppercase;letter-spacing:1px">Lead Source</td>
        <td style="padding:10px 0;font-size:14px;color:#1E1E1E">${source}</td>
      </tr>
    </table>

    ${situation ? `
    <div style="background:#F7F3EE;border-radius:10px;padding:14px 16px;margin-top:14px">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#9A908A;text-transform:uppercase;letter-spacing:1px">What They Wrote</p>
      <p style="margin:0;font-size:13px;color:#4A4240;line-height:1.65;font-style:italic">"${situation.replace(/"/g, '&quot;')}"</p>
    </div>` : ''}
  </div>

  <p style="text-align:center;font-size:11px;color:#9A908A">BondBlueprint™ · Owner Notification</p>
</div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from:    FROM,
    to:      'ash@coupleseducator.com',
    subject: `New sale: ${name || email} just bought a BondBlueprint (${amount})`,
    html
  });

  if (error) throw new Error(`Owner notify error: ${JSON.stringify(error)}`);
  return data;
}

function formatStyleLabel(code) {
  const map = { AA:'Anxious', DA:'Avoidant', FA:'Fearful-Avoidant', SA:'Secure' };
  return map[code] || code || 'Unknown';
}

module.exports = { sendBlueprintEmail, sendOwnerNotificationEmail };
