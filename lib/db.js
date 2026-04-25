const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function upsertLead({ email, name, attachmentStyle, partnerStyle, quizData, situation }) {
  const { data, error } = await supabase
    .from('leads')
    .upsert(
      {
        email:            email.toLowerCase().trim(),
        name:             name || '',
        attachment_style: attachmentStyle || null,
        partner_style:    partnerStyle || null,
        quiz_data:        quizData || {},
        situation:        situation || ''
      },
      { onConflict: 'email' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateLeadSituation(email, situation) {
  const { error } = await supabase
    .from('leads')
    .update({ situation })
    .eq('email', email.toLowerCase().trim());
  if (error) throw error;
}

async function getLeadByEmail(email) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function createPurchase({ email, stripeSessionId, amountCents }) {
  const lead = await getLeadByEmail(email);
  const { data, error } = await supabase
    .from('purchases')
    .insert({
      lead_id:          lead?.id || null,
      email:            email.toLowerCase().trim(),
      stripe_session_id: stripeSessionId,
      amount_cents:     amountCents
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function completePurchase({ stripeSessionId, paymentIntent, blueprintData }) {
  const { error } = await supabase
    .from('purchases')
    .update({
      status:           'completed',
      stripe_payment_intent: paymentIntent,
      blueprint_data:   blueprintData,
      completed_at:     new Date().toISOString()
    })
    .eq('stripe_session_id', stripeSessionId);
  if (error) throw error;
}

async function markEmailSent(stripeSessionId) {
  const { error } = await supabase
    .from('purchases')
    .update({ email_sent: true, email_sent_at: new Date().toISOString() })
    .eq('stripe_session_id', stripeSessionId);
  if (error) throw error;
}

async function getPurchaseBySession(stripeSessionId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('stripe_session_id', stripeSessionId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

module.exports = {
  upsertLead,
  updateLeadSituation,
  getLeadByEmail,
  createPurchase,
  completePurchase,
  markEmailSent,
  getPurchaseBySession
};
