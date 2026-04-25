const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || 'Ashley @ CouplesEducator <hello@coupleseducator.com>';

async function sendBlueprintEmail({ to, name, pdfBuffer, blueprintTitle, attachmentStyle, partnerStyle }) {
  const firstName = name?.split(' ')[0] || 'there';
  const subject   = `Your BondBlueprint is ready, ${firstName}`;

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
      <a href="https://stan.store/Ashcoupleseducator/p/book-a-11-call-with-me-y42st9i5" style="display:inline-block;background:#7C5CBF;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:100px;padding:12px 28px">Book a 1:1 with Ash →</a>
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

module.exports = { sendBlueprintEmail };
