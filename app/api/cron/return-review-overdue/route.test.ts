import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRun = vi.hoisted(() => vi.fn(async () => ({ ok: true, considered: 3, escalated: 2 })))
vi.mock('@/lib/returns/return-review-overdue', () => ({
  runReturnReviewOverdue: mockRun,
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))

import { POST } from '@/app/api/cron/return-review-overdue/route'

const mockRunReturnReviewOverdue = vi.mocked(mockRun)

function buildRequest(authHeader: string | null, url = 'http://localhost/api/cron/return-review-overdue'): NextRequest {
  const headers = new Headers()
  if (authHeader) {
    headers.set('authorization', authHeader)
  }
  return new NextRequest(url, { headers })
}

describe('Return review overdue cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunReturnReviewOverdue.mockResolvedValue({ ok: true, considered: 3, escalated: 2 })
  })

  it('returns 500 when CRON_SECRET is not set', async () => {
    const original = process.env.CRON_SECRET
    delete process.env.CRON_SECRET

    const response = await POST(buildRequest('Bearer any-token'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Server misconfigured')

    if (original !== undefined) {
      process.env.CRON_SECRET = original
    }
  })

  it('returns 401 when Bearer token does not match', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const response = await POST(buildRequest('Bearer wrong-token'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when no authorization header is sent', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const response = await POST(buildRequest(null))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 200 and runs the overdue escalation when authorized and the flag is on', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    process.env.BUSINESS_DAY_RETURN_REVIEW_ENABLED = 'true'

    const response = await POST(buildRequest('Bearer correct-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockRunReturnReviewOverdue).toHaveBeenCalled()
  })

  it('returns 200 and skips when the flag is off', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    delete process.env.BUSINESS_DAY_RETURN_REVIEW_ENABLED

    const response = await POST(buildRequest('Bearer correct-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.skipped).toBe('flag_off')
    expect(mockRunReturnReviewOverdue).not.toHaveBeenCalled()
  })
})
