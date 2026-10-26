import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isReturnsFlowEnabled,
  getReturnWindowDays,
  getVendorResponseHours,
} from '@/lib/returns/config'

const origEnv = process.env
beforeEach(() => {
  process.env = { ...origEnv }
})
afterEach(() => {
  process.env = origEnv
})

function env(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

describe('isReturnsFlowEnabled', () => {
  it('defaults false when unset', () => {
    env('RETURNS_FLOW_ENABLED', undefined)
    expect(isReturnsFlowEnabled()).toBe(false)
  })
  it('is false for null', () => {
    process.env.RETURNS_FLOW_ENABLED = null as unknown as string
    expect(isReturnsFlowEnabled()).toBe(false)
  })
  it('is true for "true"', () => {
    env('RETURNS_FLOW_ENABLED', 'true')
    expect(isReturnsFlowEnabled()).toBe(true)
  })
  it('is true for uppercase and trimmed variants', () => {
    env('RETURNS_FLOW_ENABLED', 'TRUE')
    expect(isReturnsFlowEnabled()).toBe(true)
    env('RETURNS_FLOW_ENABLED', ' true ')
    expect(isReturnsFlowEnabled()).toBe(true)
  })
  it('is false for "false" and other non-true values', () => {
    env('RETURNS_FLOW_ENABLED', 'false')
    expect(isReturnsFlowEnabled()).toBe(false)
    env('RETURNS_FLOW_ENABLED', 'yes')
    expect(isReturnsFlowEnabled()).toBe(false)
    env('RETURNS_FLOW_ENABLED', '1')
    expect(isReturnsFlowEnabled()).toBe(false)
  })
})

describe('getReturnWindowDays', () => {
  it('defaults 7 when unset/null/empty', () => {
    env('RETURN_WINDOW_DAYS', undefined)
    expect(getReturnWindowDays()).toBe(7)
    process.env.RETURN_WINDOW_DAYS = null as unknown as string
    expect(getReturnWindowDays()).toBe(7)
    env('RETURN_WINDOW_DAYS', '')
    expect(getReturnWindowDays()).toBe(7)
  })
  it('returns valid in-range integers', () => {
    env('RETURN_WINDOW_DAYS', '0')
    expect(getReturnWindowDays()).toBe(0)
    env('RETURN_WINDOW_DAYS', '7')
    expect(getReturnWindowDays()).toBe(7)
    env('RETURN_WINDOW_DAYS', '60')
    expect(getReturnWindowDays()).toBe(60)
  })
  it('falls back to 7 for decimals, negatives, out-of-range and non-numeric', () => {
    for (const v of ['7.5', '-1', '61', '100', 'abc', '   ', '7,8']) {
      env('RETURN_WINDOW_DAYS', v)
      expect(getReturnWindowDays()).toBe(7)
    }
  })
})

describe('getVendorResponseHours', () => {
  it('defaults 72 when unset/null/empty', () => {
    env('VENDOR_RESPONSE_HOURS', undefined)
    expect(getVendorResponseHours()).toBe(72)
    process.env.VENDOR_RESPONSE_HOURS = null as unknown as string
    expect(getVendorResponseHours()).toBe(72)
    env('VENDOR_RESPONSE_HOURS', '')
    expect(getVendorResponseHours()).toBe(72)
  })
  it('returns valid in-range integers', () => {
    env('VENDOR_RESPONSE_HOURS', '1')
    expect(getVendorResponseHours()).toBe(1)
    env('VENDOR_RESPONSE_HOURS', '72')
    expect(getVendorResponseHours()).toBe(72)
    env('VENDOR_RESPONSE_HOURS', '720')
    expect(getVendorResponseHours()).toBe(720)
  })
  it('falls back to 72 for decimals, out-of-range and non-numeric', () => {
    for (const v of ['72.5', '0', '-5', '721', '1000', 'abc']) {
      env('VENDOR_RESPONSE_HOURS', v)
      expect(getVendorResponseHours()).toBe(72)
    }
  })
})
