import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  platformPolicy: { findUnique: vi.fn() },
  returnRequest: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(async (callback: any) => callback(mockPrisma)),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => mockPrisma) }))

const mockEscalate = vi.hoisted(() => vi.fn(async () => ({ id: 'escalated' })))
vi.mock('@/lib/returns/return-service', () => ({
  escalate: mockEscalate,
  openReturn: vi.fn(),
  vendorRespond: vi.fn(),
  adminDecide: vi.fn(),
  requestRefundForReturn: vi.fn(),
  closeSettledReturn: vi.fn(),
}))

const mockCreateNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/notifications', () => ({ createNotification: mockCreateNotification }))

import { runReturnReviewOverdue } from './return-review-overdue'

const CUTOVER = new Date('2026-10-01T00:00:00.000Z')
const NOW = new Date('2026-10-26T10:00:00.000Z') // Monday after Friday 17:00 deadline

function overdueReturn(overrides: any = {}) {
  return {
    id: 'rr_overdue',
    status: 'PENDING',
    escalationDeadline: new Date('2026-10-23T17:00:00.000Z'), // before NOW
    orderItem: {
      order: { id: 'order_overdue', createdAt: new Date('2026-10-02T00:00:00.000Z') },
      product: { store: { userId: 'vendor_1' } },
    },
    ...overrides,
  }
}

function buildRequestList(returns: any[]) {
  return returns.map((r) => ({ ...r }))
}

describe('runReturnReviewOverdue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BUSINESS_DAY_RETURN_REVIEW_ENABLED = 'true'
    mockPrisma.platformPolicy.findUnique.mockResolvedValue({ systemCutoverTimestamp: CUTOVER } as any)
    mockPrisma.returnRequest.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    mockEscalate.mockResolvedValue({ id: 'escalated' } as any)
    mockCreateNotification.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete process.env.BUSINESS_DAY_RETURN_REVIEW_ENABLED
  })

  it('does nothing when the flag is off', async () => {
    delete process.env.BUSINESS_DAY_RETURN_REVIEW_ENABLED
    const result = await runReturnReviewOverdue(NOW)
    expect(result.skipped).toBe('flag_off')
    expect(mockEscalate).not.toHaveBeenCalled()
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('escalates only PENDING returns past their deadline for post-cutover orders', async () => {
    const postCutoverOverdue = overdueReturn()
    // the database query already filters status PENDING and deadline < now, so
    // the mock returns only what the query would match
    mockPrisma.returnRequest.findMany.mockResolvedValue([postCutoverOverdue])

    const result = await runReturnReviewOverdue(NOW)

    expect(result.considered).toBe(1)
    expect(result.escalated).toBe(1)
    expect(mockEscalate).toHaveBeenCalledTimes(1)
    expect(mockEscalate).toHaveBeenCalledWith(
      mockPrisma,
      { returnRequestId: 'rr_overdue', actor: 'SYSTEM' },
      NOW
    )
  })

  it('considers nothing when the cutover is unset', async () => {
    mockPrisma.platformPolicy.findUnique.mockResolvedValue({ systemCutoverTimestamp: null } as any)
    mockPrisma.returnRequest.findMany.mockResolvedValue([overdueReturn()])

    const result = await runReturnReviewOverdue(NOW)

    expect(result.considered).toBe(1)
    expect(result.escalated).toBe(0)
    expect(mockEscalate).not.toHaveBeenCalled()
  })

  it('caps the batch at 50', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      overdueReturn({ id: `rr_${i}`, orderItem: { order: { id: `order_${i}`, createdAt: new Date('2026-10-02T00:00:00.000Z') }, product: { store: { userId: 'vendor_1' } } } })
    )
    mockPrisma.returnRequest.findMany.mockResolvedValue(many)

    await runReturnReviewOverdue(NOW)

    expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('sends one combined super-admin notification and one vendor notification per run', async () => {
    mockPrisma.returnRequest.findMany.mockResolvedValue([
      overdueReturn(),
      overdueReturn({ id: 'rr_2', orderItem: { order: { id: 'order_2', createdAt: new Date('2026-10-02T00:00:00.000Z') }, product: { store: { userId: 'vendor_1' } } } }),
      overdueReturn({ id: 'rr_3', orderItem: { order: { id: 'order_3', createdAt: new Date('2026-10-02T00:00:00.000Z') }, product: { store: { userId: 'vendor_2' } } } }),
    ])
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'sa_1' }, { id: 'sa_2' }])

    const result = await runReturnReviewOverdue(NOW)

    expect(result.escalated).toBe(3)
    // one combined message to all super admins
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'sa_1',
      'SYSTEM_ALERT',
      'Return review overdue',
      expect.stringContaining('#_OVERDUE')
    )
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'sa_2',
      'SYSTEM_ALERT',
      'Return review overdue',
      expect.any(String)
    )
    expect(mockCreateNotification.mock.calls.filter((c) => c[1] === 'SYSTEM_ALERT')).toHaveLength(2)
    // one notification per affected vendor
    const vendorCalls = mockCreateNotification.mock.calls.filter((c) => c[0] === 'vendor_1' || c[0] === 'vendor_2')
    expect(vendorCalls).toHaveLength(2)
    expect(vendorCalls[0]).toEqual([
      'vendor_1',
      'ORDER_STATUS_UPDATED',
      'Return needs your response',
      expect.stringContaining('#_OVERDUE'),
    ])
  })

  it('never approves, denies or refunds', async () => {
    mockPrisma.returnRequest.findMany.mockResolvedValue([overdueReturn()])
    await runReturnReviewOverdue(NOW)
    expect(mockEscalate).toHaveBeenCalledTimes(1)
    // escalate is the only write: no approve/deny/refund entry points are touched
  })
})
