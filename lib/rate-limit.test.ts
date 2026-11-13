import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

import { rateLimitByKey, RATE_LIMIT_CONFIGS, checkRateLimit, rateLimit, logRateLimitStoreWarning, rateLimitStoreNeedsWarning } from '@/lib/rate-limit'

describe('lib/rate-limit (rateLimitByKey)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows requests up to maxRequests then blocks the next with 429', async () => {
    const key = 'user:sa_1:admin-reset-password'
    const config = { windowMs: 60 * 60 * 1000, maxRequests: 2 }

    const first = rateLimitByKey(key, config)
    const second = rateLimitByKey(key, config)
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)

    const third = rateLimitByKey(key, config)
    expect(third.success).toBe(false)
    const failed = third as { success: false; response: NextResponse }
    expect(failed.response).toBeInstanceOf(NextResponse)
    expect(failed.response.status).toBe(429)
    const body = await failed.response.json() as { error: string }
    expect(body.error).toBe('Too many requests. Please try again later.')
  })

  it('separate keys do not share counts', () => {
    const config = { windowMs: 60 * 60 * 1000, maxRequests: 1 }

    const a1 = rateLimitByKey('key-a', config)
    const b1 = rateLimitByKey('key-b', config)
    expect(a1.success).toBe(true)
    expect(b1.success).toBe(true)

    const a2 = rateLimitByKey('key-a', config)
    const b2 = rateLimitByKey('key-b', config)
    expect(a2.success).toBe(false)
    expect(b2.success).toBe(false)
  })

  it('blocks after maxRequests using the configured admin-reset-password config', () => {
    const key = 'admin-reset-password:sa_1'
    const config = RATE_LIMIT_CONFIGS['admin-reset-password']
    expect(config).toEqual({ windowMs: 60 * 60 * 1000, maxRequests: 10 })

    for (let i = 0; i < 10; i++) {
      expect(rateLimitByKey(key, config).success).toBe(true)
    }
    expect(rateLimitByKey(key, config).success).toBe(false)
  })

  it('window reset allows new requests after the reset time', () => {
    vi.useFakeTimers()
    const base = 1_700_000_000_000
    vi.setSystemTime(base)

    const key = 'reset-window-key'
    const config = { windowMs: 1000, maxRequests: 1 }

    expect(rateLimitByKey(key, config).success).toBe(true)
    expect(rateLimitByKey(key, config).success).toBe(false)

    vi.setSystemTime(base + 1500) // past the 1000ms window
    expect(rateLimitByKey(key, config).success).toBe(true)

    vi.useRealTimers()
  })

  it('checkRateLimit returns success false when over limit', () => {
    const config = { windowMs: 60 * 60 * 1000, maxRequests: 1 }
    const first = checkRateLimit('ck-key', config)
    expect(first.success).toBe(true)
    const second = checkRateLimit('ck-key', config)
    expect(second.success).toBe(false)
    expect(second.remaining).toBe(0)
  })
})

describe('rateLimit key selection', () => {
  function request(ip: string): NextRequest {
    return new NextRequest('http://localhost/api/checkout', {
      headers: { 'x-forwarded-for': ip },
    })
  }

  it('keys authenticated requests by userId:endpoint, ignoring IP', () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimit('checkout', 'user_a')(request('10.0.0.1')).success).toBe(true)
    }
    // The 11th request from the same user is blocked even from a different IP.
    expect(rateLimit('checkout', 'user_a')(request('10.0.0.99')).success).toBe(false)
    // A different user from that same IP is not blocked.
    expect(rateLimit('checkout', 'user_b')(request('10.0.0.99')).success).toBe(true)
  })

  it('keys unauthenticated routes by IP:endpoint', () => {
    const waitlist = (ip: string) => new NextRequest('http://localhost/api/waitlist', {
      headers: { 'x-forwarded-for': ip },
    })
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('waitlist')(waitlist('10.0.0.1')).success).toBe(true)
    }
    expect(rateLimit('waitlist')(waitlist('10.0.0.1')).success).toBe(false)
    expect(rateLimit('waitlist')(waitlist('10.0.0.2')).success).toBe(true)
  })
})

describe('logRateLimitStoreWarning', () => {
  it('flags production with an unset or memory store, nothing else', () => {
    expect(rateLimitStoreNeedsWarning('production', 'memory')).toBe(true)
    expect(rateLimitStoreNeedsWarning('production', 'redis')).toBe(false)
    expect(rateLimitStoreNeedsWarning('development', 'memory')).toBe(false)
    expect(rateLimitStoreNeedsWarning('test', 'memory')).toBe(false)
    expect(rateLimitStoreNeedsWarning(undefined, 'memory')).toBe(false)
  })

  it('logs the warning when called with production and an unset or memory store', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const originalStore = process.env.RATE_LIMIT_STORE
    try {
      delete process.env.RATE_LIMIT_STORE
      logRateLimitStoreWarning('production')
      expect(warn).toHaveBeenCalledTimes(1)

      process.env.RATE_LIMIT_STORE = 'memory'
      logRateLimitStoreWarning('production')
      expect(warn).toHaveBeenCalledTimes(2)

      process.env.RATE_LIMIT_STORE = 'redis'
      logRateLimitStoreWarning('production')
      expect(warn).toHaveBeenCalledTimes(2)

      logRateLimitStoreWarning('development')
      expect(warn).toHaveBeenCalledTimes(2)
    } finally {
      if (originalStore === undefined) {
        delete process.env.RATE_LIMIT_STORE
      } else {
        process.env.RATE_LIMIT_STORE = originalStore
      }
      warn.mockRestore()
    }
  })
})
