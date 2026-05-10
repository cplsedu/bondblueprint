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

// Valid email: has @ with something before it, a domain, and a TLD of 2+ chars
const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
// Test/internal emails to exclude from analytics
const TEST_EMAILS = ['ashleyohnosoto@gmail.com', 'hayatohori96@gmail.com', 'test@gmail.com'];

async function getAnalytics({ from, to }) {
  const fromISO = new Date(from).toISOString();
  const toISO   = new Date(to + 'T23:59:59').toISOString();

  const [{ data: purchases }, { data: leadsRaw }] = await Promise.all([
    // Only count real paid purchases (amount > 0 filters out $0 test orders)
    supabase.from('purchases').select('amount_cents, created_at, email, status').eq('status', 'completed').gt('amount_cents', 0).gte('created_at', fromISO).lte('created_at', toISO).order('created_at', { ascending: false }),
    supabase.from('leads').select('email, created_at, attachment_style').gte('created_at', fromISO).lte('created_at', toISO),
  ]);

  const purchaseList = purchases || [];

  // Filter leads: valid email format only, exclude test emails
  const realLeads = (leadsRaw || []).filter(l =>
    VALID_EMAIL_RE.test(l.email) && !TEST_EMAILS.includes(l.email.toLowerCase())
  );

  const revenue = purchaseList.reduce((s, p) => s + (p.amount_cents || 0), 0);

  // Group by day
  const dayMap = {};
  realLeads.forEach(l => {
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

  // Style breakdown (real leads only)
  const styleMap = {};
  realLeads.forEach(l => {
    const s = l.attachment_style || 'Unknown';
    styleMap[s] = (styleMap[s] || 0) + 1;
  });
  const styleBreakdown = Object.entries(styleMap).map(([style, count]) => ({ style, count })).sort((a, b) => b.count - a.count);

  const leadCount = realLeads.length;
  return {
    leads:          leadCount,
    purchases:      purchaseList.length,
    revenue,
    conversionRate: leadCount ? ((purchaseList.length / leadCount) * 100).toFixed(1) : '0.0',
    avgOrderValue:  purchaseList.length ? Math.round(revenue / purchaseList.length) : 0,
    dailyStats,
    styleBreakdown,
    recentPurchases: purchaseList.slice(0, 20).map(p => ({ email: p.email, amount: p.amount_cents, date: p.created_at.slice(0, 10) })),
  };
}

async function getUnclaimedPurchasesForReminder(type) {
  const now          = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const cutoff = type === '1hr'
    ? new Date(now.getTime() -       60 * 60 * 1000).toISOString()
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('status', 'completed')
    .lte('created_at', cutoff)
    .gte('created_at', thirtyDaysAgo);

  if (error) throw error;

  const reminderKey = type === '1hr' ? '_r1' : '_r7';
  return (data || []).filter(p =>
    p.blueprint_data?._pending === true &&
    !p.blueprint_data?.[reminderKey]
  );
}

async function markReminderSent(stripeSessionId, type) {
  const purchase = await getPurchaseBySession(stripeSessionId);
  if (!purchase) return;

  const reminderKey = type === '1hr' ? '_r1' : '_r7';
  const updated     = { ...(purchase.blueprint_data || {}), [reminderKey]: true };

  const { error } = await supabase
    .from('purchases')
    .update({ blueprint_data: updated })
    .eq('stripe_session_id', stripeSessionId);

  if (error) throw error;
}

async function getCustomerServiceData() {
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('status', 'completed')
    .gt('amount_cents', 0)   // exclude $0 test purchases
    .order('created_at', { ascending: false });

  if (error) throw error;

  const now         = Date.now();
  const allPurchases = purchases || [];
  const unclaimed   = allPurchases.filter(p => p.blueprint_data?._pending === true);
  const claimed     = allPurchases.filter(p => p.blueprint_data?._pending !== true);

  // Fetch lead style data for claimed purchases
  const claimedEmails = [...new Set(claimed.map(p => p.email))];
  let leadMap = {};
  if (claimedEmails.length) {
    const { data: leads } = await supabase
      .from('leads')
      .select('email, attachment_style, partner_style, name')
      .in('email', claimedEmails);
    (leads || []).forEach(l => { leadMap[l.email] = l; });
  }

  return {
    summary: {
      totalPurchased:  allPurchases.length,
      unclaimed:       unclaimed.length,
      claimed:         claimed.length,
      emailsDelivered: allPurchases.filter(p => p.email_sent).length,
    },
    unclaimed: unclaimed.map(p => ({
      email:        p.email,
      purchaseDate: p.created_at,
      daysWaiting:  Math.floor((now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      r1Sent:       !!p.blueprint_data?._r1,
      r7Sent:       !!p.blueprint_data?._r7,
      amount:       p.amount_cents,
    })),
    claimed: claimed.map(p => {
      const lead = leadMap[p.email] || {};
      return {
        email:           p.email,
        name:            lead.name            || '',
        purchaseDate:    p.created_at,
        attachmentStyle: lead.attachment_style || '',
        partnerStyle:    lead.partner_style    || '',
        delivered:       !!p.email_sent,
        amount:          p.amount_cents,
      };
    }),
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
  getAnalytics,
  getUnclaimedPurchasesForReminder,
  markReminderSent,
  getCustomerServiceData
};
