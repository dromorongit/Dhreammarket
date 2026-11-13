import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/cron/vendor-completion-reminders/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/vendor-completion-reminders', () => ({
  runVendorCompletionReminders: vi.fn(async () => ({ ok: true, sent: 2, considered: 5 })),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))

import { runVendorCompletionReminders } from '@/lib/vendor-completion-reminders'

const mockRunVendorCompletionReminders = vi.mocked(runVendorCompletionReminders)

function buildRequest(authHeader: string | null, url = 'http://localhost/api/cron/vendor-completion-reminders'): NextRequest {
  const headers = new Headers()
  if (authHeader) {
    headers.set('authorization', authHeader)
  }
  return new NextRequest(url, { headers })
}

describe('Vendor completion reminders cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunVendorCompletionReminders.mockResolvedValue({ ok: true, sent: 2, considered: 5 })
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

  it('returns 200 and runs the reminder when authorized', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    process.env.VENDOR_COMPLETION_REMINDER_ENABLED = 'true'

    const response = await POST(buildRequest('Bearer correct-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockRunVendorCompletionReminders).toHaveBeenCalled()
  })

  it('returns 401 when no authorization header is sent', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const response = await POST(buildRequest(null))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })
})
