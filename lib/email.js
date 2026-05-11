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
  <div style="background:linear-gradient(135deg,#0F1A10 0%,#1E3526 55%,#2C4A35 100%);border-radius:14px;padding:26px 28px 22px;margin-bottom:20px">
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:3px;color:#E07A3A;font-weight:700;text-transform:uppercase">BONDBLUEPRINT™</p>
    <div style="width:36px;height:2px;background:#E07A3A;border-radius:2px"></div>
  </div>

  <!-- Body -->
  <div style="background:#FFFFFF;border-radius:14px;padding:30px 28px;border:1.5px solid #DDD7CE;margin-bottom:16px">
    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1E1E1E;">Hey ${firstName},</p>

    <p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1E1E1E;line-height:1.4;">Your BondBlueprint is ready.</p>

    <p style="margin:0 0 14px;font-size:15px;color:#5A5450;line-height:1.75;">
      Congratulations on choosing yourself. That decision takes more courage than most people realize, and you made it.
    </p>

    <p style="margin:0 0 14px;font-size:15px;color:#5A5450;line-height:1.75;">
      Your Blueprint is attached as a PDF. The scripts, the 7-day plan, the breakdown of what's actually been happening — all of it was built from what you shared. It's yours.
    </p>

    <!-- Tips callout -->
    <div style="background:#FDF0E6;border-left:3px solid #E07A3A;border-radius:0 10px 10px 0;padding:16px 20px;margin:20px 0">
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#E07A3A;text-transform:uppercase;letter-spacing:1.5px">Where to start</p>
      <p style="margin:0 0 7px;font-size:14px;color:#1E1E1E;line-height:1.65;font-weight:600">Scripts first. Use one today.</p>
      <p style="margin:0 0 7px;font-size:14px;color:#1E1E1E;line-height:1.65;font-weight:600">Then read what's actually been happening and why.</p>
      <p style="margin:0 0 7px;font-size:14px;color:#1E1E1E;line-height:1.65;font-weight:600">Work through the 7-day plan when you're ready.</p>
      <p style="margin:0;font-size:14px;color:#1E1E1E;line-height:1.65;font-weight:600">Save it. You'll want to come back to it.</p>
    </div>

    <p style="margin:0 0 14px;font-size:15px;color:#5A5450;line-height:1.75;">
      If you want to go deeper on any of this, you can book a 1:1 with me directly. No distractions, just us working through your situation together.
    </p>

    <div style="text-align:center;margin:28px 0 8px">
      <a href="https://stan.store/Ashcoupleseducator/p/book-a-11-call-with-me-y42st9i5" style="display:inline-block;background:#E07A3A;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;padding:14px 36px">Book a 1:1 with Ash →</a>
    </div>

    <p style="margin:20px 0 0;font-size:14px;color:#6B6560">Ash | Couples Educator</p>
  </div>

  <!-- Footer -->
  <p style="text-align:center;font-size:11px;color:#9A908A;line-height:1.8;margin:0">
    BondBlueprint™ · CouplesEducator.com<br>
    Psychoeducational content only, not therapy or clinical advice.
  </p>

</div>
</body>
</html>`;

  const emailPayload = { from: FROM, to, subject, html };
  if (pdfBuffer) {
    emailPayload.attachments = [{ filename: 'Bond-Blueprint.pdf', content: pdfBuffer.toString('base64') }];
  }

  const { data, error } = await resend.emails.send(emailPayload);

  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  return data;
}

async function sendOwnerNotificationEmail({ email, name, attachmentStyle, partnerStyle, amount, source, situation, pdfBuffer }) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="margin:0;padding:0;background:#FAF7F3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px 40px">

  <!-- Compact banner -->
  <div style="background:linear-gradient(135deg,#0F1A10 0%,#1E3526 55%,#2C4A35 100%);border-radius:14px;padding:16px 24px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
    <div>
      <p style="margin:0 0 2px;font-size:9px;letter-spacing:3px;color:#E07A3A;font-weight:700;text-transform:uppercase">KA-CHING</p>
      <p style="margin:0;font-size:18px;color:#fff;font-weight:800">New BondBlueprint Sale <span style="color:#E07A3A">${amount}</span></p>
    </div>
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

  const ownerPayload = {
    from:    FROM,
    to:      'ash@coupleseducator.com',
    subject: `New sale: ${name || email} bought a BondBlueprint (${amount})`,
    html
  };
  if (pdfBuffer) {
    ownerPayload.attachments = [{ filename: `Blueprint-${(name || email).replace(/[^a-z0-9]/gi, '-')}.pdf`, content: pdfBuffer.toString('base64') }];
  }
  const { data, error } = await resend.emails.send(ownerPayload);

  if (error) throw new Error(`Owner notify error: ${JSON.stringify(error)}`);
  return data;
}

async function sendClaimReminderEmail({ to, piId, type, origin }) {
  const claimUrl = `${origin}/v2/confirm?payment_intent=${piId}`;
  const isFirst  = type === '1hr';

  const subject = isFirst
    ? "Your BondBlueprint is waiting for you"
    : "Your blueprint is still yours whenever you're ready";

  const headline = isFirst
    ? "No worries, it's right there waiting for you."
    : "Your blueprint is still there.";

  const body = isFirst
    ? `You already got your BondBlueprint. It just needs a few honest answers from you before I can build it and send it your way.<br><br>It takes about 2 minutes. Click below and I'll get it done.`
    : `It's been a week, and your BondBlueprint is still sitting there ready to be built. It's yours. I just need a few answers from you so I can personalize it and send it straight to your inbox.<br><br>Whenever you're ready, it's waiting.`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 16px 40px">

  <div style="background:linear-gradient(135deg,#0F1A10 0%,#1E3526 55%,#2C4A35 100%);border-radius:14px;padding:26px 28px 22px;margin-bottom:20px">
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:3px;color:#E07A3A;font-weight:700;text-transform:uppercase">BONDBLUEPRINT™</p>
    <div style="width:36px;height:2px;background:#E07A3A;border-radius:2px"></div>
  </div>

  <div style="background:#FFFFFF;border-radius:14px;padding:30px 28px;border:1.5px solid #DDD7CE;margin-bottom:16px">
    <p style="margin:0 0 16px;font-size:17px;font-weight:800;color:#1E1E1E;line-height:1.3">${headline}</p>

    <p style="margin:0 0 14px;font-size:15px;color:#5A5450;line-height:1.75">${body}</p>

    <div style="text-align:center;margin:28px 0 8px">
      <a href="${claimUrl}" style="display:inline-block;background:#E07A3A;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;padding:14px 36px">Build My Blueprint Now</a>
    </div>

    <p style="margin:20px 0 0;font-size:13px;color:#9A908A;line-height:1.6">
      If the button doesn't work, copy and paste this link:<br>
      <a href="${claimUrl}" style="color:#2C4A35;word-break:break-all">${claimUrl}</a>
    </p>

    <p style="margin:16px 0 0;font-size:14px;color:#6B6560">Ash | Couples Educator</p>
  </div>

  <p style="text-align:center;font-size:11px;color:#9A908A;line-height:1.8;margin:0">
    BondBlueprint™ · CouplesEducator.com<br>
    You're receiving this because you purchased a BondBlueprint. Reply to unsubscribe.
  </p>

</div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  return data;
}

// Abandoned cart reminder — person entered email at checkout but never purchased
async function sendAbandonedCartEmail({ to, origin }) {
  const quizUrl = `${origin}/quiz`;
  const subject = "You started something — your blueprint is still here";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 16px 40px">

  <div style="background:linear-gradient(135deg,#0F1A10 0%,#1E3526 55%,#2C4A35 100%);border-radius:14px;padding:26px 28px 22px;margin-bottom:20px">
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:3px;color:#E07A3A;font-weight:700;text-transform:uppercase">BONDBLUEPRINT™</p>
    <div style="width:36px;height:2px;background:#E07A3A;border-radius:2px"></div>
  </div>

  <div style="background:#FFFFFF;border-radius:14px;padding:30px 28px;border:1.5px solid #DDD7CE;margin-bottom:16px">
    <p style="margin:0 0 16px;font-size:17px;font-weight:800;color:#1E1E1E;line-height:1.3">Hey — you left before you finished.</p>

    <p style="margin:0 0 14px;font-size:15px;color:#5A5450;line-height:1.75">
      You started looking into your relationship pattern, which already shows a lot of self-awareness. Most people never get that far.
    </p>

    <p style="margin:0 0 14px;font-size:15px;color:#5A5450;line-height:1.75">
      If you're ready, your BondBlueprint is one step away. It's a fully personalized guide built from your specific situation — real scripts, a 7-day plan, and a breakdown of what's actually been happening between you two.
    </p>

    <div style="background:#F3F8F4;border-left:3px solid #2C4A35;border-radius:0 10px 10px 0;padding:16px 20px;margin:20px 0">
      <p style="margin:0;font-size:14px;color:#1E1E1E;line-height:1.65;font-weight:600">Takes about 2 minutes to fill out. Blueprint arrives in your inbox right after.</p>
    </div>

    <div style="text-align:center;margin:28px 0 8px">
      <a href="${quizUrl}" style="display:inline-block;background:#E07A3A;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;padding:14px 36px">Get My Blueprint →</a>
    </div>

    <p style="margin:20px 0 0;font-size:14px;color:#6B6560">Ash | Couples Educator</p>
  </div>

  <p style="text-align:center;font-size:11px;color:#9A908A;line-height:1.8;margin:0">
    BondBlueprint™ · CouplesEducator.com<br>
    You're receiving this because you entered your email on our site. Reply to unsubscribe.
  </p>

</div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  return data;
}

function formatStyleLabel(code) {
  const map = { AA:'Anxious', DA:'Avoidant', FA:'Fearful-Avoidant', SA:'Secure' };
  return map[code] || code || 'Unknown';
}

module.exports = { sendBlueprintEmail, sendOwnerNotificationEmail, sendClaimReminderEmail, sendAbandonedCartEmail };
