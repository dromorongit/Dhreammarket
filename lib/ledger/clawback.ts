// Pure vendor clawback calculator for the Corrective Ledger.
//
// Business rule: when a customer is refunded, the VENDOR bears the cost. The
// cost is recorded as an OPEN (unapplied) debit against the vendor's balance
// and carries forward to be deducted from the vendor's NEXT payout. Deduction
// from payouts is NOT part of this task.
//
// This module is PURE: numbers go in, a number comes out. It never touches the
// database, the clock, the network or the logger, so it can be exercised
// exhaustively and its behaviour is fully determined by its arguments.
//
// SIGN CONVENTION
// ---------------
// The returned value is the debit for THIS one refund. It is zero or NEGATIVE:
// a negative amount is money withheld from the vendor, a positive amount is
// money paid to the vendor. `alreadyClawedBack` is passed in as a POSITIVE
// magnitude (the sum of the absolute values of the previous debits for the
// same order item), because that is what the subtraction below needs.
//
// THE FORMULA
// -----------
//   cumulative  = alreadyRefundedValueBefore + refundedValueThisRefund
//   target      = cumulative >= itemRefundableCap
//                   ? itemVendorEarnings
//                   : round2(itemVendorEarnings * cumulative / itemRefundableCap)
//   debit       = max(0, target - alreadyClawedBack)
//   result      = -debit
//
// The target is recomputed from the CUMULATIVE refunded value every time, so
// the debits are the successive differences of a monotonically non-decreasing
// sequence that is bounded above by the item's vendor earnings. The lifetime
// total for an item therefore never exceeds the vendor's earnings, is never
// positive, and lands exactly on the earnings when the item is fully refunded
// - with no rounding drift.
//
// WHY THE DENOMINATOR IS THE REFUNDABLE CAP, NOT THE GROSS
// --------------------------------------------------------
// The item's refundable cap is its pro-rata share of the CHARGED payment
// (lib/refunds/process-refund.ts, `Caps.forOrder`). Because the Paystack fee
// is passed through to the customer, the charged payment is about 1.99 %
// larger than the order subtotal, so the cap is about 1.0199x the item's
// gross.
//
// The denominator must be the money that can actually come back to the
// customer for that item. With the gross as the denominator the vendor is
// over-debited by about 1.99 % on every partial refund: for gross 100.00,
// earnings 99.00 and cap 102.00, a refund of 51.00 must claw back
// 99.00 * 51/102 = 49.50, not 99.00 * 51/100 = 50.49.
//
// At a FULL refund the two formulas agree, because both clamp at the item's
// vendor earnings.
//
// MONEY ARITHMETIC
// ----------------
// Every amount is a Prisma.Decimal (decimal.js). Float inputs are converted
// with `new Prisma.Decimal(String(value))` and then normalised to two decimal
// places, so the binary float noise that Float columns carry (33.33 * 3 is
// 99.99000000000001) never reaches the arithmetic. Rounding is half-up, which
// is how a human resolves an exact half.
import { Prisma } from '@prisma/client'

/** Any money value the calculator accepts. */
export type ClawbackMoney = Prisma.Decimal | number | string | null | undefined

export type VendorClawbackInput = {
  /**
   * The order item's refundable cap in GHS: its pro-rata share of the charged
   * payment, as computed by `Caps.forOrder` in lib/refunds/process-refund.ts.
   *
   * This - NOT the item gross - is the denominator of the clawback ratio.
   */
  itemRefundableCap: ClawbackMoney
  /** The order item's vendor earnings snapshot, in GHS. */
  itemVendorEarnings: ClawbackMoney
  /** The value refunded by THIS refund, in GHS. */
  refundedValueThisRefund: ClawbackMoney
  /** The value already refunded on this item BEFORE this refund, in GHS. */
  alreadyRefundedValueBefore: ClawbackMoney
  /** The POSITIVE magnitude already clawed back for this item, in GHS. */
  alreadyClawedBack: ClawbackMoney
}

/**
 * Thrown when an input cannot be interpreted.
 *
 * A malformed amount is never guessed at: the caller is told what is wrong
 * instead of being handed a number that only looks plausible.
 */
export class ClawbackInputError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ClawbackInputError'
    this.code = code
  }
}

function zero(): Prisma.Decimal {
  return new Prisma.Decimal(0)
}

/**
 * Parse one money input.
 *
 * `null`/`undefined` means "not supplied" and is returned as `null` so the
 * caller can decide what that means. A number that is not finite, or a string
 * that is not a decimal, is a broken input and is rejected.
 */
function toDecimal(value: ClawbackMoney, field: string): Prisma.Decimal | null {
  if (value === null || value === undefined) return null

  if (value instanceof Prisma.Decimal) {
    if (!value.isFinite()) {
      throw new ClawbackInputError('NON_FINITE_INPUT', `${field} must be a finite number.`)
    }
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ClawbackInputError('NON_FINITE_INPUT', `${field} must be a finite number.`)
    }
    // String() first: the binary representation of a float must never be
    // interpreted as a decimal.
    return new Prisma.Decimal(String(value))
  }

  if (typeof value === 'string') {
    let parsed: Prisma.Decimal
    try {
      parsed = new Prisma.Decimal(value.trim())
    } catch {
      throw new ClawbackInputError('INVALID_INPUT', `${field} is not a valid decimal.`)
    }
    if (!parsed.isFinite()) {
      throw new ClawbackInputError('NON_FINITE_INPUT', `${field} must be a finite number.`)
    }
    return parsed
  }

  throw new ClawbackInputError('INVALID_INPUT', `${field} is not a valid decimal.`)
}

/** Normalise to the two decimal places money is stored in. */
function toMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

/**
 * Compute the vendor clawback for ONE refund.
 *
 * Returns a Prisma.Decimal that is zero or negative:
 *   - negative: the debit to record against the vendor for this refund;
 *   - zero: there is nothing to claw back.
 */
export function computeVendorClawback(input: VendorClawbackInput): Prisma.Decimal {
  const cap = toDecimal(input.itemRefundableCap, 'itemRefundableCap')
  const earnings = toDecimal(input.itemVendorEarnings, 'itemVendorEarnings')
  const refundedNow = toDecimal(input.refundedValueThisRefund, 'refundedValueThisRefund')
  const refundedBefore = toDecimal(input.alreadyRefundedValueBefore, 'alreadyRefundedValueBefore')
  const clawedBack = toDecimal(input.alreadyClawedBack, 'alreadyClawedBack')

  // A sum of refunds and a sum of previous debits can never be negative. A
  // negative value here is a caller bug rather than a business case, so it is
  // rejected instead of being turned into a plausible-looking number.
  if (refundedBefore !== null && refundedBefore.isNegative()) {
    throw new ClawbackInputError(
      'NEGATIVE_INPUT',
      'alreadyRefundedValueBefore cannot be negative.'
    )
  }
  if (clawedBack !== null && clawedBack.isNegative()) {
    throw new ClawbackInputError('NEGATIVE_INPUT', 'alreadyClawedBack cannot be negative.')
  }

  const CAP = cap === null ? null : toMoney(cap)
  const E = earnings === null ? null : toMoney(earnings)
  const R = refundedNow === null ? null : toMoney(refundedNow)
  const R0 = refundedBefore === null ? zero() : toMoney(refundedBefore)
  const C0 = clawedBack === null ? zero() : toMoney(clawedBack)

  // Nothing to claw back:
  //   - no vendor earnings on the item (null, zero or negative);
  //   - no refundable cap to be proportional to (null, zero or negative);
  //   - this refund returned no money.
  //
  // The comparisons are `gt(0)` and not `isPositive()`: this Decimal
  // implementation reports isPositive() as true for zero, so it cannot be
  // used to mean "strictly greater than zero".
  if (E === null || !E.gt(0)) return zero()
  if (CAP === null || !CAP.gt(0)) return zero()
  if (R === null || !R.gt(0)) return zero()

  const cumulative = R0.plus(R)

  // The vendor's share of everything refunded on this item so far. Once the
  // cumulative refund reaches the item's refundable cap the target is EXACTLY
  // the item's vendor earnings - never a rounded fraction of it - so the
  // lifetime total lands on the earnings with no rounding drift.
  const target = cumulative.greaterThanOrEqualTo(CAP)
    ? E
    : E.times(cumulative).dividedBy(CAP).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)

  // The debit is the difference between the target and what has already been
  // clawed back for this item. It can never be positive.
  const debit = target.minus(C0)
  if (!debit.gt(0)) return zero()

  return debit.negated()
}

/**
 * The vendor's target debit for a cumulative refunded value.
 *
 * Exposed for the ledger service, which needs the target to reason about the
 * lifetime total of an item. It is the same computation `computeVendorClawback`
 * uses, without the `alreadyClawedBack` subtraction.
 */
export function computeVendorClawbackTarget(input: {
  /** The order item's refundable cap, in GHS. */
  itemRefundableCap: ClawbackMoney
  /** The order item's vendor earnings snapshot, in GHS. */
  itemVendorEarnings: ClawbackMoney
  /** The value refunded on this item so far, in GHS. */
  cumulativeRefundedValue: ClawbackMoney
}): Prisma.Decimal {
  const cap = toDecimal(input.itemRefundableCap, 'itemRefundableCap')
  const earnings = toDecimal(input.itemVendorEarnings, 'itemVendorEarnings')
  const cumulative = toDecimal(input.cumulativeRefundedValue, 'cumulativeRefundedValue')

  if (earnings !== null && earnings.isNegative()) {
    throw new ClawbackInputError('NEGATIVE_INPUT', 'itemVendorEarnings cannot be negative.')
  }
  if (cumulative !== null && cumulative.isNegative()) {
    throw new ClawbackInputError('NEGATIVE_INPUT', 'cumulativeRefundedValue cannot be negative.')
  }

  const CAP = cap === null ? null : toMoney(cap)
  const E = earnings === null ? null : toMoney(earnings)
  const C = cumulative === null ? zero() : toMoney(cumulative)

  if (E === null || !E.gt(0)) return zero()
  if (CAP === null || !CAP.gt(0)) return zero()
  if (!C.gt(0)) return zero()

  if (C.greaterThanOrEqualTo(CAP)) return E
  return E.times(C).dividedBy(CAP).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}
