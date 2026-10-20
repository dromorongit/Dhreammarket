import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  ClawbackInputError,
  computeVendorClawback,
  computeVendorClawbackTarget,
  type VendorClawbackInput,
} from './clawback'

/** A GHS amount built from integer pesewas, with no float involved. */
function ghs(pesewas: number): Prisma.Decimal {
  return new Prisma.Decimal(pesewas).dividedBy(100)
}

type RunResult = {
  debits: Prisma.Decimal[]
  /** The positive magnitude of every debit so far. */
  totalClawedBack: Prisma.Decimal
}

/**
 * Run a sequence of refunds against one order item, exactly the way the
 * ledger service does: each refund sees the value refunded before it and the
 * magnitude already clawed back for the item.
 */
function runRefunds(params: {
  itemRefundableCap: Prisma.Decimal | number
  itemVendorEarnings: Prisma.Decimal | number
  parts: Array<Prisma.Decimal | number>
}): RunResult {
  let alreadyRefundedValueBefore = new Prisma.Decimal(0)
  let alreadyClawedBack = new Prisma.Decimal(0)
  const debits: Prisma.Decimal[] = []

  for (const part of params.parts) {
    const debit = computeVendorClawback({
      itemRefundableCap: params.itemRefundableCap,
      itemVendorEarnings: params.itemVendorEarnings,
      refundedValueThisRefund: part,
      alreadyRefundedValueBefore,
      alreadyClawedBack,
    })
    debits.push(debit)
    alreadyRefundedValueBefore = alreadyRefundedValueBefore.plus(part)
    alreadyClawedBack = alreadyClawedBack.plus(debit.abs())
  }

  return { debits, totalClawedBack: alreadyClawedBack }
}

describe('computeVendorClawback', () => {
  it('claws back exactly the vendor earnings on a full refund of the refundable cap', () => {
    const debit = computeVendorClawback({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      refundedValueThisRefund: 102,
      alreadyRefundedValueBefore: 0,
      alreadyClawedBack: 0,
    })

    expect(debit.toFixed(2)).toBe('-99.00')
  })

  it('claws back exactly the vendor earnings when the refund is larger than the cap', () => {
    const debit = computeVendorClawback({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      refundedValueThisRefund: 150,
      alreadyRefundedValueBefore: 0,
      alreadyClawedBack: 0,
    })

    expect(debit.toFixed(2)).toBe('-99.00')
  })

  it('never claws back more than the vendor earnings in total', () => {
    const { totalClawedBack } = runRefunds({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      parts: [10, 10, 10, 200],
    })

    expect(totalClawedBack.toFixed(2)).toBe('99.00')
  })

  it('lands on the proportional target for three awkward partial refunds, with no drift', () => {
    const { debits, totalClawedBack } = runRefunds({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      parts: [33.33, 33.33, 33.34],
    })

    // 99 * 33.33 / 102 = 32.3497... -> 32.35
    // 99 * 66.66 / 102 = 64.6994... -> 64.70, minus 32.35 -> 32.35
    // cumulative 100.00 is still below the cap -> 99 * 100 / 102 = 97.0588...
    //   -> 97.06, minus 64.70 -> 32.36
    expect(debits.map((debit) => debit.toFixed(2))).toEqual(['-32.35', '-32.35', '-32.36'])
    expect(totalClawedBack.toFixed(2)).toBe('97.06')
  })

  it('lands exactly on the vendor earnings when three partial refunds sum to the cap', () => {
    const { debits, totalClawedBack } = runRefunds({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      parts: [34, 34, 34],
    })

    // 99 * 34 / 102 = 33.00 exactly, twice, then the cap is reached -> 99.00
    expect(debits.map((debit) => debit.toFixed(2))).toEqual(['-33.00', '-33.00', '-33.00'])
    expect(totalClawedBack.toFixed(2)).toBe('99.00')
  })

  it('is proportional for a single partial refund', () => {
    const debit = computeVendorClawback({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      refundedValueThisRefund: 25,
      alreadyRefundedValueBefore: 0,
      alreadyClawedBack: 0,
    })

    // 99 * 25 / 102 = 24.2647... -> 24.26
    expect(debit.toFixed(2)).toBe('-24.26')
  })

  it('only claws back the difference when a previous debit already happened', () => {
    const debit = computeVendorClawback({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      refundedValueThisRefund: 60,
      alreadyRefundedValueBefore: 50,
      alreadyClawedBack: 45.69,
    })

    // cumulative 110 >= cap 102 -> target 99.00, minus 45.69 already clawed back.
    expect(debit.toFixed(2)).toBe('-53.31')
  })

  it('never returns a positive number, even when more was already clawed back than the target', () => {
    const debit = computeVendorClawback({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      refundedValueThisRefund: 10,
      alreadyRefundedValueBefore: 0,
      alreadyClawedBack: 200,
    })

    expect(debit.isZero()).toBe(true)
    expect(debit.toFixed(2)).toBe('0.00')
  })

  it('returns a Prisma.Decimal', () => {
    const debit = computeVendorClawback({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      refundedValueThisRefund: 102,
      alreadyRefundedValueBefore: 0,
      alreadyClawedBack: 0,
    })

    expect(debit).toBeInstanceOf(Prisma.Decimal)
  })

  describe('the denominator is the refundable cap, not the item gross', () => {
    // The worked example from the corrective pass: gross 100.00, earnings
    // 99.00, refundable cap 102.00 (the charged payment includes the
    // pass-through processing fee), a refund of 51.00.
    //
    //   cap-based  : 99.00 * 51 / 102 = 49.50   <- the correct answer
    //   gross-based: 99.00 * 51 / 100 = 50.49   <- over-debits the vendor
    it('claws back 49.50 on a half-cap refund, not 50.49', () => {
      const debit = computeVendorClawback({
        itemRefundableCap: 102,
        itemVendorEarnings: 99,
        refundedValueThisRefund: 51,
        alreadyRefundedValueBefore: 0,
        alreadyClawedBack: 0,
      })

      expect(debit.toFixed(2)).toBe('-49.50')
    })

    it('is 1.99 % lighter than the gross-based ratio would be', () => {
      const capBased = computeVendorClawback({
        itemRefundableCap: 102,
        itemVendorEarnings: 99,
        refundedValueThisRefund: 51,
        alreadyRefundedValueBefore: 0,
        alreadyClawedBack: 0,
      })

      const grossBased = computeVendorClawback({
        itemRefundableCap: 100,
        itemVendorEarnings: 99,
        refundedValueThisRefund: 51,
        alreadyRefundedValueBefore: 0,
        alreadyClawedBack: 0,
      })

      expect(capBased.toFixed(2)).toBe('-49.50')
      expect(grossBased.toFixed(2)).toBe('-50.49')
    })

    it('caps the debit when the cumulative refund runs past the cap', () => {
      const { debits, totalClawedBack } = runRefunds({
        itemRefundableCap: 102,
        itemVendorEarnings: 99,
        parts: [60, 60],
      })

      // cumulative 120 >= cap 102 -> the target is exactly the earnings.
      expect(debits.map((debit) => debit.toFixed(2))).toEqual(['-58.24', '-40.76'])
      expect(totalClawedBack.toFixed(2)).toBe('99.00')
    })
  })

  describe('degenerate inputs', () => {
    const base: VendorClawbackInput = {
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      refundedValueThisRefund: 50,
      alreadyRefundedValueBefore: 0,
      alreadyClawedBack: 0,
    }

    it('returns zero when the vendor earnings are null', () => {
      const debit = computeVendorClawback({ ...base, itemVendorEarnings: null })
      expect(debit.toFixed(2)).toBe('0.00')
    })

    it('returns zero when the vendor earnings are zero', () => {
      const debit = computeVendorClawback({ ...base, itemVendorEarnings: 0 })
      expect(debit.toFixed(2)).toBe('0.00')
    })

    it('returns zero when the vendor earnings are negative', () => {
      const debit = computeVendorClawback({ ...base, itemVendorEarnings: -10 })
      expect(debit.toFixed(2)).toBe('0.00')
    })

    it('returns zero when the refundable cap is null', () => {
      const debit = computeVendorClawback({ ...base, itemRefundableCap: null })
      expect(debit.toFixed(2)).toBe('0.00')
    })

    it('returns zero when the refundable cap is zero', () => {
      const debit = computeVendorClawback({ ...base, itemRefundableCap: 0 })
      expect(debit.toFixed(2)).toBe('0.00')
    })

    it('returns zero when the refundable cap is negative', () => {
      const debit = computeVendorClawback({ ...base, itemRefundableCap: -100 })
      expect(debit.toFixed(2)).toBe('0.00')
    })

    it('returns zero when this refund refunded nothing', () => {
      expect(
        computeVendorClawback({ ...base, refundedValueThisRefund: 0 }).toFixed(2)
      ).toBe('0.00')
      expect(
        computeVendorClawback({ ...base, refundedValueThisRefund: null }).toFixed(2)
      ).toBe('0.00')
    })

    it('returns zero when this refund refunded a negative amount', () => {
      const debit = computeVendorClawback({ ...base, refundedValueThisRefund: -10 })
      expect(debit.toFixed(2)).toBe('0.00')
    })

    it('rejects NaN', () => {
      expect(() =>
        computeVendorClawback({ ...base, itemRefundableCap: Number.NaN })
      ).toThrow(ClawbackInputError)
      expect(() =>
        computeVendorClawback({ ...base, itemVendorEarnings: Number.NaN })
      ).toThrow(ClawbackInputError)
      expect(() =>
        computeVendorClawback({ ...base, refundedValueThisRefund: Number.NaN })
      ).toThrow(ClawbackInputError)
      expect(() =>
        computeVendorClawback({ ...base, alreadyRefundedValueBefore: Number.NaN })
      ).toThrow(ClawbackInputError)
      expect(() =>
        computeVendorClawback({ ...base, alreadyClawedBack: Number.NaN })
      ).toThrow(ClawbackInputError)
    })

    it('rejects Infinity', () => {
      expect(() =>
        computeVendorClawback({ ...base, itemRefundableCap: Number.POSITIVE_INFINITY })
      ).toThrow(ClawbackInputError)
      expect(() =>
        computeVendorClawback({ ...base, itemVendorEarnings: Number.NEGATIVE_INFINITY })
      ).toThrow(ClawbackInputError)
      expect(() =>
        computeVendorClawback({ ...base, refundedValueThisRefund: Number.POSITIVE_INFINITY })
      ).toThrow(ClawbackInputError)
    })

    it('rejects a negative already-refunded value and a negative already-clawed-back value', () => {
      expect(() =>
        computeVendorClawback({ ...base, alreadyRefundedValueBefore: -1 })
      ).toThrow(ClawbackInputError)
      expect(() => computeVendorClawback({ ...base, alreadyClawedBack: -1 })).toThrow(
        ClawbackInputError
      )
    })

    it('rejects a value that is not a decimal at all', () => {
      expect(() =>
        computeVendorClawback({ ...base, itemRefundableCap: 'not-a-number' })
      ).toThrow(ClawbackInputError)
    })

    it('carries a typed code on the error', () => {
      try {
        computeVendorClawback({ ...base, itemRefundableCap: Number.NaN })
        throw new Error('expected a ClawbackInputError')
      } catch (error) {
        expect(error).toBeInstanceOf(ClawbackInputError)
        expect((error as ClawbackInputError).code).toBe('NON_FINITE_INPUT')
      }
    })
  })

  describe('float noise', () => {
    it('normalises the float noise that Float columns carry', () => {
      // 33.33 * 3 is 99.99000000000001 in binary floating point.
      const debit = computeVendorClawback({
        itemRefundableCap: 33.33 * 3,
        itemVendorEarnings: 100 - 100 * 0.01,
        refundedValueThisRefund: 33.33,
        alreadyRefundedValueBefore: 0,
        alreadyClawedBack: 0,
      })

      // Treated as a cap of 99.99 and earnings of 99.00.
      expect(debit.toFixed(2)).toBe('-33.00')
    })
  })
})

describe('computeVendorClawbackTarget', () => {
  it('is the proportional vendor share of the cumulative refunded value', () => {
    const target = computeVendorClawbackTarget({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      cumulativeRefundedValue: 51,
    })

    expect(target.toFixed(2)).toBe('49.50')
  })

  it('is exactly the vendor earnings once the cap is reached', () => {
    const target = computeVendorClawbackTarget({
      itemRefundableCap: 102,
      itemVendorEarnings: 99,
      cumulativeRefundedValue: 102,
    })

    expect(target.toFixed(2)).toBe('99.00')
  })
})

/**
 * A deterministic pseudo random generator, so the property loop below never
 * flakes: the same seed always produces the same sequence.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Split an integer pesewa amount into `parts` parts that sum exactly to it. */
function splitPesewas(total: number, parts: number, rand: () => number): number[] {
  const cuts = new Set<number>()
  while (cuts.size < parts - 1) {
    cuts.add(1 + Math.floor(rand() * (total - 1)))
  }
  const sorted = Array.from(cuts).sort((a, b) => a - b)
  const result: number[] = []
  let previous = 0
  for (const cut of sorted) {
    result.push(cut - previous)
    previous = cut
  }
  result.push(total - previous)
  return result
}

describe('computeVendorClawback - property style', () => {
  it('never claws back more than the vendor earnings and is never positive, over many random splits', () => {
    const rand = mulberry32(20261020)

    for (let iteration = 0; iteration < 500; iteration++) {
      const capPesewas = 1 + Math.floor(rand() * 50000) // 0.01 .. 500.00
      const partCount = 1 + Math.floor(rand() * Math.min(capPesewas, 8))
      const parts = splitPesewas(capPesewas, partCount, rand)

      // The vendor earns somewhere between half and all of the cap.
      const earningsPesewas = Math.round(
        capPesewas * (0.5 + rand() * 0.5)
      )

      const itemRefundableCap = ghs(capPesewas)
      const itemVendorEarnings = ghs(earningsPesewas)

      const { debits, totalClawedBack } = runRefunds({
        itemRefundableCap,
        itemVendorEarnings,
        parts: parts.map(ghs),
      })

      for (const debit of debits) {
        // Never positive.
        expect(debit.isNegative() || debit.isZero()).toBe(true)
        // Never more than the vendor earnings for the item.
        expect(debit.abs().lessThanOrEqualTo(itemVendorEarnings)).toBe(true)
      }

      // The lifetime total never exceeds the vendor earnings.
      expect(totalClawedBack.lessThanOrEqualTo(itemVendorEarnings)).toBe(true)
      // The parts cover the whole cap, so the lifetime total is exactly the
      // vendor earnings: no drift, no shortfall.
      expect(totalClawedBack.toFixed(2)).toBe(itemVendorEarnings.toFixed(2))
    }
  })

  it('never exceeds the vendor earnings when the refunds over-refund the item', () => {
    const rand = mulberry32(776611)

    for (let iteration = 0; iteration < 200; iteration++) {
      const capPesewas = 100 + Math.floor(rand() * 20000)
      const earningsPesewas = Math.round(capPesewas * (0.6 + rand() * 0.4))
      const itemRefundableCap = ghs(capPesewas)
      const itemVendorEarnings = ghs(earningsPesewas)

      // Split a value that is deliberately larger than the cap.
      const parts = splitPesewas(capPesewas * 2, 1 + Math.floor(rand() * 4), rand)

      const { totalClawedBack } = runRefunds({
        itemRefundableCap,
        itemVendorEarnings,
        parts: parts.map(ghs),
      })

      expect(totalClawedBack.lessThanOrEqualTo(itemVendorEarnings)).toBe(true)
      expect(totalClawedBack.toFixed(2)).toBe(itemVendorEarnings.toFixed(2))
    }
  })
})
