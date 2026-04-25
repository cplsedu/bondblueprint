const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || 'Ashley @ CouplesEducator <hello@coupleseducator.com>';

async function sendBlueprintEmail({ to, name, pdfBuffer, blueprintTitle, attachmentStyle, partnerStyle }) {
  const firstName = name?.split(' ')[0] || 'there';
  const subject   = `Your BondBlueprint is ready, ${firstName} 💚`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1E3526,#2C4A35);border-radius:14px;padding:28px 24px;text-align:center;margin-bottom:24px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.55);font-weight:600">BONDBLUEPRINT™</p>
    <h1 style="margin:0 0 10px;font-size:20px;color:#FFFFFF;line-height:1.3">${blueprintTitle || 'Your Personal Relationship Reading'}</h1>
    ${attachmentStyle && partnerStyle ? `
    <div style="display:inline-flex;gap:10px;margin-top:6px">
      <span style="background:rgba(255,255,255,0.12);border-radius:20px;padding:4px 14px;font-size:11px;color:rgba(255,255,255,0.75);font-weight:600">${attachmentStyle}</span>
      <span style="color:rgba(255,255,255,0.4);padding-top:4px">+</span>
      <span style="background:rgba(255,255,255,0.12);border-radius:20px;padding:4px 14px;font-size:11px;color:rgba(255,255,255,0.75);font-weight:600">${partnerStyle}</span>
    </div>` : ''}
  </div>

  <!-- Body -->
  <div style="background:#FFFFFF;border-radius:14px;padding:28px 24px;border:1.5px solid #EAE3D9;margin-bottom:16px">
    <p style="margin:0 0 16px;font-size:15px;color:#1A1714">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#5A5450;line-height:1.7">
      Your personalized Bond Blueprint is attached to this email as a PDF.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#5A5450;line-height:1.7">
      Everything in it — the scripts, the 7-day plan, the insights — was generated specifically from what you shared about your situation. It's not a generic attachment guide. It's built around you.
    </p>

    <!-- Tips -->
    <div style="background:#FAF7F3;border-radius:10px;padding:18px 20px;margin:20px 0;border-left:3px solid #2C4A35">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#2C4A35;text-transform:uppercase;letter-spacing:1px">Getting the most out of it</p>
      <p style="margin:0 0 8px;font-size:14px;color:#5A5450;line-height:1.6">📌 Save the PDF somewhere easy to find</p>
      <p style="margin:0 0 8px;font-size:14px;color:#5A5450;line-height:1.6">💬 Start with the Scripts section — immediately usable</p>
      <p style="margin:0 0 8px;font-size:14px;color:#5A5450;line-height:1.6">📅 Work through the 7-day plan when you're ready</p>
      <p style="margin:0;font-size:14px;color:#5A5450;line-height:1.6">💡 Re-read the Situation Breakdown when you feel stuck</p>
    </div>

    <p style="margin:0 0 16px;font-size:15px;color:#5A5450;line-height:1.7">
      If you have any questions, just reply to this email. I read every one.
    </p>
    <p style="margin:0;font-size:15px;color:#1A1714;font-weight:600">— Ashley</p>
  </div>

  <!-- Footer -->
  <p style="text-align:center;font-size:11px;color:#9A908A;line-height:1.6;margin:0">
    CouplesEducator.com · This is psychoeducational content only, not therapy or clinical advice.<br>
    <a href="{{unsubscribe_url}}" style="color:#9A908A">Unsubscribe</a>
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
