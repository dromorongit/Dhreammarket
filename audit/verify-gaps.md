# M6 Gap Verification Audit

Read-only report. No files modified. No secret values printed — names, counts, and file paths only.

---

## Check 1: Seed accounts in production

### Verdict: safe

### Evidence

- `prisma/seed.ts:1-45` — Seeds only `subscriptionPlan` rows via upsert. Creates **no** admin, vendor, or customer accounts and sets **no** passwords.
- `package.json:7-31` — Scripts: `dev`, `build`, `start`, `postinstall` (`prisma generate`), `prepare` (`prisma generate`), `db:seed` (`tsx prisma/seed.ts`). The `seed` script is invoked only via `prisma db seed` (a manual dev command). It is **not** wired into `build`, `start`, `postinstall`, or `prepare`.
- `prisma.prisma.seed` (`package.json:34`) = `tsx prisma/seed.ts` — referenced only by the `prisma` config, not by any production lifecycle script.
- `prisma/seed.ts:1` — `import 'dotenv/config'`; reads `DATABASE_URL` from env but has no `NODE_ENV` guard. However, since it is not called by `start`/`build`/`postinstall`, it cannot run automatically in production.
- No `railway.json` or `vercel.json` found in the repo — no platform-level automatic seeding configuration detected.

### Conclusion

Seed does not create accounts with fixed passwords and is not triggered by any production lifecycle script. No password reset or account recreation script found. **Safe.**

---

## Check 2: Backups and env files in git

### Verdict: safe for git tracking; unverified for backup contents

### Evidence

- `git ls-files backups` → **0** tracked backup files.
- `git log --all --oneline -- backups` → **0** commits touching `backups/`.
- `.env` was **never** committed — not found in `git log --all --diff-filter=A --name-only -- '.env*'` and not present in working tree (`ls .env` → not found).
- `.env.example` was committed 3 times:
  - `d4dc11c6e3be8d1a9eed8ebd35677dc3c5c90575` — "feat(waitlist): add waitlist_signups migration and Super Admin view"
  - `c6be3392342878f3d24d3624582656fbef534bc0` — "Session ... checkpoint turn 0"
  - `a952ab79ec121c03bf303856514e2561c2fa1251` — "Add Brevo email variables to .env.example"
  - `.env.example` is a template/example file (no secret values).

### Backup model dumps that would contain user or payment data (filename only)

These files exist in the working tree under `backups/` but are **not tracked in git** (0 tracked, 0 commits). Model dumps containing user or payment data:

- `user.json` — user accounts (emails, names, roles)
- `payment.json` — payment records (references, amounts, statuses)
- `order.json` — orders (totals, customer info)
- `orderitem.json` — line items (prices, quantities)
- `profile.json` — user profiles
- `customerloyalty.json` — wallet balances / loyalty points
- `vendorpayout.json` — vendor payouts
- `session.json` — user sessions
- `authtoken.json` — auth tokens
- `cart.json` / `cartitem.json` — carts
- `rewardpoints.json` / `rewardtransaction.json` / `rewardredemption.json` — rewards
- `subscriptionpayment.json` / `subscriptioninvoice.json` — subscription payments
- `refund`-related: none matched `refund*` in listing (no refund table dump visible)

### Conclusion

No backup files are tracked in git (0 tracked, 0 commits), and `.env` was never committed (only `.env.example` template, 3 commits). Backup JSON dumps exist in the working tree only and include `user.json`, `payment.json`, `order.json`, and others containing personal/payment data. **Git tracking: safe. Backup file contents: unverified** (contents not inspected per rules).

---

## Check 3: Server-side payment verification

### Verdict: risk

### Evidence

**`app/api/payment/verify/route.ts`:**
- Line 84: Calls `verifyPaystackPayment(reference)` which uses `PAYSTACK_SECRET_KEY` (`lib/paystack.ts:159-195`) — server-side verification with secret key: **yes**.
- Line 75: Checks `payment.userId !== payload.userId` — verifies the authenticated caller owns the payment/order: **yes**.
- Lines 96-97: Compares `paystackAmountGhs` to `payment.amount` (amount check): **yes**, but...
- Lines 98-118: On amount mismatch, it **logs and audit-logs only** — it does **NOT** reject or return an error. Payment processing continues despite the mismatch: **risk**.
- Currency: Not compared between Paystack response and database record: **gap**.
- Client-trusted status/amount: The route reads `paystackResponse.data.status` and `paystackResponse.data.amount` from Paystack's API (server-side), not from the client body (which only sends `reference`, line 45): **does not trust client status/amount**.

**`lib/webhooks/order-webhook-handler.ts`:**
- Line 32: Verifies Paystack webhook signature via HMAC-SHA512 with `PAYSTACK_SECRET_KEY` (`lib/paystack.ts:13-28`) — authenticates the webhook source: **yes**.
- Line 55: Calls `verifyPaystackPayment(reference)` — server-side re-verification with secret key: **yes**.
- Lines 58-65: Compares `paystackAmountGhs` to `payment.amount` — but on mismatch, only logs and audit-logs, continues processing: **risk** (same as verify route).
- Currency: Not compared: **gap**.
- Caller ownership: Webhook is server-to-server; no caller to check (signature authenticates source instead): **N/A for webhook**.

### Suggested fix

In both `app/api/payment/verify/route.ts` and `lib/webhooks/order-webhook-handler.ts`, when `Math.abs(paystackAmountGhs - payment.amount) > 0.01` (lines 97/59), **return a 400 error** instead of continuing. Also compare `paystackResponse.data.currency` to `payment.currency` and reject on mismatch. This prevents fulfilling orders where the amount paid differs from the order total.

---

## Summary

| Check | Verdict |
|-------|---------|
| 1. Seed accounts in production | safe |
| 2. Backups and env files in git | safe (git tracking) / unverified (backup contents) |
| 3. Server-side payment verification | risk |
