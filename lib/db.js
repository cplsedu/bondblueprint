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

async function getAnalytics({ from, to }) {
  const fromISO = new Date(from).toISOString();
  const toISO   = new Date(to + 'T23:59:59').toISOString();

  const [{ count: leads }, { data: purchases }, { data: leadsRaw }] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', fromISO).lte('created_at', toISO),
    supabase.from('purchases').select('amount_cents, created_at, email, status').eq('status', 'completed').gte('created_at', fromISO).lte('created_at', toISO).order('created_at', { ascending: false }),
    supabase.from('leads').select('created_at, attachment_style').gte('created_at', fromISO).lte('created_at', toISO),
  ]);

  const purchaseList = purchases || [];
  const revenue      = purchaseList.reduce((s, p) => s + (p.amount_cents || 0), 0);

  // Group by day
  const dayMap = {};
  (leadsRaw || []).forEach(l => {
    const d = l.created_at.slice(0, 10);
    if (!dayMap[d]) dayMap[d] = { date: d, leads: 0, purchases: 0, revenue: 0 };
    dayMap[d].leads++;
  });
  purchaseList.forEach(p => {
    const d = p.created_at.slice(0, 10);
    if (!dayMap[d]) dayMap[d] = { date: d, leads: 0, purchases: 0, revenue: 0 };
    dayMap[d].purchases++;
    dayMap[d].revenue += p.amount_cents || 0;
  });
  const dailyStats = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

  // Style breakdown
  const styleMap = {};
  (leadsRaw || []).forEach(l => {
    const s = l.attachment_style || 'Unknown';
    styleMap[s] = (styleMap[s] || 0) + 1;
  });
  const styleBreakdown = Object.entries(styleMap).map(([style, count]) => ({ style, count })).sort((a, b) => b.count - a.count);

  return {
    leads:          leads || 0,
    purchases:      purchaseList.length,
    revenue,
    conversionRate: leads ? ((purchaseList.length / leads) * 100).toFixed(1) : '0.0',
    avgOrderValue:  purchaseList.length ? Math.round(revenue / purchaseList.length) : 0,
    dailyStats,
    styleBreakdown,
    recentPurchases: purchaseList.slice(0, 20).map(p => ({ email: p.email, amount: p.amount_cents, date: p.created_at.slice(0, 10) })),
  };
}

module.exports = {
  upsertLead,
  updateLeadSituation,
  getLeadByEmail,
  createPurchase,
  completePurchase,
  markEmailSent,
  getPurchaseBySession,
  getAnalytics
};
