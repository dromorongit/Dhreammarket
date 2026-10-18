import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('./lib/rate-limit', () => ({
  rateLimit: vi.fn(() => () => ({ success: true })),
}))

vi.mock('./lib/auth-edge', () => ({
  verifyTokenEdge: vi.fn().mockResolvedValue(null),
}))

import { middleware } from './middleware'

beforeEach(() => vi.clearAllMocks())

describe('middleware receipt routes', () => {
  it('/receipt/* reachable without auth', async () => {
    const req = new NextRequest('http://localhost/receipt/some-token')
    const res = await middleware(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('other protected route redirects without auth', async () => {
    const req = new NextRequest('http://localhost/dashboard/vendor')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})
