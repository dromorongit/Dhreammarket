import {
  CANCELLATION_FEE_GHS,
  FREE_WINDOW_MINUTES,
  BLOCK_THRESHOLD,
  BLOCK_WINDOW_DAYS,
  BLOCK_MONTHS,
} from './cancellation-policy'

export const POLICY_EFFECTIVE_DATE = '2027-01-11'

export const POLICY_EFFECTIVE_DATE_DISPLAY =
  'These rules apply to orders placed on or after 11 January 2027. Orders placed before this date are handled under the policies in place when they were placed.'

export const CANCELLATION_PARAGRAPH =
  `Cancellation is free within 1 hour of payment confirmation (${FREE_WINDOW_MINUTES} minutes) if the order has not shipped. After the first hour and before shipment, a GHS ${CANCELLATION_FEE_GHS} fee applies, deducted from the refund. Once the vendor ships the order, it cannot be cancelled. Paystack's processing fee is not refunded. Every paid cancellation counts, including free ones. Cancelling ${BLOCK_THRESHOLD} orders within any ${BLOCK_WINDOW_DAYS} days blocks all cancellations for the next ${BLOCK_MONTHS} months, starting right after the ${BLOCK_THRESHOLD}th cancellation. Unpaid and manual orders are exempt. Wallet credit used on the order is returned to the wallet.`

export const CANCELLATION_FAQ_SHORT =
  `Cancellation rules: free within ${FREE_WINDOW_MINUTES} minutes of payment confirmation if not shipped; after that and before shipment a GHS ${CANCELLATION_FEE_GHS} fee applies; no cancellation once the vendor ships; Paystack's processing fee is not refunded. Full rules on the Refund and Return Policy page.`

export const RETURNS_RULE =
  'A return must be started within 1 day of the vendor marking the order completed if the delivery address is in the Greater Accra Region, and within 3 days otherwise. Manual orders always use the 3-day return window.'

export const RETURN_REVIEW =
  'The vendor has 1 business day to review a return request, counted from when you submit it.'

export const REFUND_TIMING =
  'Once a return is approved, Dhream Market processes the refund within 24 hours. How long the money takes to appear in your bank or mobile money account after that depends on your payment provider.'

export const PAYOUT_RULE =
  'Vendors receive 100% of the product price minus 1% platform commission (deducted before payout). Paystack processing fees are added to the customer\'s payment, not deducted from the vendor. Payouts are released within 2 business days after the vendor marks the order completed, as long as there are no open returns or disputes on the order. While a return or dispute is open, the payout is held until it is settled. Business days are Monday to Friday and exclude Ghanaian public holidays.'

export const COMMISSION_RULE =
  'Platform commission is 1% of the product price only (not shipping), deducted from the vendor\'s earnings before payout.'

export const MANUAL_ORDERS_COMMISSION =
  'Manual orders: 0% commission. The Paystack processing fee on a manual order is paid by the vendor.'

export const COMPLETION_RULE =
  'Buyers confirm receipt with the vendor, and the vendor marks the order completed only after the buyer has received it.'

export const MANUAL_ORDERS_RULE =
  'A manual order is an order a vendor creates themselves for a sale made outside the Dhream Market catalogue, for example on WhatsApp, Instagram, in a physical shop or to a walk-in customer. The vendor shares a payment link, the customer pays, and the vendor fulfils the order.'

export const MANUAL_ORDERS_RETURN_RULE =
  'Return rules apply to manual orders. Manual orders always use the 3-day return window, and the vendor refunds the buyer directly.'
