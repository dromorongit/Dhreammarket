import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRun = vi.hoisted(() => vi.fn(async () => ({ ok: true, alerted: 2 })))
vi.mock('@/lib/refunds/pending-refund-alerts', () => ({
  runPendingRefundAlerts: mockRun,
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))

import { POST } from '@/app/api/cron/pending-refund-alerts/route'

const mockRunPendingRefundAlerts = vi.mocked(mockRun)

function buildRequest(authHeader: string | null, url = 'http://localhost/api/cron/pending-refund-alerts'): NextRequest {
  const headers = new Headers()
  if (authHeader) {
    headers.set('authorization', authHeader)
  }
  return new NextRequest(url, { headers })
}

describe('Pending refund alerts cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunPendingRefundAlerts.mockResolvedValue({ ok: true, alerted: 2 })
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

  it('returns 200 and runs the alert when authorized and the flag is on', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    process.env.REFUND_ALERT_ENABLED = 'true'

    const response = await POST(buildRequest('Bearer correct-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockRunPendingRefundAlerts).toHaveBeenCalled()
  })

  it('returns 200 and skips when the flag is off', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    delete process.env.REFUND_ALERT_ENABLED

    const response = await POST(buildRequest('Bearer correct-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.skipped).toBe('flag_off')
    expect(mockRunPendingRefundAlerts).not.toHaveBeenCalled()
  })
})
