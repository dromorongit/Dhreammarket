import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('./lib/auth-edge', () => ({
  verifyTokenEdge: vi.fn().mockResolvedValue(null),
}))

import { middleware } from './middleware'

describe('middleware receipt routes', () => {
  it('/receipt/* reachable without auth', async () => {
    const req = new NextRequest('http://localhost/receipt/some-token')
    const res = await middleware(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('receipt rate limiting returns 429 after the limit through the new limiter', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.77' }
    for (let i = 0; i < 60; i += 1) {
      const req = new NextRequest('http://localhost/receipt/some-token', { headers })
      const res = await middleware(req)
      expect(res.status).toBe(200)
    }

    const blocked = await middleware(new NextRequest('http://localhost/receipt/some-token', { headers }))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('other protected route redirects without auth', async () => {
    const req = new NextRequest('http://localhost/dashboard/vendor')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('/api requests pass through unchanged', async () => {
    const req = new NextRequest('http://localhost/api/homepage/public')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })
})
