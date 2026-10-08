import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/cron/influencer-trial-expiry/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/influencer/vendor-trial', () => ({
  downgradeExpiredInfluencerTrials: vi.fn(() => Promise.resolve({ processed: 0 })),
  notifyExpiringInfluencerTrials: vi.fn(() => Promise.resolve({ notified: 0 })),
}))

import { downgradeExpiredInfluencerTrials, notifyExpiringInfluencerTrials } from '@/lib/influencer/vendor-trial'

const mockDowngrade = vi.mocked(downgradeExpiredInfluencerTrials)
const mockNotify = vi.mocked(notifyExpiringInfluencerTrials)

function buildRequest(authHeader: string | null, url = 'http://localhost/api/cron/influencer-trial-expiry'): NextRequest {
  const headers = new Headers()
  if (authHeader) {
    headers.set('authorization', authHeader)
  }
  return new NextRequest(url, { headers })
}

describe('Influencer trial expiry cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDowngrade.mockResolvedValue({ processed: 1 })
    mockNotify.mockResolvedValue({ notified: 2 })
  })

  it('returns 500 when CRON_SECRET is not set', async () => {
    const original = process.env.CRON_SECRET
    delete process.env.CRON_SECRET

    const request = buildRequest('Bearer any-token')
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Server misconfigured')

    if (original !== undefined) {
      process.env.CRON_SECRET = original
    }
  })

  it('returns 401 when Bearer token does not match', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const request = buildRequest('Bearer wrong-token')
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 200 and runs downgrade when authorized', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const request = buildRequest('Bearer correct-secret')
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockDowngrade).toHaveBeenCalled()
    expect(mockNotify).toHaveBeenCalled()
  })

  it('supports dryRun mode without modifying data', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const request = buildRequest('Bearer correct-secret', 'http://localhost/api/cron/influencer-trial-expiry?dryRun=true')
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.dryRun).toBe(true)
    expect(mockDowngrade).toHaveBeenCalledWith(true)
  })
})
