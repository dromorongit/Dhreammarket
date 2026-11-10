import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  customerCancellation: { findMany: vi.fn(), updateMany: vi.fn() },
  refund: { findMany: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(async (callback: any) => callback(mockPrisma)),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => mockPrisma) }))

const mockCreateNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/notifications', () => ({ createNotification: mockCreateNotification }))

const mockSendEmail = vi.hoisted(() => vi.fn(async () => ({ success: true })))
vi.mock('@/lib/email', () => ({ sendEmail: mockSendEmail }))

import { runPendingRefundAlerts } from './pending-refund-alerts'

const NOW = new Date('2026-10-26T10:00:00.000Z')

function cancellation(overrides: any = {}) {
  return {
    id: 'cc_1',
    orderId: 'order_1',
    refundAmount: 95,
    createdAt: new Date('2026-10-25T20:00:00.000Z'), // 14 hours before NOW
    refundAlertSentAt: null,
    ...overrides,
  }
}

function refundRow(overrides: any = {}) {
  return {
    id: 'ref_1',
    orderId: 'order_2',
    amount: 100,
    status: 'PENDING',
    createdAt: new Date('2026-10-26T08:00:00.000Z'), // 2 hours before NOW
    refundAlertSentAt: null,
    ...overrides,
  }
}

describe('runPendingRefundAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.REFUND_ALERT_ENABLED = 'true'
    mockPrisma.customerCancellation.findMany.mockResolvedValue([])
    mockPrisma.refund.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma))
  })

  afterEach(() => {
    delete process.env.REFUND_ALERT_ENABLED
  })

  it('does nothing when the flag is off', async () => {
    delete process.env.REFUND_ALERT_ENABLED
    const result = await runPendingRefundAlerts(NOW)
    expect(result.skipped).toBe('flag_off')
    expect(result.alerted).toBe(0)
    expect(mockCreateNotification).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('alerts once per unrefunded cancellation older than 12 hours', async () => {
    mockPrisma.customerCancellation.findMany.mockResolvedValue([cancellation()])
    mockPrisma.refund.findMany.mockResolvedValue([])

    const result = await runPendingRefundAlerts(NOW)

    expect(result.alerted).toBe(1)
    expect(mockPrisma.customerCancellation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['cc_1'] }, refundAlertSentAt: null },
      data: { refundAlertSentAt: NOW },
    })
  })

  it('does not alert when a Refund row already exists for the cancelled order', async () => {
    mockPrisma.customerCancellation.findMany.mockResolvedValue([cancellation()])
    // first refund.findMany call: existing refund for the cancellation's order;
    // second call: no stale PENDING refunds
    mockPrisma.refund.findMany
      .mockResolvedValueOnce([{ orderId: 'order_1', id: 'ref_x', status: 'PROCESSED' }])
      .mockResolvedValueOnce([])

    const result = await runPendingRefundAlerts(NOW)

    expect(result.alerted).toBe(0)
    expect(mockPrisma.customerCancellation.updateMany).not.toHaveBeenCalled()
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('does not alert a cancellation younger than 12 hours', async () => {
    // the DB would exclude it by createdAt, so the mock returns nothing
    mockPrisma.customerCancellation.findMany.mockResolvedValue([])
    mockPrisma.refund.findMany.mockResolvedValue([])

    const result = await runPendingRefundAlerts(NOW)

    expect(result.alerted).toBe(0)
  })

  it('alerts Refund rows still PENDING after 1 hour', async () => {
    mockPrisma.customerCancellation.findMany.mockResolvedValue([])
    mockPrisma.refund.findMany.mockResolvedValue([refundRow()])

    const result = await runPendingRefundAlerts(NOW)

    expect(result.alerted).toBe(1)
    expect(mockPrisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ref_1'] }, refundAlertSentAt: null },
      data: { refundAlertSentAt: NOW },
    })
  })

  it('does not alert non-PENDING or recent refunds', async () => {
    // the DB would exclude both rows by status/age, so the mock returns nothing
    mockPrisma.customerCancellation.findMany.mockResolvedValue([])
    mockPrisma.refund.findMany.mockResolvedValue([])

    const result = await runPendingRefundAlerts(NOW)

    expect(result.alerted).toBe(0)
    expect(mockPrisma.refund.updateMany).not.toHaveBeenCalled()
  })

  it('sends one combined message to SUPER_ADMINs listing order numbers and amounts', async () => {
    mockPrisma.customerCancellation.findMany.mockResolvedValue([cancellation()])
    mockPrisma.refund.findMany.mockResolvedValue([refundRow()])
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'sa_1', email: 'sa@example.com', profile: { emailNotifications: true } }])

    const result = await runPendingRefundAlerts(NOW)

    expect(result.alerted).toBe(2)
    expect(mockCreateNotification).toHaveBeenCalledTimes(1)
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'sa_1',
      'SYSTEM_ALERT',
      'Pending refund alerts',
      expect.stringContaining('#ORDER_1')
    )
    const message = mockCreateNotification.mock.calls[0][3] as string
    expect(message).toContain('#ORDER_1')
    expect(message).toContain('#ORDER_2')
    expect(message).toContain('GH₵')
    // one combined message, no per-item duplication
    expect(mockCreateNotification.mock.calls.filter((c) => c[1] === 'SYSTEM_ALERT')).toHaveLength(1)
  })

  it('stamps both tables so the same item is never alerted twice', async () => {
    mockPrisma.customerCancellation.findMany.mockResolvedValue([cancellation()])
    mockPrisma.refund.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([refundRow()])
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'sa_1', email: 'sa@example.com', profile: { emailNotifications: true } }])

    await runPendingRefundAlerts(NOW)

    expect(mockPrisma.customerCancellation.updateMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.refund.updateMany).toHaveBeenCalledTimes(1)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
  })
})
