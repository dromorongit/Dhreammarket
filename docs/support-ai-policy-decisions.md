# Support AI Policy Decisions

**Approved by project owner, decided Oct 9 2026**

## Approved Decisions

### 1. Return Window
**3 days from receipt.** The refund page (`app/refund/page.tsx`) is the source of truth.

### 2. Refund Timeline
- **Vendor review:** within 3 business days
- **Refund processing:** 3-5 business days after approval
- **Bank credit:** may take 10-14 business days for the bank to credit the money
- Keep the bank-credit note wherever the timeline is explained so customers are not promised faster money than banks deliver.
- **No place should say 5-7 business days.**

### 3. Cancellation
**Orders can be cancelled within 1 hour of ordering.**

### 4. Account Deletion
**Deleting an account is permanent, but audit logs and data the platform is legally required to retain are kept.** Do not claim that all data is removed.

### 5. Payouts
**Without disputes, vendors receive payouts within 2 business days.** If a dispute is being settled, the platform decides when the payout is released.

### 6. Support Channel
**The WhatsApp number and support email already in the code are the official channels.** Do not change them.

---

## Pending / POLICY GAP

The following items need policy decisions before they can be documented:

1. **What happens after the 1 hour cancellation window** — The refund page says "Orders can be cancelled before they are shipped without penalty" and "Once an order is shipped, standard return policies apply" but does not explicitly state what happens between 1 hour and shipping.

2. **What starts the 2 business day payout clock** — Is it order completion, delivery confirmation, reconciliation, or manual admin action?

3. **How long legally required records are retained** — No specific retention periods are documented.

4. **Commission rate value** — Currently configurable via `COMMISSION_CONFIG.DEFAULT_RATE` (1%) and `SuperAdminSettings.platformFee`, but no published value for vendors.

5. **KYC failure and appeal steps** — Help pages mention resubmission within 7 days but no formal appeal process is documented.

6. **Account suspension criteria** — Not documented in customer-facing policies.

7. **Chargeback process** — Not documented in customer-facing policies.

8. **Support hours** — Not documented.

9. **Data deletion and export procedure** — GDPR/privacy requirements not fully specified.

---

## Files Updated

- `lib/support-ai/knowledge-base.ts` — Static intent response text only
- `app/faq/faq-client.tsx` — Answer text only
- `lib/support-ai/dynamic-lookups.ts` — Formatting function for empty payout state