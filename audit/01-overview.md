# Dhream Market — Stage 1 Overview

**Source of truth:** repository at `C:\Users\Dromor Narh\Desktop\GithubRepos\Dhream Market`. Read-only audit; no source files modified.

## What the product does and who it is for

Dhream Market is a premium, scalable marketplace foundation for digital trade (Phase 1), positioned as "The Trusted Home of Ghanaian Trade Online" (app/layout.tsx:24-27). It is a two-sided marketplace connecting buyers (customers) with verified Ghanaian vendors selling products and services, with pay-secure checkout via Paystack. Target personas: customers, vendors, admins/super-admins, influencers, and marketing officers. Core capabilities present: authentication (roles), protected dashboards, product/service catalog, cart/checkout, orders, payments (Paystack), refunds/returns, subscriptions, vendor verification/KYC, advertising campaigns, loyalty/rewards/cashback, referrals, influencer attribution, support tickets, waitlist, homepage merchandising, SEO metadata, and analytics.

**README** (README.md): Phase 1 marketplace foundation; future phases planned for listings/cart/checkout/payments (many of which are already implemented in code beyond the README's scope).

## Tech stack, frameworks, languages, and versions

| Layer | Technology | Version | Source |
|---|---|---|---|
| Framework | Next.js (App Router) | ^14.2.35 | package.json:61 |
| Language | TypeScript | ^5.9.3 | package.json:90 |
| Runtime | React | ^18.3.1 | package.json:64-65 |
| Styling | Tailwind CSS | ^3.4.19 | package.json:70 |
| ORM / DB | Prisma + PostgreSQL | ^7.6.0 | package.json:48-49,63 |
| Auth | JWT (jsonwebtoken) + bcryptjs + jose (edge) | ^9.0.3 / ^3.0.3 / ^6.2.2 | package.json:55,59,60 |
| Payments | Paystack | lib/paystack.ts | lib/paystack.ts |
| Images/Files | Cloudinary | ^2.10.0 | package.json:56 |
| Email | Resend / Brevo (optional) | .env.example:10-17 | .env.example |
| Monitoring | Sentry (@sentry/nextjs) | 10.70.0 | package.json:52 |
| Data fetching | TanStack React Query | ^5.101.4 | package.json:53-54 |
| Testing | Vitest + Playwright | ^4.1.10 / ^1.62.0 | package.json:73,89-91 |
| Build | `next build` standalone output + `server-entry.js` | next.config.js:3 | next.config.js:3 |
| Deployment | Railway-ready (README.md:101-108) | README.md | README.md |

Node.js 18+ required (README.md:25). `type: "commonjs"` (package.json:42).

## Folder structure with one-line purpose per folder

```
/audit/             (created by this audit; reports only)
app/                Next.js App Router: UI pages + API route handlers (/api/...)
app/api/            64 API route groups: auth, orders, payment, checkout, subscription, vendor, admin, super-admin, webhook, support-ai, etc.
app/dashboard/      Role-based dashboards: admin, customer, influencer, notifications, super-admin, vendor
components/         87 UI components: Navbar, Footer, cart, wishlist, reviews, loyalty, support-ai, trust, vendor, etc.
lib/                Server utilities: auth, prisma client, Paystack, webhooks, subscriptions, support-ai, rate limiting, email, feature flags
prisma/             Prisma schema (schema.prisma, 3282 lines), migrations/, seed.ts
pages/              Legacy pages dir; only _app.tsx (Pages Router vestige)
public/             Static assets: images, videos
assets/             Brand icons/images
scripts/            49 one-off ops/migration/backfill/diagnostic scripts (tsx/node)
docs/               Operational docs: local-db, payout-ledger, returns-disputes, trust-phase-2, pre-deploy-audit, safety-net, etc.
backups/            JSON backup dumps per model (130 files); gitignored
.next/              Next.js build output (gitignored)
node_modules/       dependencies (gitignored)
.kilo/              Kilo agent configuration
.env / .env.example / .gitignore / next.config.js / tailwind.config.js / tsconfig.json / vitest.config.ts / playwright.config.ts / middleware.ts / server-entry.js
```

Note: `app/` and `pages/` coexist; App Router is the active UI layer. `pages/_app.tsx` is a Pages Router remnant.

## How to run, build, and deploy

**Install:** `npm install` (postinstall runs `prisma generate`) — package.json:29-30.

**Env setup:** `cp .env.example .env`; edit `DATABASE_URL` and `JWT_SECRET` (README.md:41-50). `.env` is gitignored (.gitignore:34).

**Required env vars (enforced at startup):** DATABASE_URL, JWT_SECRET (lib/env-validation.ts:8-9).

**Database:** `npm run db:generate` (prisma generate), `npm run db:push` (Railway) or `npm run db:migrate` (local PostgreSQL), `npm run db:seed` (tsx prisma/seed.ts) — package.json:11-15, README.md:52-57. Local dev DB via `scripts/local-db.mjs` (db:dev:up/down/reset/migrate/status).

**Dev server:** `npm run dev` → `next dev`, opens http://localhost:3000 (README.md:59-64).

**Build:** `npm run build` = `prisma generate && cross-env NODE_OPTIONS=--max-old-space-size=3584 next build && node scripts/copy-static.js` — package.json:8. Output is `output: 'standalone'` (next.config.js:3).

**Start (production):** `npm run start` = `prisma migrate deploy && cross-env NODE_OPTIONS=--max-old-space-size=768 node server-entry.js` — package.json:9. server-entry.js loads `.next/standalone/server.js`; swallows JWT-related unhandled rejections/uncaught exceptions (server-entry.js:3-51).

**Lint:** `npm run lint` → `next lint` — package.json:10.

**Tests:** `npm test` (vitest run), `npm run test:e2e` (playwright), `npm run test:all` (coverage + e2e) — package.json:21-28.

**Deployment (README):** connect GitHub to Railway; add `DATABASE_URL` and `JWT_SECRET`; deploy automatically or manually (README.md:101-108). `prisma migrate deploy` runs automatically on `npm start`.

**Seeded test accounts** (README.md:68-72): admin@dhraverse.com/admin123, vendor@dhraverse.com/vendor123, customer@dhraverse.com/customer123.

## Third-party services and integrations

- **PostgreSQL** (primary DB) via Prisma + `@prisma/adapter-pg` + `pg` pool (lib/prisma.ts:14-42).
- **Paystack** — payments, refunds, subscriptions (lib/paystack.ts, lib/verification-paystack.ts, webhooks: order, refund, subscription, verification, advertising).
- **Cloudinary** — image/video upload and delivery (lib/cloudinary.ts, scripts/upload-images-to-cloudinary.ts, upload-videos-to-cloudinary.ts; next.config.js remotePatterns res.cloudinary.com).
- **Resend / Brevo** — optional email (RESEND_API_KEY, BREVO_API_KEY in .env.example:10,16); FailedEmail retry table (schema.prisma:1825-1840).
- **Turnstile (Cloudflare)** — optional captcha (TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY, .env.example:14-15).
- **Sentry** — error/performance monitoring (@sentry/nextjs; next.config.js:179-195, gated on SENTRY_DSN).
- **Google Analytics** — client-side (components/GoogleAnalytics.tsx, gtag.ts).
- **Railway** — target deployment platform (README.md:101-108).

## Notes for next stage

Auth: cookie-based JWT (`token` cookie), verified edge-side in middleware.ts and server-side via lib/auth.ts `getServerSession`; sessions tracked in `Session` table (schema.prisma:1211). Entry points: `app/page.tsx` (homepage), `app/login`, `app/register`, `app/api/auth/*`. Middleware protects `/dashboard/:path*` and `/api/:path*` with role-based ACL (middleware.ts:8-14, 119-120).

Stopping after stage 1 for confirmation.
