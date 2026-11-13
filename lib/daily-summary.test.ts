import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  store: { findMany: vi.fn() },
  vendorSettings: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: { findMany: vi.fn() },
  order: { findMany: vi.fn(), count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))
vi.mock('@/lib/vendor-sales-data', () => ({ loadVendorReceivables: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendVendorDailySummaryEmail: vi.fn() }))

import { runDailySummaries } from '@/lib/daily-summary'
import type { DailySummaryResult } from '@/lib/daily-summary'
import { loadVendorReceivables } from '@/lib/vendor-sales-data'
import { createNotification } from '@/lib/notifications'
import { sendVendorDailySummaryEmail } from '@/lib/email'

type SentResult = Extract<DailySummaryResult, { sent: number }>

const NOW_19 = new Date('2026-11-06T19:00:00Z') // 19:00 Accra (UTC+0)
const NOW_18 = new Date('2026-11-06T18:00:00Z') // before send time

function storeRow(userId = 'vendor_1', storeId = 'store_1') {
  return { id: storeId, userId, name: 'Store 1' }
}

function mockDefaults() {
  prismaMock.store.findMany.mockResolvedValue([storeRow()])
  prismaMock.vendorSettings.findMany.mockResolvedValue([
    { userId: 'vendor_1', notifyDailySummary: true, lastDailySummaryDate: null },
  ])
  prismaMock.vendorSettings.findUnique.mockResolvedValue({
    userId: 'vendor_1',
    lastDailySummaryDate: NOW_19,
  })
  prismaMock.user.findMany.mockResolvedValue([
    { id: 'vendor_1', email: 'vendor@example.com', profile: { emailNotifications: true } },
  ])
  prismaMock.vendorSettings.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.order.findMany.mockResolvedValue([])
  prismaMock.order.count.mockResolvedValue(0)
  vi.mocked(loadVendorReceivables).mockResolvedValue({ amountPesawas: 0 } as never)
  vi.mocked(createNotification).mockResolvedValue(undefined)
  vi.mocked(sendVendorDailySummaryEmail).mockResolvedValue({ success: true } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDefaults()
})

function asSent(result: DailySummaryResult): SentResult {
  if ('skipped' in result) {
    throw new Error('expected a sent result, got skipped')
  }
  return result
}

describe('runDailySummaries', () => {
  it('skips before 19:00 Accra and does not touch the database', async () => {
    const result = await runDailySummaries(NOW_18)
    expect(result).toEqual({ skipped: 'before_send_time' })
    expect(prismaMock.store.findMany).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('sends only one summary per vendor per Accra day', async () => {
    prismaMock.order.count.mockResolvedValue(1) // one PROCESSING order to dispatch
    prismaMock.vendorSettings.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.vendorSettings.updateMany.mockResolvedValueOnce({ count: 1 }) // first run claims

    await runDailySummaries(NOW_19)
    await runDailySummaries(NOW_19)

    expect(createNotification).toHaveBeenCalledTimes(1)
  })

  it('skips a quiet vendor who opted out', async () => {
    prismaMock.vendorSettings.findMany.mockResolvedValue([
      { userId: 'vendor_1', notifyDailySummary: false, lastDailySummaryDate: null },
    ])

    const result = await runDailySummaries(NOW_19)
    const r = asSent(result)
    expect(r.quiet).toBe(1)
    expect(r.sent).toBe(0)
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('still sends a summary for a backlog-only vendor (no today orders, PROCESSING orders)', async () => {
    prismaMock.order.count.mockResolvedValue(3) // old PROCESSING orders to dispatch

    const result = await runDailySummaries(NOW_19)
    const r = asSent(result)
    expect(r.sent).toBe(1)
    expect(createNotification).toHaveBeenCalledWith(
      'vendor_1',
      'DAILY_SUMMARY',
      'Daily sales summary',
      expect.stringContaining('Orders to dispatch: 3'),
    )
  })

  it('excludes abandoned online orders from today', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'order_abandoned',
        paymentStatus: 'PENDING',
        source: 'ONLINE',
        status: 'PENDING',
        total: 100,
        deliveryCost: null,
        items: [],
      },
    ])
    prismaMock.order.count.mockResolvedValue(0)

    await runDailySummaries(NOW_19)
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('rolls back the claim when the send fails so the next run retries', async () => {
    prismaMock.order.count.mockResolvedValue(1) // activity so the notification is attempted
    prismaMock.vendorSettings.updateMany.mockResolvedValue({ count: 1 })
    vi.mocked(createNotification).mockRejectedValue(new Error('down'))

    const result = await runDailySummaries(NOW_19)
    const r = asSent(result)
    expect(r.failed).toBe(1)
    expect(r.sent).toBe(0)
    // Previous claim date was null, so the rollback restores null.
    expect(prismaMock.vendorSettings.update).toHaveBeenCalledWith({
      where: { userId: 'vendor_1' },
      data: { lastDailySummaryDate: null },
    })
  })
})
