# Daily vendor sales summary — audit plan (read-only)

## Schedule
Run once per Accra day (e.g. 19:00 Africa/Accra), gated so at most one summary per vendor per day. The 5-minute cron route pattern exists at app/api/cron/low-stock-alerts/route.ts (POST, CRON_SECRET bearer auth lines 20-30, `dynamic = 'force-dynamic'`, nodejs runtime) — the actual 5-minute schedule source was not found (no vercel.json) **unverified**.

## Inputs / output per vendor
Reuse app/api/vendor/sales-summary/route.ts:39 (GET), scoped to store.userId (route.ts:69-71), period = one Accra day via validateDateRange (lib/sales-summary.ts:327) with accraDayStart/accraDayEndExclusive (lib/sales-summary.ts:182, 207). Output: SalesSummaryResult (lib/sales-summary.ts:612-636) — SalesSummaryTotals: orders, revenue, deliveryCost, profit ("Profit before other expenses", line 34), units; receivables (all-time unpaid manual sales, lib/vendor-sales-data.ts:472); refunds; topProductsByUnits/Profit (sales-summary.ts:624-625). One call ≈ 6 + N page queries (pages of 500, MAX_ORDERS_PER_REPORT 50k, vendor-sales-data.ts:64-72), constant heap. In-memory cache: lib/sales-summary-cache.ts (TTL 60s line 24, per-store key line 50, invalidateSalesSummaryCache line 87).

## Day boundary
Africa/Accra throughout (ACCRA_TIME_ZONE, lib/sales-summary.ts:29) via Intl.DateTimeFormat with dynamic offset (getZoneOffsetMinutes line 159). Accra is UTC+0 with no DST, so a day ends at 00:00 UTC — offset logic believed correct, not DST-tested for Accra **unverified**.

## 5-line evening summary (cheap inputs)
- Orders today: countVendorOrders today (vendor-sales-data.ts:414)
- Money received: revenue from same-day summary call
- Unpaid/receivable: loadVendorReceivables all-time (vendor-sales-data.ts:472)
- Orders to dispatch (status PROCESSING, schema.prisma:2737): no helper found — separate query needed **unverified**
- Low stock: Product.lowStockAlertedAt not null marks already-alerted; currently-low is `(stock - reservedQuantity) <= lowStockThreshold` (low-stock-alerts.ts:40-47); no count helper **unverified**
- Pending payout balance: computeStoreBalance available/net (lib/ledger/payout-eligibility.ts:38)

## State / idempotency
No daily-summary state exists (grep found none). Add `lastDailySummaryDate DateTime?` to VendorSettings (schema.prisma:850). Claim atomically: update where userId = X AND (lastDailySummaryDate IS NULL OR < today's Accra start); skip when 0 rows touched. Alternative: dailySummaryLog table with unique (vendorId, date).

## Delivery
- In-app: createNotification (lib/notifications.ts:101) → Notification table (schema.prisma:657), gated by shouldSendNotification (lib/notification-preferences.ts:129).
- Email: lib/email.ts sendEmail line 57 (Brevo) + getEmailTemplate wrapper line 176; copy order confirmation (line 224) pattern; dashboard link via SITE_URL/getAppUrl (line 8-10), e.g. /dashboard/vendor/sales. FailedEmail retry table exists (schema.prisma:1829). No vendor daily summary template exists.

## Vendor on/off
No daily-summary setting exists. Add to VendorSettings (notifyNewOrders/notifyLowStock pattern, schema.prisma:863-866, notificationChannels JSON line 867) and toggle in VendorSections.tsx "Notification Preferences" (lines 744-758), saved via PUT /api/settings/vendor (line 207). Default on.

## Files to change
lib/sales-summary.ts (no change, reuse), new lib/daily-summary.ts job, new app/api/cron/daily-sales-summary/route.ts, prisma schema (VendorSettings.lastDailySummaryDate), components/settings/VendorSections.tsx toggle, lib/email.ts new sendVendorDailySummaryEmail.

## Risks
- Brevo key missing → email mock-only (lib/email.ts:58-61)
- Store phone/email not normalized at storage (lib/phone.ts exists but usage unverified); no SMS/WhatsApp opt-in field
- Cache is in-memory per instance, TTL 60s
- 5-minute cron could double-fire; idempotency claim required

## WhatsApp/SMS later
Need phone normalization at write (normalizeGhanaPhoneNumber, lib/phone.ts:39), an opt-in consent field/channel flag (vendorSettings.notification_channels), and a provider adapter behind lib/notifications.ts channel enum (EMAIL|SMS|IN_APP, line 13).
