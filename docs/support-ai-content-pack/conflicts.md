# Conflicts between sources

Every place where two sources in the repo state different values for the same rule. Each entry lists the file and line on both sides and says which side matches the owner decisions recorded on `fix/support-ai-policy-alignment`.

Owner decisions used as the tie-breaker:

- Return window: 3 days from receipt. Refund processing: 3-5 business days. Bank credit: 10-14 business days.
- Account deletion keeps audit logs and legally required records.
- Payouts: within 2 business days when there is no open dispute; during a dispute the platform decides. The 2 business day clock start and any holds other than disputes are **undecided**.
- Cancellation: a staged policy (instant cancel within 1 hour, request-based after that, non-delivery deadline) that is **not built yet**. No cancellation rule may be published.
- The official WhatsApp number and the support email are approved channels.

---

## C-01 Return review window: 1-3 business days vs 3 business days

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/help/refunds/page.tsx:67` | `Request Review: 1-3 business days` |
| B | `app/refund/page.tsx:129` | `The vendor will review your request and approve or reject it within 3 business days.` |
| C | `app/help/returns/page.tsx:57` | `Vendor reviews your request and provides return instructions within 3 business days.` |

Which side matches the owner decisions: **neither is ruled out.** The owner aligned the 3-day return window and the 3-5 business day refund window, not the vendor review window. The refund policy page (B) is the platform-wide policy page and is the safer side to publish, but the 1-3 business day text on the help page must be changed before the AI answers review questions. See GAP-019.

Documents affected: `help.refunds.refund-timeline`, `policy.refund-policy.return-process`, `help.returns.return-process` (all flagged `CONFLICT`).

## C-02 When the 3-5 business day refund clock starts

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/refund/page.tsx:157` | `Refund Processing: 3-5 business days after approval` |
| B | `app/refund/page.tsx:139-140` | `Once the vendor receives and inspects the returned item, the refund will be processed within 3-5 business days.` |
| C | `app/help/refunds/page.tsx:68` | `Return Processing: 3-5 business days after receipt` |
| D | `app/help/refunds/page.tsx:94` | `Refunds are processed within 3-5 business days after the vendor receives returned items.` |

Which side matches the owner decisions: **the 3-5 business day window matches** on every side; the **trigger does not**. The owner decision names the window but not the trigger. Approval after the vendor receives and inspects the item (B, D) is the stricter reading and the only one that is consistent with the return process steps, so the owner should confirm which trigger the AI should use. See GAP-026.

Documents affected: `policy.refund-policy.refund-timeline`, `policy.refund-policy.return-process`, `help.refunds.refund-timeline`, `help.refunds.faq.how-long-does-a-refund-take` (flagged `CONFLICT`).

## C-03 Who sets the return policy: platform or vendor

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/terms/page.tsx:225` | `Return and refund policies are determined by individual vendors.` |
| B | `app/refund/page.tsx:78` | `Returns must be initiated within 3 days of receiving the product.` |
| C | `app/refund/page.tsx:227-230` | `In case of conflict between vendor policies and this platform policy, the more customer-friendly policy will apply.` |

Which side matches the owner decisions: **B and C.** The owner has approved a platform-wide 3-day return window from receipt, which only makes sense if the platform policy governs. Side A contradicts that and must be reworded before the AI is allowed to answer returns questions.

Documents affected: `policy.terms.returns-and-refunds` (flagged `CONFLICT`), and the return documents that depend on the platform window (`policy.refund-policy.eligibility-for-returns`, `help.returns.return-policy-overview`).

## C-04 Vendor non-response window: 48 hours vs 3 business days

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/faq/faq-client.tsx:101` | `If the seller doesn't respond within 48 hours, our support team will intervene.` |
| B | `app/help/returns/page.tsx:98` | `Contact our support team to open a dispute if the vendor doesn't respond within 3 business days.` |

Which side matches the owner decisions: **neither.** The owner decisions do not cover vendor non-response. Both numbers are live and they are about different situations (damaged order vs return), so the owner should state whether they are deliberately different. See GAP-020.

Documents affected: `faq.order.damaged` (flagged `CONFLICT`), `help.returns.faq.what-if-vendor-doesn-t-respond`.

## C-05 When a vendor payout is released

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/help/fulfillment-workflow/page.tsx:99` | `Payment is released after delivery.` |
| B | `app/faq/faq-client.tsx:59` | `When there is no open dispute, vendors receive payouts within 2 business days.` |

Which side matches the owner decisions: **B.** The owner approved the 2 business day payout window with no open dispute. Side A states a different trigger (delivery) and must be reworded before the AI is allowed to answer payout questions. See GAP-027.

Documents affected: `help.fulfillment-workflow.faq.what-happens-after-i-mark-shipped` (flagged `CONFLICT`), `faq.vendor.payout-calculation` (flagged `NEEDS_OWNER_DECISION`).

## C-06 What starts the 2 business day payout clock

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/faq/faq-client.tsx:59` | `When there is no open dispute, vendors receive payouts within 2 business days.` |
| B | `app/payment-policy/page.tsx:111-134` | `Dhream Market reserves the right to: Determine payout schedules / Establish payout holding periods / Set settlement timelines / Conduct fraud review processes / Perform compliance checks` |
| C | `app/payment-policy/page.tsx:156` | `Dhream Market may temporarily hold payouts in cases involving: Suspicious activity / Fraud investigation / Disputes / Policy violations / Compliance reviews` |

Which side matches the owner decisions: **the owner explicitly left this undecided.** The clock start is not stated anywhere, and side C lists holds beyond disputes. The owner confirmed that only the dispute case is decided and that fraud and compliance holds are undecided, so every payout document is flagged `NEEDS_OWNER_DECISION` and the question is tracked in GAP-008.

Documents affected: `faq.vendor.payout-calculation`, `policy.terms.marketplace-payment-processing-and-vendor-payout-policy`, `policy.payment-policy.payment-processing`, `policy.payment-policy.deductions-and-adjustments`, `policy.payment-policy.payout-controls-and-schedules`, `policy.payment-policy.payout-holds` (all flagged `NEEDS_OWNER_DECISION`).

## C-07 Platform commission rate: hardcoded 1% vs a configurable rate

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/register/page.tsx:273` | `Vendors pay a 1% platform commission on all completed orders. Payouts are processed after 2 business days.` |
| B | `app/dashboard/vendor/page.client.tsx:221` | `Vendors pay a 1% platform commission on all completed orders. Payouts are processed after 2 business days.` |
| C | `lib/revenue.ts:12` and `lib/revenue.ts:28` | `DEFAULT_RATE: 0.01`, overridden at runtime by the `platformFee` setting |
| D | `components/settings/SuperAdminSections.tsx:133` | admin settings default `platformFee` = 2.5 |

Which side matches the owner decisions: **none.** The owner has not approved any rate. Sides A and B publish a fixed 1% while the code default for the same setting in the admin UI is 2.5, so the published number is not reliable. No rate is in the pack. See GAP-002.

## C-08 Vendor verification documents

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/faq/faq-client.tsx:115` | `We require a valid government-issued ID (passport, driver's license, or national ID) and proof of business registration if applicable. Business licenses may be required for certain product categories.` |
| B | `app/help/help-client.tsx:52` | `We require a valid government-issued ID (passport, driver's license, or national ID) and proof of business registration if applicable.` |
| C | `lib/support-ai/knowledge-base.ts:161` | adds `(e.g., electronics, health products)` as examples of extra documents |

Which side matches the owner decisions: **A is the fuller page text** and is the side kept in the pack; B is the same answer without the category-licence sentence. The owner has not ruled, so the shorter answer is still live on the help page and the legacy text adds examples no page supports.

Documents affected: `faq.vendor.verification-documents`, `helpfaq.vendor.verification-documents` (flagged `CONFLICT`).

## C-09 Featured vendor criteria

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/faq/faq-client.tsx:122` | `Featured vendors are approved by our team based on excellent customer ratings and consistent order fulfillment.` |
| B | `lib/support-ai/knowledge-base.ts:184` | legacy text adds a `4.5+ average` rating threshold and a monthly review |
| C | `lib/support-ai/knowledge-base.ts:187` | legacy text adds `Dedicated support line` and `Early access to new features` as benefits |

Which side matches the owner decisions: **A** is the only published page text and is what the pack carries. B and C are legacy assertions with no page behind them and are not in the pack. The owner should confirm the real criteria. See GAP-018.

Documents affected: `faq.vendor.featured-program`, `faq.vendor.featured-benefits` (flagged `CONFLICT`).

## C-10 Cancellation wording (all versions differ from each other and from the decided policy)

The owner has decided on a **staged** cancellation policy: instant cancel within 1 hour, request-based after that, and a non-delivery deadline. That policy is not built yet, so **no** of the versions below may be published, and they do not agree with each other.

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/faq/faq-client.tsx:94` | `Orders can only be modified or cancelled within 1 hour of placement if they haven't entered processing.` |
| B | `lib/support-ai/knowledge-base.ts:144` | `Orders can only be modified or cancelled within 1 hour of placement, and only if they haven't already entered processing or shipping.` |
| C | `app/refund/page.tsx:254` | `Orders can be cancelled before they are shipped without penalty` |
| D | `app/help/refunds/page.tsx:44` | `If your order hasn't been shipped yet, you can cancel it directly from your order details page.` |
| E | `app/help/preorders/page.tsx:91` | `Yes, you can cancel before shipment. Contact the vendor to initiate cancellation.` |
| F | `app/help/backorders/page.tsx:89` | `Yes, you can cancel anytime before shipment. Contact the vendor to cancel.` |
| G | `app/help/restock-orders/page.tsx:86` | `Customers can cancel backorders before shipment.` |
| H | `app/help/placing-orders/page.tsx:99` | `Orders can be modified before shipment. Contact the vendor immediately for any changes.` |
| I | `app/terms/page.tsx:189` | `We reserve the right to cancel orders that violate our policies` (platform-side right) |
| J | `app/help/purchase-orders/page.tsx:99` | `Yes, cancel anytime before delivery. Contact the supplier to confirm cancellation.` (vendor to supplier, not a customer order) |
| K | `app/help/purchase-orders/page.tsx:91` | `Yes, before the supplier accepts. After acceptance, you may need to cancel and create a new order.` (vendor to supplier) |

Which side matches the owner decisions: **none of them.** A and B contain the "1 hour" wording, but they only cover the first stage of the staged policy and omit the request-based stage and the non-delivery deadline, so they are not the decided policy either. C to H use "before shipment" with no time limit at all. Every statement above was excluded from the pack and is listed in GAP-001 so the owner can see exactly which pages must change before the AI may answer cancellation questions.

## C-11 Charging time for preorders and backorders vs order acceptance

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/help/preorders/page.tsx:42` | `When you place a preorder, you'll be charged immediately and the item will ship once it arrives at the vendor's warehouse.` |
| B | `app/help/backorders/page.tsx:42` | `When you place a backorder, you'll be charged immediately and the item will ship once inventory is replenished.` |
| C | `app/terms/page.tsx:173` | `All orders are subject to acceptance by the vendor` |
| D | `app/terms/page.tsx:185` | `Order confirmation does not guarantee fulfillment` |

Which side matches the owner decisions: **not covered by the owner decisions.** The two sets of text do not contradict each other outright, but together they leave the AI unable to say whether a buyer is charged before the vendor accepts the order. The owner should confirm the order of events for preorders and backorders. See GAP-010 and GAP-028.

Documents affected: `help.preorders.what-are-preorders`, `help.backorders.what-are-backorders`, `policy.terms.orders-and-payments`.

## C-12 Support hours and response time stated on pages but not approved

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/help/help-client.tsx:310` | `Our support team operates Monday to Friday, 9:00 AM - 6:00 PM (GMT).` |
| B | `app/contact/page.tsx:215` | `Available Monday to Friday, 9:00 AM - 6:00 PM (GMT)` |
| C | `app/help/help-client.tsx:274` | `We'll respond within 24-48 hours.` |

Which side matches the owner decisions: **none.** The owner stated that support hours do not exist, so A, B and C were excluded from the pack and are tracked in GAP-007. The single contact document carries only the approved WhatsApp link, the approved support email and the published phone lines (see GAP-024).

## C-13 Return review trigger inside the refund policy page itself

| Side | File and line | Text |
| --- | --- | --- |
| A | `app/refund/page.tsx:129` | `The vendor will review your request and approve or reject it within 3 business days.` (trigger: the request) |
| B | `app/refund/page.tsx:153` | `Return Review: 3 business days after vendor receives the item` (trigger: receipt of the returned item) |

Which side matches the owner decisions: **not covered.** The same page gives two different starting points for the same 3 business day review window. This is part of GAP-019 and GAP-026.

Documents affected: `policy.refund-policy.return-process`, `policy.refund-policy.refund-timeline` (flagged `CONFLICT`).

## C-14 Published support phone numbers vs the approved channels

| Side | File and line | Text |
| --- | --- | --- |
| A | `lib/support-ai/knowledge-base.ts:278` and `lib/support-ai/knowledge-base.ts:280` | `WHATSAPP_SUPPORT_LINK = 'https://wa.me/447869840464/'`, `SUPPORT_EMAIL = 'support@dhreamarket.com'` (owner approved) |
| B | `app/contact/page.tsx:219-221` | `+233 59 652 2239`, `+233 50 854 8181`, `+233 27 935 4362` (published on the contact page and on every help page footer) |

Which side matches the owner decisions: **A is explicitly approved.** B is published but was not named as approved, so the three phone lines are carried in the single contact document and flagged for confirmation in GAP-024. If the owner does not want them quoted by the AI, removing them from `DOC-0165` is a one-line change.
