# Policy Alignment — Behaviour Gaps (read-only report)

Source: Dhream Market main app. Branch: `chore/policy-alignment`. No behaviour was changed; these are reported gaps between the code's behaviour under unset production env/flags and `founder_decisions`, each with a proposed patch (NOT applied).

## Conventions used in this doc

- `file:line` references are to the current tree on `chore/policy-alignment`.
- "unset env" = the relevant `process.env` value is `undefined`/empty in production, so the hard-coded default in `lib/feature-flags.ts` applies.
- No edits were made to `prisma/schema.prisma`, migrations, payment/ledger/payout/cancellation logic, flags, or defaults. Patches below are illustrative only.

---

## (a) Return window — `getReturnWindowDays` default 7; Prisma default 3; `deliveredAt` start unless `LOCATION_RETURN_WINDOW_ENABLED`

### What it governs

The number of days a customer has to start a return, and the window start date. Used by:
- `lib/returns/ui/eligibility.ts:94` — `windowDays = getReturnWindowDays()`
- `lib/returns/return-service.ts:122` — `windowDays = input.windowDays ?? getReturnWindowDays()`
- `lib/returns/return-service.ts:184` — `windowStart = postCutover ? order.completedAt : item.deliveredAt`

### What the code does today under unset env

- `getReturnWindowDays()` returns **7** (`lib/feature-flags.ts:11`) when `RETURN_WINDOW_DAYS` is unset.
- Prisma `PlatformPolicy.returnWindowDays` defaults to **3** (`prisma/schema.prisma:2663`).
- The window starts at `deliveredAt` unless `LOCATION_RETURN_WINDOW_ENABLED` is true AND the order is post-cutover (`lib/returns/return-service.ts:115-121,184`). Under unset `LOCATION_RETURN_WINDOW_ENABLED` the location-based 1-day/3-day split (`windowDaysForRegion`) is never applied.

### What founder_decisions require

- Eligible returns: not as described, damaged/defective on arrival, wrong item.
- Window: **1 day** for Greater Accra Region (Accra/Tema examples), **3 days** elsewhere.
- Counted from when the vendor marks the order **COMPLETED**.
- Applies only via the location rule; a vendor may add more customer-friendly terms.

### Proposed patch (diff, NOT applied)

```
-export function getReturnWindowDays(): number {
-  const value = process.env.RETURN_WINDOW_DAYS
-  if (value === undefined || value === null || value.trim() === '') return 7
+export function getReturnWindowDays(): number {
+  const value = process.env.RETURN_WINDOW_DAYS
+  if (value === undefined || value === null || value.trim() === '') return 3
```

plus ensure `LOCATION_RETURN_WINDOW_ENABLED=true` and `systemCutoverTimestamp` set so `return-service.ts:184` starts the window at `completedAt` and `windowDaysForRegion` applies 1 day for Greater Accra / 3 days otherwise.

### Impact on orders already in flight

Changing the default from 7 to 3 shortens the return window for orders placed while the env is unset. Orders already placed under a 7-day window would see a shorter window if re-evaluated — the founder must confirm the cutover timestamp so post-cutover orders use the new rule and pre-cutover orders keep the policy in force when placed.

### Tests needed

- `lib/returns/config.test.ts`: assert `getReturnWindowDays()` returns 3 when unset (currently asserts 7 at `lib/returns/config.test.ts:50-70`).
- `lib/returns/return-service.test.ts`: assert window starts at `completedAt` post-cutover and is 1 day for Greater Accra / 3 days otherwise when `LOCATION_RETURN_WINDOW_ENABLED=true`.

---

## (b) Payout hold — `getPayoutHoldDays` default 7 calendar days; `deliveredAt` start; empty `holidayList`; `BUSINESS_DAY_PAYOUT_ENABLED`

### What it governs

How long a vendor's payout is held after an order completes before it is eligible. Used by:
- `lib/ledger/payout-eligibility.ts:46` — `holdDays = input.holdDays ?? getPayoutHoldDays()`
- `lib/ledger/payout-create.ts:38` — `holdDays = input.holdDays ?? getPayoutHoldDays()`
- `lib/ledger/payout-eligibility.ts:49-69` — business-day path driven by `completedAt` only when `isBusinessDayPayoutEnabled()`; otherwise filters on `deliveredAt` (line 68-69).

### What the code does today under unset env

- `getPayoutHoldDays()` returns **7** calendar days (`lib/feature-flags.ts:65`) when `PAYOUT_HOLD_DAYS` is unset.
- Prisma `payoutHoldDaysAfterConfirmation` defaults to **2** (`prisma/schema.prisma:2667`).
- `holidayList` defaults to `[]` (empty) (`prisma/schema.prisma:2671`), so even with business-day payouts enabled no Ghana public holidays are excluded.
- Under unset `BUSINESS_DAY_PAYOUT_ENABLED`, eligibility is driven by `deliveredAt` not `completedAt` (`payout-eligibility.ts:68-69`).

### What founder_decisions require

- Payout within **2 business days** (Mon-Fri, excluding Ghana public holidays) after the vendor marks the order **COMPLETED**, if no open return or dispute.

### Proposed patch (diff, NOT applied)

```
-export function getPayoutHoldDays(): number {
-  const value = process.env.PAYOUT_HOLD_DAYS
-  if (value === undefined || value === null || value.trim() === '') return 7
+export function getPayoutHoldDays(): number {
+  const value = process.env.PAYOUT_HOLD_DAYS
+  if (value === undefined || value === null || value.trim() === '') return 2
```

plus enable `BUSINESS_DAY_PAYOUT_ENABLED=true` and populate `PlatformPolicy.holidayList` with Ghana public holidays so business-day calculation excludes them (`lib/returns/return-service.ts:179-180` pattern).

### Impact on orders already in flight

Changing the hold from 7 calendar days to 2 business days accelerates payout eligibility for in-flight completed orders. Orders currently mid-hold could become eligible sooner; the founder must confirm the dashboard flag values and holiday list before enabling.

### Tests needed

- `lib/ledger/payout-config.test.ts`: assert `getPayoutHoldDays()` returns 2 when unset (currently asserts 7 at `lib/ledger/payout-config.test.ts:29-50`).
- `lib/ledger/payout-eligibility.business-days.test.ts`: assert hold is computed from `completedAt` in business days excluding `holidayList` when `BUSINESS_DAY_PAYOUT_ENABLED=true`.

---

## (c) Vendor response / return review — `getVendorResponseHours` default 72; schema default 3 business days

### What it governs

The deadline by which a vendor must respond to/review a return request before escalation. Used by:
- `lib/returns/ui/status-copy.ts:19` — `The seller has ${getVendorResponseHours()} hours to respond...`
- `lib/returns/return-service.ts:175-180` — `vendorResponseHours = input.vendorResponseHours ?? getVendorResponseHours()`; if `isBusinessDayReturnReviewEnabled()` and post-cutover, `escalationDeadline = addBusinessDays(now, 1, holidays)`.

### What the code does today under unset env

- `getVendorResponseHours()` returns **72** hours (`lib/feature-flags.ts:27`) when `VENDOR_RESPONSE_HOURS` is unset — i.e. 3 calendar days.
- Prisma `vendorResponseBusinessDays` defaults to **3** business days (`prisma/schema.prisma:2664`).
- Without `BUSINESS_DAY_RETURN_REVIEW_ENABLED`, the deadline is 72 hours from `now` (calendar), not 1 business day.

### What founder_decisions require

- Vendor reviews a return request within **1 business day**.
- Note: founder also states vendor verification is 1-2 business days (shown in FAQ/help already). It is unclear whether verification and return review share one setting (`vendorResponseBusinessDays` / `getVendorResponseHours`) — see QUESTIONS.

### Proposed patch (diff, NOT applied)

Option 1 (env hours):
```
-export function getVendorResponseHours(): number {
-  const value = process.env.VENDOR_RESPONSE_HOURS
-  if (value === undefined || value === null || value.trim() === '') return 72
+export function getVendorResponseHours(): number {
+  const value = process.env.VENDOR_RESPONSE_HOURS
+  if (value === undefined || value === null || value.trim() === '') return 24
```

Option 2 (business-day rule, preferred to match "1 business day" exactly): enable `BUSINESS_DAY_RETURN_REVIEW_ENABLED=true` and set `systemCutoverTimestamp`, which makes `return-service.ts:178-180` compute a 1-business-day deadline excluding `holidayList`.

### Impact on orders already in flight

Tightening the review window from 72 hours / 3 business days to 1 business day shortens the escalation deadline for open return requests. In-flight returns awaiting vendor review would reach the dispute path sooner.

### Tests needed

- `lib/returns/config.test.ts`: assert `getVendorResponseHours()` returns 24 when unset (currently asserts 72 at `lib/returns/config.test.ts:75-95`).
- `lib/returns/return-review-overdue.test.ts`: assert escalation deadline is 1 business day excluding holidays when `BUSINESS_DAY_RETURN_REVIEW_ENABLED=true`.

---

## Exact production env / flag values the founder must confirm in the hosting dashboard

These flags/env are NOT present in `.env.example` and default to off/unsafe values in code:

| Setting | Required production value | Purpose |
|---|---|---|
| `CANCELLATION_POLICY_ENABLED` | `true` | Cancellation policy ON in production (founder decision). Defaults off (`lib/feature-flags.ts:95-99`). |
| `LOCATION_RETURN_WINDOW_ENABLED` | `true` | Enables 1-day Greater Accra / 3-day-elsewhere window from `completedAt`. Defaults off (`lib/feature-flags.ts:83-87`). |
| `BUSINESS_DAY_PAYOUT_ENABLED` | `true` | Enables 2-business-day payout from `completedAt` excluding holidays. Defaults off (`lib/feature-flags.ts:89-93`). |
| `BUSINESS_DAY_RETURN_REVIEW_ENABLED` | `true` | Enables 1-business-day vendor return review excluding holidays. Defaults off (`lib/feature-flags.ts:119-123`). |
| `RETURN_WINDOW_DAYS` | `3` | Baseline window days (location rule overrides to 1 for Greater Accra). Defaults to 7 in code. |
| `VENDOR_RESPONSE_HOURS` | `24` | Vendor return-review response hours (1 business day). Defaults to 72 in code. |
| `PAYOUT_HOLD_DAYS` | `2` | Payout hold days. Defaults to 7 calendar days in code. |
| `PlatformPolicy.systemCutoverTimestamp` | set (a past date) | Post-cutover gating for return window start at `completedAt` and business-day rules. |
| `PlatformPolicy.returnWindowDays` | `3` | Schema default is 3 (`prisma/schema.prisma:2663`); confirm dashboard override if used. |
| `PlatformPolicy.vendorResponseBusinessDays` | `1` | Schema default is 3 (`prisma/schema.prisma:2664`); confirm dashboard override if used. |
| `PlatformPolicy.payoutHoldDaysAfterConfirmation` | `2` | Schema default is 2 (`prisma/schema.prisma:2667`); confirm dashboard override if used. |
| `PlatformPolicy.holidayList` | Ghana public holidays | Schema default is `[]` (`prisma/schema.prisma:2671`); must be populated to exclude holidays. |
| `PlatformPolicy.disputeResolutionBusinessDays` | `7` | Schema default is 7 (`prisma/schema.prisma:2665`); matches founder's 7-business-day binding dispute. |
| `PlatformPolicy.refundProcessingWindowDays` | `1` | Schema default is 5 (`prisma/schema.prisma:2672`); founder requires refund within 24 hours. |

### Open questions for the founder (see QUESTIONS)

- Whether vendor verification (1-2 business days) and return review (1 business day) share `vendorResponseBusinessDays` / `getVendorResponseHours`, or are separate settings.
- Whether `refundProcessingWindowDays` (schema default 5) is the right place to encode the 24-hour refund rule, or whether `REFUND_TIMING` copy is sufficient.
- The return-reason enum (`app/api/returns/route.ts:10`, `lib/returns/return-service.ts:55`, `lib/returns/ui/reasons.ts:10`) still allows `CHANGE_OF_MIND` as a return reason, but `founder_decisions.returns` lists only not-as-described, damaged/defective, and wrong-item as eligible. This is a behaviour gap: the enum admits a reason the policy does not make eligible. Changing it is a behaviour/DB change and is out of scope for copy-only work; report to the founder.
