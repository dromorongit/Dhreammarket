import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPayoutLedgerMode, getPayoutHoldDays } from './payout-config'

describe('getPayoutLedgerMode', () => {
  const orig = process.env.PAYOUT_LEDGER_MODE
  afterEach(() => {
    if (orig === undefined) delete process.env.PAYOUT_LEDGER_MODE
    else process.env.PAYOUT_LEDGER_MODE = orig
  })
  beforeEach(() => delete process.env.PAYOUT_LEDGER_MODE)

  it.each([
    [undefined, 'off'],
    ['', 'off'],
    ['off', 'off'],
    ['compare', 'compare'],
    ['enforce', 'enforce'],
    ['COMPARE', 'compare'],
    ['Enforce', 'enforce'],
    ['  compare  ', 'compare'],
    ['garbage', 'off'],
  ])('mode %p -> %p', (val, expected) => {
    if (val === undefined) delete process.env.PAYOUT_LEDGER_MODE
    else process.env.PAYOUT_LEDGER_MODE = val as string
    expect(getPayoutLedgerMode()).toBe(expected)
  })
})

describe('getPayoutHoldDays', () => {
  const orig = process.env.PAYOUT_HOLD_DAYS
  afterEach(() => {
    if (orig === undefined) delete process.env.PAYOUT_HOLD_DAYS
    else process.env.PAYOUT_HOLD_DAYS = orig
  })
  beforeEach(() => delete process.env.PAYOUT_HOLD_DAYS)

  it.each([
    [undefined, 7],
    ['', 7],
    ['7', 7],
    ['0', 0],
    ['90', 90],
    ['91', 7],
    ['-1', 7],
    ['7.5', 7],
    ['abc', 7],
  ])('hold days %p -> %p', (val, expected) => {
    if (val === undefined) delete process.env.PAYOUT_HOLD_DAYS
    else process.env.PAYOUT_HOLD_DAYS = val as string
    expect(getPayoutHoldDays()).toBe(expected)
  })
})
