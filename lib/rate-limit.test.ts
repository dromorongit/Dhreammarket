import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

import { rateLimitByKey, RATE_LIMIT_CONFIGS, checkRateLimit } from '@/lib/rate-limit'

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
