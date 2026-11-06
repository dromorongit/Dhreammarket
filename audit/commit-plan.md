# Commit plan (read-only)

Source: `git status --sb`, `git diff --stat`, `git log --oneline -15`, `git ls-files`. No repo/index commands run.

## Working tree (branch main)
11 tracked modified, 6 untracked. Every change is pay-link related.

```
 M app/api/admin/payments/route.ts
 M app/api/vendor/payouts/route.ts
 M app/api/webhook/paystack/route.ts
 M app/dashboard/vendor/orders/page.client.tsx
 M app/dashboard/vendor/quick-sale/page.client.tsx
 M app/receipt/[token]/page.tsx
 M lib/ledger/legacy-eligibility.ts
 M lib/ledger/payout-eligibility.ts
 M lib/manual-orders.ts
 M lib/webhooks/order-webhook-handler.ts
 M prisma/schema.prisma
?? app/api/vendor/manual-orders/[orderId]/pay-link/
?? app/receipt/[token]/PaymentConfirmingNotice.tsx
?? audit/commit-plan.md
?? audit/paylink-plan.md
?? components/vendor/PayLinkButton.tsx
?? lib/webhooks/manual-order-webhook-handler.ts
?? prisma/migrations/20261104230000_make_payment_userid_nullable/
```

## Grouping
- **(1) H1 build checks:** no files modified — skip.
- **(2) M6 stock holds / Paystack amount checks:** `app/api/cron/release-expired-reservations/route.ts`, `lib/late-payment.ts`, `lib/payment-checks.ts`, `scripts/reconcile-reserved-stock.ts`, and migrations `20261104184500_add_order_stock_reserved_at` / `20261104204000_add_order_reservation_expired_at` are all tracked but **unmodified** (already committed in `14a51f7`/`15d39da`). Skip — nothing to commit.
- **(3) pay-link:** commit everything else in one commit (group 3).

## Multi-group files
- `lib/webhooks/order-webhook-handler.ts`: all hunks guard `payment.userId` for manual orders — one coherent pay-link theme. Cannot meaningfully split; whole file to group 3 (no `git add -p`).
- `prisma/schema.prisma`: `userId` nullable + `authorizationUrl` column, both pay-link migration changes — whole file to group 3.

## Do NOT commit
- `audit/paylink-plan.md` (untracked audit report)
- `audit/commit-plan.md` (this plan itself)
- `.env`, backups, `.next/`, `node_modules/` (not present in working tree)

## Exact commands (commit only group 3)
```
git add app/api/admin/payments/route.ts app/api/vendor/payouts/route.ts app/api/webhook/paystack/route.ts app/dashboard/vendor/orders/page.client.tsx app/dashboard/vendor/quick-sale/page.client.tsx app/receipt/[token]/page.tsx app/receipt/[token]/PaymentConfirmingNotice.tsx components/vendor/PayLinkButton.tsx lib/ledger/legacy-eligibility.ts lib/ledger/payout-eligibility.ts lib/manual-orders.ts lib/webhooks/manual-order-webhook-handler.ts lib/webhooks/order-webhook-handler.ts prisma/migrations/20261104230000_make_payment_userid_nullable/ prisma/schema.prisma
git add "app/api/vendor/manual-orders/[orderId]/pay-link/"
git commit -m "pay-link: expose MANUAL order pay links in vendor dashboard

- Add PayLinkButton (Send pay link / Copy link / Share on WhatsApp) gated by NEXT_PUBLIC_PAYLINK_ENABLED
- Wire button into quick-sale success and vendor orders row actions
- Receipt page shows Confirming notice when trxref/reference present and order unpaid
- Admin payments revenue includes paid MANUAL orders with a Payment row
- Payout eligibility includes paid MANUAL orders
- Paystack webhook routes MAN- references to manual-order webhook handler
- buildWhatsAppShareLink accepts optional custom text
- Make Payment.userId nullable and add authorizationUrl (migration)"
```

Note: `[...]` is pathspec glob magic in git; if bracket expansion misfires, run `git -c core.literalPathspecs=1 add ...` or escape the brackets.
