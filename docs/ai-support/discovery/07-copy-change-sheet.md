# STAGE_F_STEP1 — Copy Change Sheet (read-only audit)

**Repo:** Dhream Market main app, branch `feat/vendor-reminders` (Next.js 14 + Prisma).  
**Step:** `STAGE_F_STEP1_COPY_CHANGE_SHEET`, mode `READ_ONLY_PLUS_TSC_FIX`.  
**Status:** Read-only. No copy, page, FAQ, email, or v1 file was edited. This is the only new file.

## Scope

Audited every location that states **returns**, **cancellation**, **payouts**, **vendor commission or fees**, **manual orders**, or **vendor verification review time**.

Sources checked:
- `app/refund/page.tsx`
- `app/payment-policy/page.tsx`
- `app/faq/page.tsx` + `app/faq/faq-client.tsx`
- `app/terms/page.tsx`
- Help pages (`app/help/**/page.tsx`) and vendor guides
- Email templates (`lib/refunds/refund-email.ts` — contains no policy copy on these topics)
- `lib/support-ai/knowledge-base.ts`
- `docs/support-ai-content-pack/` (pack.json copies source-page text; conflicts.md and gaps.json already catalogue the same findings)
- `docs/support-ai-policy-decisions.md`

## Status values

- **CONSISTENT** — the verbatim text already matches the approved decision.
- **CONFLICTS** — the verbatim text contradicts or is incomplete vs the approved decision. A plain-language PROPOSED replacement is given, using only the approved decisions.
- **LEGAL** — the location is legal text (terms / refund / payment policy). `LEGAL: FOUNDER MUST APPROVE EXACT WORDING`; the proposal is kept minimal.
- **POLICY GAP** — the site mentions the topic but the approved decisions do not cover it (missing information), or nothing on the site states it at all. A question is given.

## Approved decisions (reference)

- **Effective date:** New rules apply to orders placed on or after `[POLICY_EFFECTIVE_DATE]`, shown as a single constant (not hardcoded in many places). Earlier orders keep the previous rules.
- **Commission:** Platform commission is **1% of the product price only**, not shipping, deducted from the vendor's earnings before payout. Paystack processing fees are **added to the customer's payment** and are **not deducted from the vendor's payout**. Manual orders: **0% commission**, and the Paystack processing fee on a manual order is **paid by the vendor**.
- **Manual orders:** A manual order is created by a vendor for a sale made outside the Dhream Market catalogue (e.g. WhatsApp, Instagram, a physical shop, a walk-in). The vendor shares a payment link, the customer pays, the vendor fulfils it. For returns of manual orders, the **vendor refunds the buyer directly**. Manual orders always use the **3-day return window**.
- **Returns:** A return must be started **within 1 day of the vendor marking the order completed** if the delivery address is in the **Greater Accra Region**, and **within 3 days otherwise**. The product must be in its original condition with all packaging and tags intact. Buyers confirm receipt with the vendor, who then marks the order as completed. If a vendor marks an order completed before the buyer has received it, it can be treated as a dispute and the buyer can still return; contact human support.
- **Cancellation:** **Free within 1 hour of payment confirmation** if not shipped (cannot be cancelled once the vendor ships). After the first hour and before shipment a **GHS 5 fee** applies, deducted from the refund. **Paystack's processing fee is not refunded.** Every paid cancellation counts, including free ones. **Cancelling 4 orders within any 30 days blocks all cancellations for the next 3 months**, starting right after the 4th. **Unpaid and manual orders are exempt.** Wallet credit used on the order is returned to the wallet.
- **Payouts:** **Within 2 business days after the vendor marks the order completed**, only if there are **no open returns or disputes**. Business days are Monday to Friday and exclude Ghanaian public holidays.
- **Completion:** Vendors should mark an order completed promptly once the buyer has received the product; payouts are released only for completed orders; only mark completed after the buyer has received it.
- **Vendor verification:** Our team reviews a vendor's store verification submission within **1-2 business days**.

---

## Locations by topic

### Returns

**1. `app/refund/page.tsx:77-80` — CONFLICTS — LEGAL**
Verbatim: "Returns must be initiated within 3 days of receiving the product. The product must be in its original condition with all packaging and tags intact."
Why CONFLICTS: says a flat 3 days from *receiving*; the decision is 1 day (Greater Accra) / 3 days (otherwise) counted from when the **vendor marks the order completed**.
Proposed replacement (minimal, founder to approve exact wording): "A return must be started within 1 day of the vendor marking the order as completed if the delivery address is in the Greater Accra Region, and within 3 days otherwise. The product must be in its original condition with all packaging and tags intact."
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**2. `app/refund/page.tsx:128-131` — POLICY GAP**
Verbatim: "The vendor will review your request and approve or reject it within 3 business days."
Why POLICY GAP: the approved decisions do not specify a vendor return-review timeframe, so this cannot be updated from them.
Question: How long does the vendor have to review/approve a return request?

**3. `app/refund/page.tsx:151-154` — POLICY GAP**
Verbatim: "- Return Review: 3 business days after vendor receives the item"
Why POLICY GAP: vendor return-review timing is not specified by the decisions (and the trigger differs from "vendor marks completed").
Question: What is the vendor return-review window and its trigger?

**4. `app/refund/page.tsx:227-230` — CONFLICTS — LEGAL**
Verbatim: "Some vendors may have their own return policies that supplement this platform-wide policy. These vendor-specific policies will be clearly stated on their product listings. In case of conflict between vendor policies and this platform policy, the more customer-friendly policy will apply."
Why CONFLICTS: the decision establishes a single platform return window (1 day Greater Accra / 3 days otherwise from completion); deferring to vendor-determined policies contradicts that.
Proposed replacement (minimal): One platform return window applies: within 1 day of the vendor marking the order completed (Greater Accra Region) or within 3 days otherwise.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

### Cancellation

**5. `app/refund/page.tsx:246-265` — CONFLICTS — LEGAL**
Verbatim (Cancellation section):
- "Orders can be cancelled before they are shipped without penalty"
- "Once an order is shipped, standard return policies apply"
- "To cancel an order, contact the vendor immediately with your order number"
Why CONFLICTS: omits the 1-hour free window (from payment confirmation), omits the GHS 5 fee after the first hour before shipment, and does not state that an order cannot be cancelled once shipped or that Paystack's fee is not refunded.
Proposed replacement (minimal): Cancellation is free within 1 hour of payment confirmation if not shipped. After the first hour and before shipment, a GHS 5 fee applies, deducted from the refund. An order cannot be cancelled once the vendor ships it. Paystack's processing fee is not refunded.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**6. `app/faq/faq-client.tsx:92-94` — CONFLICTS**
Verbatim (FAQ #11): "Orders can only be modified or cancelled within 1 hour of placement if they haven't entered processing."
Why CONFLICTS: says "1 hour of placement" (decision: 1 hour of **payment confirmation**), omits the GHS 5 fee after the first hour before shipment, omits that an order cannot be cancelled once shipped.
Proposed replacement: Cancellation is free within 1 hour of payment confirmation if not shipped. After the first hour and before shipment, a GHS 5 fee applies, deducted from the refund. An order cannot be cancelled once the vendor ships it.

**7. `app/help/refunds/page.tsx:44-45` — CONFLICTS**
Verbatim: "If your order hasn't been shipped yet, you can cancel it directly from your order details page. For paid orders, you can also request a refund during cancellation."
Why CONFLICTS: implies any pre-shipment cancellation is allowed with no time limit or fee; the decision allows free cancellation only within 1 hour of payment confirmation and a GHS 5 fee after that (before shipment), and no cancellation once shipped.
Proposed replacement: You can cancel for free within 1 hour of payment confirmation if the order has not shipped. After the first hour and before shipment, a GHS 5 fee applies, deducted from the refund. Once the vendor ships, the order cannot be cancelled.

**8. `app/help/preorders/page.tsx:90-91` — CONFLICTS**
Verbatim: "Can I cancel a preorder? Yes, you can cancel before shipment. Contact the vendor to initiate cancellation."
Why CONFLICTS: "before shipment" with no time limit and no fee contradicts the 1-hour free window, the GHS 5 fee after the first hour, and the no-cancellation-once-shipped rule.
Proposed replacement: Cancellation is free within 1 hour of payment confirmation if not shipped. After the first hour and before shipment, a GHS 5 fee applies. Once the vendor ships, it cannot be cancelled.

**9. `app/help/backorders/page.tsx:88-89` — CONFLICTS**
Verbatim: "Can I cancel a backorder? Yes, you can cancel anytime before shipment. Contact the vendor to cancel."
Why CONFLICTS: "anytime before shipment" contradicts the 1-hour limit, the fee, and the no-cancellation-once-shipped rule.
Proposed replacement: Cancellation is free within 1 hour of payment confirmation if not shipped. After the first hour and before shipment, a GHS 5 fee applies. Once the vendor ships, it cannot be cancelled.

**10. `app/help/restock-orders/page.tsx:85-86` — CONFLICTS**
Verbatim: "Can I cancel a backorder? Customers can cancel backorders before shipment. Notify them when stock arrives."
Why CONFLICTS: "before shipment" with no time limit or fee contradicts the decision.
Proposed replacement: Cancellation is free within 1 hour of payment confirmation if not shipped. After the first hour and before shipment, a GHS 5 fee applies. Once the vendor ships, it cannot be cancelled.

**11. `lib/support-ai/knowledge-base.ts:143-145` — CONFLICTS**
Verbatim (order-modification-cancellation response): "Orders can only be modified or cancelled within 1 hour of placement, and only if they haven't already entered processing or shipping."
Why CONFLICTS: "1 hour of placement" (decision: 1 hour of payment confirmation), omits the GHS 5 fee after the first hour, omits no-cancellation-once-shipped.
Proposed replacement: Cancellation is free within 1 hour of payment confirmation if not shipped. After the first hour and before shipment, a GHS 5 fee applies, deducted from the refund. An order cannot be cancelled once the vendor ships it.

**12. `docs/support-ai-policy-decisions.md:17-18` — CONFLICTS**
Verbatim: "Cancellation: Orders can be cancelled within 1 hour of ordering."
Why CONFLICTS: "within 1 hour of ordering" (decision: 1 hour of payment confirmation, free only if not shipped); omits the GHS 5 fee after the first hour, omits no-cancellation-once-shipped, omits the 4-in-30-days block and wallet-credit return.
Proposed replacement: Cancellation is free within 1 hour of payment confirmation if not shipped. After the first hour and before shipment, a GHS 5 fee applies. An order cannot be cancelled once the vendor ships. Cancelling 4 orders within any 30 days blocks all cancellations for the next 3 months. Wallet credit used on the order is returned to the wallet.

**13. `app/dashboard/customer/orders/[id]/page.tsx:969-991` — CONSISTENT**
Verbatim (cancel dialog): "Please provide a reason for cancelling this order. Orders can only be cancelled before they are shipped." plus dynamic preview text covering free/fee, the 3-month block after 4 cancellations in 30 days, "Paystack's processing fee will not be refunded", and `walletRestored`.
Why CONSISTENT: the dynamic cancel preview already implements free cancellation within 1 hour, the GHS 5 fee after the first hour, no cancellation once shipped, the 4-in-30-days block, Paystack's fee not refunded, and wallet credit returned.

### Payouts

**14. `app/faq/faq-client.tsx:58-60` — CONFLICTS**
Verbatim (FAQ #6): "Vendors receive 100% of the product price minus platform commission (if applicable) and payment processing fees. When there is no open dispute, vendors receive payouts within 2 business days. If a dispute is being settled, the platform decides when the payout is released."
Why CONFLICTS: commission should be 1% of the **product price only**, not shipping, and Paystack fees are added to the customer's payment (not deducted from the vendor); payouts should be **within 2 business days after the vendor marks the order completed**, only if there are **no open returns or disputes**, business days Monday-Friday excluding Ghanaian public holidays; "the platform decides when the payout is released" during a dispute contradicts "only if there are no open returns or disputes".
Proposed replacement: Vendors receive 100% of the product price minus 1% platform commission (deducted before payout). Paystack processing fees are added to the customer's payment, not deducted from the vendor. Payouts are released within 2 business days after the vendor marks the order completed, only if there are no open returns or disputes. Business days are Monday to Friday, excluding Ghanaian public holidays.

**15. `app/payment-policy/page.tsx:66-69` — CONFLICTS — LEGAL**
Verbatim: "Paystack transaction charges/fees are deducted by Paystack before payout settlement."
Why CONFLICTS: decision says Paystack processing fees are added to the customer's payment and are **not** deducted from the vendor's payout.
Proposed replacement (minimal): Paystack processing fees are added to the customer's payment and are not deducted from the vendor's payout.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**16. `app/payment-policy/page.tsx:96-100` — CONFLICTS — LEGAL**
Verbatim: "- Platform commissions" (within the Deductions and Adjustments list).
Why CONFLICTS: states platform commissions are deducted but gives no rate and no "product price only / not shipping" limit.
Proposed replacement (minimal): "- Platform commission: 1% of the product price only (not shipping), deducted from the vendor's earnings before payout."
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**17. `app/payment-policy/page.tsx:110-134` — CONFLICTS — LEGAL**
Verbatim: "Dhream Market reserves the right to: Determine payout schedules / Establish payout holding periods / Set settlement timelines / Conduct fraud review processes / Perform compliance checks."
Why CONFLICTS: implies broad platform discretion; the decision fixes payouts at within 2 business days after the vendor marks the order completed, only if there are no open returns or disputes.
Proposed replacement (minimal): Payouts are released within 2 business days after the vendor marks the order completed, only if there are no open returns or disputes. Business days are Monday to Friday, excluding Ghanaian public holidays.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**18. `app/payment-policy/page.tsx:155-179` — CONFLICTS — LEGAL**
Verbatim: "Dhream Market may temporarily hold payouts in cases involving: Suspicious activity / Fraud investigation / Disputes / Policy violations / Compliance reviews."
Why CONFLICTS: lists holds beyond open returns/disputes (fraud, compliance, etc.); the decision conditions payout only on no open returns or disputes.
Proposed replacement (minimal): Payouts are released only if there are no open returns or disputes.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**19. `app/terms/page.tsx:386-389` — CONFLICTS — LEGAL**
Verbatim: "Vendor payouts will be sent based on completed and verified sales."
Why CONFLICTS: "completed and verified sales" is close but does not state the 2-business-day timing, the no-open-returns-or-disputes condition, or the business-days definition.
Proposed replacement (minimal): Payouts are released within 2 business days after the vendor marks the order completed, only if there are no open returns or disputes.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**20. `app/terms/page.tsx:390-393` — CONFLICTS — LEGAL**
Verbatim: "Paystack transaction charges/fees are deducted by Paystack before payout settlement."
Why CONFLICTS: decision says Paystack fees are added to the customer's payment, not deducted from the vendor's payout.
Proposed replacement (minimal): Paystack processing fees are added to the customer's payment and are not deducted from the vendor's payout.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**21. `app/terms/page.tsx:412-414` — CONFLICTS — LEGAL**
Verbatim: "- Platform commissions" (within Deductions and Adjustments).
Why CONFLICTS: no rate, no "product price only / not shipping" limit.
Proposed replacement (minimal): "- Platform commission: 1% of the product price only (not shipping), deducted from the vendor's earnings before payout."
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**22. `app/terms/page.tsx:454-477` — CONFLICTS — LEGAL**
Verbatim: Payout Holds: "Dhream Market may temporarily hold payouts in cases involving: Suspicious activity / Fraud investigation / Disputes / Policy violations / Compliance reviews."
Why CONFLICTS: holds beyond open returns/disputes; the decision conditions payout only on no open returns or disputes.
Proposed replacement (minimal): Payouts are released only if there are no open returns or disputes.
LEGAL: FOUNDER MUST APPROVE EXACT WORDING.

**23. `app/help/fulfillment-workflow/page.tsx:99` — CONFLICTS**
Verbatim: "Customer receives shipping confirmation with tracking info. Payment is released after delivery."
Why CONFLICTS: payout trigger should be "after the vendor marks the order completed" (only after the buyer has received it), within 2 business days, only if no open returns or disputes; "after delivery" is the wrong trigger and omits the conditions.
Proposed replacement: Payouts are released within 2 business days after the vendor marks the order completed, only if there are no open returns or disputes. Business days are Monday to Friday, excluding Ghanaian public holidays. Only mark an order completed after the buyer has received it.

**24. `app/register/page.tsx:271-274` — CONFLICTS**
Verbatim (vendor banner): "Vendors pay a 1% platform commission on all completed orders. Payouts are processed after 2 business days."
Why CONFLICTS: "1% ... on all completed orders" does not state "of the product price only, not shipping"; "after 2 business days" omits "after the vendor marks the order completed", "only if no open returns or disputes", and the business-days definition.
Proposed replacement: Vendors pay 1% platform commission of the product price only (not shipping), deducted before payout. Payouts are released within 2 business days after the vendor marks the order completed, only if there are no open returns or disputes (business days: Monday-Friday, excluding Ghanaian public holidays).

**25. `app/dashboard/vendor/page.client.tsx:220-224` — CONFLICTS**
Verbatim (vendor dashboard banner): "Vendors pay a 1% platform commission on all completed orders. Payouts are processed after 2 business days."
Why CONFLICTS: same as #24 (does not state product-price-only/not shipping; incomplete payout timing and conditions).
Proposed replacement: same as #24.

**26. `lib/support-ai/knowledge-base.ts:61-63` — CONFLICTS**
Verbatim (vendor-payout-timing response): "Vendors receive 100% of the product price minus platform commission (if applicable) and payment processing fees. When there is no open dispute, vendors receive payouts within 2 business days. If a dispute is being settled, the platform decides when the payout is released. ..."
Why CONFLICTS: same issues as #14 (commission rate/fees; payout trigger and conditions; "platform decides" during dispute).
Proposed replacement: same as #14.

**27. `docs/support-ai-policy-decisions.md:23-25` — CONFLICTS**
Verbatim: "Payouts: Without disputes, vendors receive payouts within 2 business days. If a dispute is being settled, the platform decides when the payout is released."
Why CONFLICTS: omits "after the vendor marks the order completed" and "no open returns"; "the platform decides" during a dispute contradicts "only if there are no open returns or disputes"; omits business-days definition.
Proposed replacement: Payouts are released within 2 business days after the vendor marks the order completed, only if there are no open returns or disputes. Business days are Monday to Friday, excluding Ghanaian public holidays.

### Vendor commission / fees

**28. `lib/support-ai/knowledge-base.ts:10-13` — CONFLICTS**
Verbatim (payment-methods response): "... Paystack transaction fees may apply."
Why CONFLICTS (partial): implies Paystack fees may apply ambiguously; the decision states Paystack processing fees are added to the customer's payment and are not deducted from the vendor's payout.
Proposed replacement: Paystack processing fees are added to the customer's payment and are not deducted from the vendor's payout.

**29. `docs/support-ai-policy-decisions.md:41` — CONFLICTS**
Verbatim: "Commission rate value — Currently configurable via COMMISSION_CONFIG.DEFAULT_RATE (1%) and SuperAdminSettings.platformFee, but no published value for vendors."
Why CONFLICTS: the approved decision sets commission at 1% of the product price only (not shipping), deducted before payout.
Proposed replacement: Platform commission is 1% of the product price only (not shipping), deducted from the vendor's earnings before payout.

### Manual orders

**30. POLICY GAP — no current site location**
No page, FAQ, help page, vendor guide, or email template on the site states what a manual order is.
Approved decision content (missing from the site): a manual order is created by a vendor for a sale made outside the Dhream Market catalogue (e.g. WhatsApp, Instagram, a physical shop, a walk-in); the vendor shares a payment link, the customer pays, the vendor fulfils it.
Question: Where should the manual-order definition appear on the site?

**31. POLICY GAP — no current site location**
No site location states that manual orders carry 0% commission or that the vendor pays the Paystack processing fee on a manual order.
Approved decision content (missing from the site): manual orders: 0% commission; the Paystack processing fee on a manual order is paid by the vendor.
Question: Where should the manual-order commission and fee rule appear?

**32. POLICY GAP — no current site location**
No site location states that, for returns of manual orders, the vendor refunds the buyer directly, or that manual orders always use the 3-day return window.
Approved decision content (missing from the site): for returns of manual orders, the vendor refunds the buyer directly; manual orders always use the 3-day return window.
Question: Where should the manual-order return rule appear?

### Vendor verification review time

**33. `app/faq/faq-client.tsx:44-46` — CONSISTENT**
Verbatim (FAQ #4): "... submit your store for verification. Our team will review your application within 1-2 business days."
Why CONSISTENT: matches "Our team reviews a vendor's store verification submission within 1-2 business days."

**34. `app/faq/faq-client.tsx:107-109` — CONSISTENT**
Verbatim (FAQ #13): "Verification typically takes 1-2 business days. Delays may occur if additional documentation is needed."
Why CONSISTENT: matches the 1-2 business day review.

**35. `app/help/vendor-verification/page.tsx:79-81` — CONSISTENT**
Verbatim: "Our team reviews your submission within 1-2 business days."
Why CONSISTENT: matches exactly.

**36. `app/help/creating-store/page.tsx:64-66` — CONSISTENT**
Verbatim: "... your store for verification. Our team will review within 1-2 business days."
Why CONSISTENT: matches.

**37. `app/help/creating-store/page.tsx:91` — CONSISTENT**
Verbatim: "Verification typically takes 1-2 business days."
Why CONSISTENT: matches.

**38. `lib/support-ai/knowledge-base.ts:163-165` — CONSISTENT**
Verbatim (vendor-verification-timing response): "Store verification typically takes 1-2 business days after you submit your application."
Why CONSISTENT: matches.

### docs/support-ai-content-pack

`docs/support-ai-content-pack/pack.json` contains faithful copies of the source-page texts above (each with `sourceRefs`), so each pack document inherits the status of its source page (e.g. `DOC-0006 faq.vendor.payout-calculation` → CONFLICTS, source `app/faq/faq-client.tsx:58-60`; `DOC-0124`–`DOC-0133` policy.refund-policy.* → CONFLICTS/POLICY GAP, source `app/refund/page.tsx`; `DOC-0149`–`DOC-0154` policy payment-policy/terms payout → CONFLICTS, sources `app/payment-policy/page.tsx` and `app/terms/page.tsx`). No pack document was edited.

`docs/support-ai-content-pack/conflicts.md` and `docs/support-ai-content-pack/gaps.json` already catalogue the same cross-source conflicts and policy questions (including GAP-001 cancellation, GAP-002 commission, GAP-008 payout clock). `docs/support-ai-content-pack/README.md` states the pack is DRAFT and nothing in it is approved.

`lib/refunds/refund-email.ts` was checked: it contains no policy copy on returns, cancellation, payouts, commission/fees, manual orders, or vendor verification review time, so it is not listed.

---

## LEGAL items (FOUNDER MUST APPROVE EXACT WORDING)

The following CONFLICTS locations are legal text (terms / refund / payment policy); the founder must approve the exact proposed wording, and each proposal is kept minimal:

1. `app/refund/page.tsx:77-80` (return window)
2. `app/refund/page.tsx:227-230` (vendor-specific return policies)
3. `app/refund/page.tsx:246-265` (cancellation section)
4. `app/payment-policy/page.tsx:66-69` (Paystack fees deducted)
5. `app/payment-policy/page.tsx:96-100` (platform commissions deduction)
6. `app/payment-policy/page.tsx:110-134` (payout controls / reserves right)
7. `app/payment-policy/page.tsx:155-179` (payout holds)
8. `app/terms/page.tsx:224-228` (returns determined by individual vendors)
9. `app/terms/page.tsx:386-389` (payouts based on completed and verified sales)
10. `app/terms/page.tsx:390-393` (Paystack fees deducted)
11. `app/terms/page.tsx:412-414` (platform commissions)
12. `app/terms/page.tsx:454-477` (payout holds)

Total LEGAL items: **12**.

---

## POLICY GAP (missing information — cannot be updated from the decisions below)

| # | Topic | Question |
|---|-------|----------|
| PG-1 | Returns — vendor review timeframe | `app/refund/page.tsx:128-131`, `app/refund/page.tsx:151-154`, `app/help/returns/page.tsx:56-58`, `app/help/returns/page.tsx:90`, `app/help/refunds/page.tsx:67` state a vendor return-review window, but the decisions do not specify one. How long does the vendor have to review/approve a return request? |
| PG-2 | Completion / receipt rule | No site text states that buyers confirm receipt with the vendor and the vendor marks the order completed only after the buyer has received it. Where should the order-completion rule be published? |
| PG-3 | Manual orders — definition | No site location defines a manual order (sale outside the catalogue via WhatsApp/Instagram/physical shop/walk-in, payment link, vendor fulfils). Where should it appear? |
| PG-4 | Manual orders — fees | No site location states manual orders carry 0% commission or that the vendor pays the Paystack processing fee on a manual order. Where should this appear? |
| PG-5 | Manual orders — returns | No site location states that for returns of manual orders the vendor refunds the buyer directly, or that manual orders always use the 3-day return window. Where should this appear? |

Note: GAP-008 in `docs/support-ai-content-pack/gaps.json` ("What starts the 2 business day payout clock") is already tracked there; the approved decision answers it (clock starts when the vendor marks the order completed; only if no open returns or disputes).

---

## Counts by status

| Status | Count |
|---|---|
| Locations audited (file:line-range entries) | 41 |
| CONSISTENT | 7 |
| CONFLICTS | 29 |
|   of which LEGAL (founder must approve exact wording) | 12 |
| POLICY GAP entries | 9 (5 with current site text + 4 missing-info / no current site location) |

No files were edited. This change sheet is the only new file.
