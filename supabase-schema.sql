-- BondBlueprint™ — Supabase Schema
-- Run this in the Supabase SQL Editor (https://supabase.com → your project → SQL Editor)

-- Leads: every email captured from the quiz gate
CREATE TABLE IF NOT EXISTS leads (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text        UNIQUE NOT NULL,
  name            text        DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  attachment_style text,
  partner_style   text,
  quiz_data       jsonb       DEFAULT '{}',
  situation       text        DEFAULT '',
  convertkit_id   text,
  source          text        DEFAULT 'quiz'
);

-- Purchases: every Stripe checkout session
CREATE TABLE IF NOT EXISTS purchases (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id               uuid        REFERENCES leads(id),
  email                 text        NOT NULL,
  stripe_session_id     text        UNIQUE NOT NULL,
  stripe_payment_intent text,
  amount_cents          integer,
  status                text        DEFAULT 'pending'
                                    CHECK (status IN ('pending','completed','refunded','failed')),
  blueprint_data        jsonb,
  email_sent            boolean     DEFAULT false,
  email_sent_at         timestamptz,
  created_at            timestamptz DEFAULT now(),
  completed_at          timestamptz
);

-- Index for fast webhook lookups
CREATE INDEX IF NOT EXISTS purchases_session_idx ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS leads_email_idx       ON leads(email);

-- Auto-update updated_at on leads
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row-level security: service role key bypasses these, anon key cannot read
ALTER TABLE leads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
