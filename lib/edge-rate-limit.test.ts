import { describe, it, expect } from 'vitest'
import { checkEdgeRateLimit, getEdgeClientIP } from './edge-rate-limit'

describe('edge-rate-limit', () => {
  it('allows requests under the limit', () => {
    const result = checkEdgeRateLimit('under-limit', { windowMs: 1000, maxRequests: 2 }, 1000)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
    expect(result.limit).toBe(2)
  })

  it('blocks request N+1', () => {
    checkEdgeRateLimit('block-n-plus-one', { windowMs: 1000, maxRequests: 2 }, 1000)
    checkEdgeRateLimit('block-n-plus-one', { windowMs: 1000, maxRequests: 2 }, 1000)
    const result = checkEdgeRateLimit('block-n-plus-one', { windowMs: 1000, maxRequests: 2 }, 1000)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after the window with injected now', () => {
    checkEdgeRateLimit('window-reset', { windowMs: 1000, maxRequests: 2 }, 1000)
    checkEdgeRateLimit('window-reset', { windowMs: 1000, maxRequests: 2 }, 1000)
    const result = checkEdgeRateLimit('window-reset', { windowMs: 1000, maxRequests: 2 }, 2001)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('keeps separate keys independent', () => {
    checkEdgeRateLimit('key-a', { windowMs: 1000, maxRequests: 1 }, 1000)
    const blocked = checkEdgeRateLimit('key-a', { windowMs: 1000, maxRequests: 1 }, 1000)
    const allowed = checkEdgeRateLimit('key-b', { windowMs: 1000, maxRequests: 1 }, 1000)
    expect(blocked.success).toBe(false)
    expect(allowed.success).toBe(true)
  })

  it('respects the hard cap', () => {
    for (let i = 0; i < 10000; i += 1) {
      checkEdgeRateLimit(`hard-cap-${i}`, { windowMs: 1000, maxRequests: 1 }, 1000)
    }
    const extra = checkEdgeRateLimit('hard-cap-extra', { windowMs: 1000, maxRequests: 1 }, 1000)
    expect(extra.success).toBe(true)
    const evicted = checkEdgeRateLimit('hard-cap-0', { windowMs: 1000, maxRequests: 1 }, 1000)
    expect(evicted.success).toBe(true)
  })

  it('extracts client IP from headers', () => {
    const headers = new Headers()
    headers.set('x-forwarded-for', '203.0.113.9, 10.0.0.1')
    expect(getEdgeClientIP(headers)).toBe('203.0.113.9')

    const realHeaders = new Headers()
    realHeaders.set('x-real-ip', '198.51.100.4')
    expect(getEdgeClientIP(realHeaders)).toBe('198.51.100.4')

    const cfHeaders = new Headers()
    cfHeaders.set('cf-connecting-ip', '192.0.2.7')
    expect(getEdgeClientIP(cfHeaders)).toBe('192.0.2.7')

    expect(getEdgeClientIP(new Headers())).toBe('unknown')
  })
})
