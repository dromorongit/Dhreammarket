# 08 — Legal proposals for lawyer

**Repo:** Dhream Market main app, branch `release/policy-copy`.  
**Source:** LEGAL entries from sheets `07b-copy-change-sheet.md` and `07c-addendum.md` (app/terms, app/refund, app/payment-policy).  
**Status:** Proposals only. No legal files are edited by this document; the founder must approve exact wording.

## Approved decisions (reference)

- **Return window:** A return must be started within 1 day of the vendor marking the order completed (Greater Accra Region) or within 3 days otherwise, counted from when the vendor marks the order completed (not from receipt).
- **Return review:** The vendor has 1 business day to review a return request, counted from when the buyer submits it.
- **Refund timing:** Once a return is approved, Dhream Market processes the refund within 24 hours. Time for the money to appear in the buyer's bank or mobile money account after that depends on the provider.
- **Cancellation:** Free within 1 hour of payment confirmation if not shipped; after the first hour and before shipment a GHS 5 fee applies; no cancellation once the vendor ships; Paystack's processing fee is not refunded; every paid cancellation counts including free ones; cancelling 4 orders within 30 days blocks all cancellations for 3 months; unpaid and manual orders are exempt; wallet credit is returned.
- **Payout:** 1% platform commission of the product price only (not shipping), deducted before payout; Paystack processing fees are added to the customer's payment and not deducted from the vendor; payouts released within 2 business days after the vendor marks the order completed, only if no open returns or disputes; while a return or dispute is open the payout is held; business days Monday-Friday excluding Ghanaian public holidays.
- **Manual orders:** 0% commission; the vendor pays the Paystack processing fee on a manual order; manual orders always use the 3-day return window; the vendor refunds the buyer directly.

## Standard timing sentence (payout hold / discretion entries)

For the payout-hold and payout-discretion entries below, the existing wording is kept and only the following standard timing sentence is appended:

> Payouts are released within 2 business days after the vendor marks the order completed, as long as there are no open returns or disputes on the order. Business days are Monday to Friday and exclude Ghanaian public holidays.

## LEGAL entries

### app/refund/page.tsx

**1. `app/refund/page.tsx:77-80` — CONFLICTS — LEGAL (return window)**

Verbatim current text: "Returns must be initiated within 3 days of receiving the product. The product must be in its original condition with all packaging and tags intact."

Proposed replacement: "A return must be started within 1 day of the vendor marking the order completed if the delivery address is in the Greater Accra Region, and within 3 days otherwise. The product must be in its original condition with all packaging and tags intact."

Approved decision implemented: return window (1 day Greater Accra / 3 days otherwise from vendor marking completed).

---

**2. `app/refund/page.tsx:128-131` — CONFLICTS — LEGAL (return review)**

Verbatim current text: "The vendor will review your request and approve or reject it within 3 business days."

Proposed replacement: "The vendor will review your request and approve or reject it within 1 business day of when you submit it."

Approved decision implemented: return review (1 business day from submission).

---

**3. `app/refund/page.tsx:151-154` — CONFLICTS — LEGAL (return review)**

Verbatim current text: "- Return Review: 3 business days after vendor receives the item"

Proposed replacement: "- Return Review: 1 business day after you submit your return request."

Approved decision implemented: return review (1 business day from submission).

---

**4. `app/refund/page.tsx:157` — CONFLICTS — LEGAL (refund timing)**

Verbatim current text: "<strong>Refund Processing:</strong> 3-5 business days after approval"

Proposed replacement: "Refund Processing: within 24 hours after approval"

Approved decision implemented: refund timing (24 hours after approval).

---

**5. `app/refund/page.tsx:161` — CONFLICTS — LEGAL (refund timing)**

Verbatim current text: "<strong>Credit to Account:</strong> Depending on your bank, may take 10-14 business days"

Proposed replacement: "Credit to Account: time to reach your account depends on your payment provider"

Approved decision implemented: refund timing (provider dependence after the 24-hour processing).

---

**6. `app/refund/page.tsx:227-230` — CONFLICTS — LEGAL (vendor-specific return policies)**

Verbatim current text: "Some vendors may have their own return policies that supplement this platform-wide policy. These vendor-specific policies will be clearly stated on their product listings. In case of conflict between vendor policies and this platform policy, the more customer-friendly policy will apply."

Proposed replacement: "One platform return window applies: within 1 day of the vendor marking the order completed (Greater Accra Region) or within 3 days otherwise."

Approved decision implemented: single platform return window (1 day Greater Accra / 3 days otherwise).

---

**7. `app/refund/page.tsx:246-265` — CONFLICTS — LEGAL (cancellation)**

Verbatim current text (Cancellation section):
- "Orders can be cancelled before they are shipped without penalty"
- "Once an order is shipped, standard return policies apply"
- "To cancel an order, contact the vendor immediately with your order number"

Proposed replacement: Cancellation is free within 1 hour of payment confirmation if the order has not shipped. After the first hour and before shipment, a GHS 5 fee applies, deducted from the refund. Once the vendor ships the order, it cannot be cancelled. Paystack's processing fee is not refunded. Every paid cancellation counts, including free ones. Cancelling 4 orders within any 30 days blocks all cancellations for the next 3 months, starting right after the 4th cancellation. Unpaid and manual orders are exempt. Wallet credit used on the order is returned to the wallet.

Approved decision implemented: cancellation (1-hour free window, GHS 5 fee, no cancellation once shipped, Paystack fee not refunded, 4-in-30-days block, wallet credit returned).

---

### app/terms/page.tsx

**8. `app/terms/page.tsx:224-228` — CONFLICTS — LEGAL (returns determined by vendors)**

Verbatim current text: "Return and refund policies are determined by individual vendors. Please review the specific return policy before making a purchase. We provide a dispute resolution process for issues that cannot be resolved directly between customers and vendors."

Proposed replacement: "One platform return window applies: within 1 day of the vendor marking the order completed (Greater Accra Region) or within 3 days otherwise. Disputes that cannot be resolved directly go to human support."

Approved decision implemented: single platform return window (1 day Greater Accra / 3 days otherwise).

---

**9. `app/terms/page.tsx:386-389` — CONFLICTS — LEGAL (payouts based on completed sales)**

Verbatim current text: "Vendor payouts will be sent based on completed and verified sales."

Proposed replacement: "Payouts are released within 2 business days after the vendor marks the order completed, as long as there are no open returns or disputes on the order. Business days are Monday to Friday and exclude Ghanaian public holidays."

Approved decision implemented: payout timing (2 business days after vendor marks completed, no open returns or disputes).

---

**10. `app/terms/page.tsx:390-393` — CONFLICTS — LEGAL (Paystack fees deducted)**

Verbatim current text: "Paystack transaction charges/fees are deducted by Paystack before payout settlement."

Proposed replacement: "Paystack processing fees are added to the customer's payment and are not deducted from the vendor's payout."

Approved decision implemented: Paystack fees added to customer's payment, not deducted from vendor's payout.

---

**11. `app/terms/page.tsx:412-414` — CONFLICTS — LEGAL (platform commissions)**

Verbatim current text: "- Platform commissions" (within Deductions and Adjustments).

Proposed replacement: "- Platform commission: 1% of the product price only (not shipping), deducted from the vendor's earnings before payout."

Approved decision implemented: 1% platform commission of the product price only (not shipping), deducted before payout.

---

**12. `app/terms/page.tsx:454-477` — CONFLICTS — LEGAL (payout holds)**

Verbatim current text: "Payout Holds: Dhream Market may temporarily hold payouts in cases involving: Suspicious activity / Fraud investigation / Disputes / Policy violations / Compliance reviews."

Proposed replacement: Payout Holds: Dhream Market may temporarily hold payouts in cases involving: Suspicious activity / Fraud investigation / Disputes / Policy violations / Compliance reviews. Payouts are released within 2 business days after the vendor marks the order completed, as long as there are no open returns or disputes on the order. Business days are Monday to Friday and exclude Ghanaian public holidays.

Approved decision implemented: existing payout-hold wording kept; standard timing sentence added (payout timing).

---

### app/payment-policy/page.tsx

**13. `app/payment-policy/page.tsx:66-69` — CONFLICTS — LEGAL (Paystack fees deducted)**

Verbatim current text: "Paystack transaction charges/fees are deducted by Paystack before payout settlement."

Proposed replacement: "Paystack processing fees are added to the customer's payment and are not deducted from the vendor's payout."

Approved decision implemented: Paystack fees added to customer's payment, not deducted from vendor's payout.

---

**14. `app/payment-policy/page.tsx:96-100` — CONFLICTS — LEGAL (platform commissions)**

Verbatim current text: "- Platform commissions" (within the Deductions and Adjustments list).

Proposed replacement: "- Platform commission: 1% of the product price only (not shipping), deducted from the vendor's earnings before payout."

Approved decision implemented: 1% platform commission of the product price only (not shipping), deducted before payout.

---

**15. `app/payment-policy/page.tsx:110-134` — CONFLICTS — LEGAL (payout discretion)**

Verbatim current text: "Dhream Market reserves the right to: Determine payout schedules / Establish payout holding periods / Set settlement timelines / Conduct fraud review processes / Perform compliance checks."

Proposed replacement: Dhream Market reserves the right to: Determine payout schedules / Establish payout holding periods / Set settlement timelines / Conduct fraud review processes / Perform compliance checks. Payouts are released within 2 business days after the vendor marks the order completed, as long as there are no open returns or disputes on the order. Business days are Monday to Friday and exclude Ghanaian public holidays.

Approved decision implemented: existing discretion wording kept; standard timing sentence added (payout timing).

---

**16. `app/payment-policy/page.tsx:155-179` — CONFLICTS — LEGAL (payout holds)**

Verbatim current text: "Dhream Market may temporarily hold payouts in cases involving: Suspicious activity / Fraud investigation / Disputes / Policy violations / Compliance reviews."

Proposed replacement: Dhream Market may temporarily hold payouts in cases involving: Suspicious activity / Fraud investigation / Disputes / Policy violations / Compliance reviews. Payouts are released within 2 business days after the vendor marks the order completed, as long as there are no open returns or disputes on the order. Business days are Monday to Friday and exclude Ghanaian public holidays.

Approved decision implemented: existing payout-hold wording kept; standard timing sentence added (payout timing).

---

## Summary

| # | File | Lines | Topic | Decision implemented |
|---|------|-------|-------|---------------------|
| 1 | app/refund/page.tsx | 77-80 | Return window | 1 day Greater Accra / 3 days otherwise from completion |
| 2 | app/refund/page.tsx | 128-131 | Return review | 1 business day from submission |
| 3 | app/refund/page.tsx | 151-154 | Return review | 1 business day from submission |
| 4 | app/refund/page.tsx | 157 | Refund timing | 24 hours after approval |
| 5 | app/refund/page.tsx | 161 | Refund timing | Provider dependence |
| 6 | app/refund/page.tsx | 227-230 | Vendor-specific policies | Single platform return window |
| 7 | app/refund/page.tsx | 246-265 | Cancellation | Full cancellation paragraph |
| 8 | app/terms/page.tsx | 224-228 | Returns by vendors | Single platform return window |
| 9 | app/terms/page.tsx | 386-389 | Payouts completed sales | 2 business days after completion |
| 10 | app/terms/page.tsx | 390-393 | Paystack fees deducted | Fees added to customer |
| 11 | app/terms/page.tsx | 412-414 | Platform commissions | 1% product price only |
| 12 | app/terms/page.tsx | 454-477 | Payout holds | Hold wording kept + timing sentence |
| 13 | app/payment-policy/page.tsx | 66-69 | Paystack fees deducted | Fees added to customer |
| 14 | app/payment-policy/page.tsx | 96-100 | Platform commissions | 1% product price only |
| 15 | app/payment-policy/page.tsx | 110-134 | Payout discretion | Discretion kept + timing sentence |
| 16 | app/payment-policy/page.tsx | 155-179 | Payout holds | Hold wording kept + timing sentence |

Total LEGAL entries: **16** (12 from sheet 07b, plus 4 restated as LEGAL in sheet 07c: entries 2, 3, 15, 16; sheet 07c entry 17 duplicates sheet 07b entry 6).

No legal files (`app/terms`, `app/refund`, `app/payment-policy`) were edited.
