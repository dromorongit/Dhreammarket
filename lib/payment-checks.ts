export type PaystackAmountCheck = {
  ok: boolean
  underpaid: boolean
  overpaid: boolean
  wrongCurrency: boolean
  paystackAmountGhs: number
  storedAmountGhs: number
  currencyMatch: boolean
}

// Tolerance for rounding differences between pesewas and GHS display.
const TOLERANCE_GHS = 0.01

/**
 * Compare the amount Paystack charged against the amount stored on the
 * payment record, and check currency agreement.
 *
 * payment.amount is set at checkout to chargeTotal (checkout/route.ts:302),
 * which is exactly what is sent to Paystack (lib/paystack.ts:127). A
 * mismatch therefore indicates an error (wrong amount charged, tampering,
 * race condition), never a legitimate wallet/discount/fee variation.
 *
 * Returns { ok: true } only when the charged amount is within tolerance of
 * the stored amount AND the currencies match.
 */
export function checkPaystackAmount(
  paystackData: { amount: number; currency?: string | null },
  payment: { amount: number; currency: string }
): PaystackAmountCheck {
  const paystackAmountGhs = Math.round((paystackData.amount / 100) * 100) / 100
  const storedAmountGhs = payment.amount
  const paystackCurrency = paystackData.currency || 'GHS'
  const paymentCurrency = payment.currency || 'GHS'
  const currencyMatch = paystackCurrency === paymentCurrency

  const underpaid = paystackAmountGhs < storedAmountGhs - TOLERANCE_GHS
  const overpaid = paystackAmountGhs > storedAmountGhs + TOLERANCE_GHS
  const ok = !underpaid && !overpaid && currencyMatch

  return {
    ok,
    underpaid,
    overpaid,
    wrongCurrency: !currencyMatch,
    paystackAmountGhs,
    storedAmountGhs,
    currencyMatch,
  }
}
