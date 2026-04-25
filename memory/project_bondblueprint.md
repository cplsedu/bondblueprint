---
name: BondBlueprint Production Stack
description: Full production infrastructure built for BondBlueprint™ — hosting, payments, email, analytics, and AI PDF generation
type: project
---

BondBlueprint™ is a quiz + AI-personalized PDF product at bond.coupleseducator.com. The full production stack has been built.

**Why:** User wants to sell personalized AI-generated relationship blueprints with Stripe, automated email delivery, and full funnel analytics.

**How to apply:** When making changes to this project, understand the full end-to-end flow before touching any single file.

## File Structure
- `bondblueprint-free.html` — the entire frontend (quiz, email gate, results, pre-checkout, success screens)
- `bb-server.js` — Express.js server (all API routes + Stripe webhook)
- `lib/db.js` — Supabase helpers (leads + purchases tables)
- `lib/pdf.js` — PDFKit PDF generator (renders blueprint JSON → branded PDF)
- `lib/email.js` — Resend email with PDF attachment
- `lib/marketing.js` — ConvertKit subscriber management
- `package.json` — all dependencies
- `supabase-schema.sql` — run once in Supabase SQL editor
- `.env.example` — all required environment variables

## Customer Flow
1. Landing → quiz (9 questions) → email gate (saved to Supabase + ConvertKit)
2. Results shown with attachment style combo
3. CTA → pre-checkout screen (textarea for situation description)
4. Stripe Checkout ($27, configurable via STRIPE_PRICE_ID env var)
5. Stripe webhook fires → Claude generates blueprint JSON → PDFKit renders PDF → Resend sends email
6. User redirected to `/?paid=success` → success screen shown
7. PostHog tracks every step; ConvertKit handles abandoned cart sequence

## Services Required (all free tier or transaction-only)
- **Railway** — hosts Express server (~$0-3/month from $5 free credit)
- **Supabase** — PostgreSQL database (free tier)
- **Stripe** — payments (2.9% + 30¢ per transaction, no monthly fee)
- **Resend** — transactional email with PDF (free 3,000/month)
- **ConvertKit** — email marketing + abandoned cart (free to 1,000 subscribers)
- **PostHog** — funnel analytics (free 1M events/month)
- **Domain** — bond.coupleseducator.com → Railway custom domain

## Deployment Steps (in order)
1. Run `supabase-schema.sql` in Supabase SQL editor
2. Create Stripe product + price, note the Price ID
3. Set up Resend domain (coupleseducator.com)
4. Get ConvertKit API key + form ID + create 3 tags
5. Replace `POSTHOG_API_KEY_PLACEHOLDER` in bondblueprint-free.html with real PostHog key
6. Create `.env` from `.env.example`, fill all values
7. `npm install` then push to GitHub
8. Deploy on Railway, add all env vars, set up webhook in Stripe pointing to Railway URL/api/webhook
9. Add `bond.coupleseducator.com` custom domain in Railway
10. Update DNS with CNAME at domain registrar

## Security
- Helmet.js security headers
- Rate limiting: 150 req/15min general, 12/min for AI routes, 5/min for checkout
- Stripe webhook signature verification
- Supabase Row Level Security enabled
- Input validation + truncation on all endpoints
- JSON body limit 20kb
