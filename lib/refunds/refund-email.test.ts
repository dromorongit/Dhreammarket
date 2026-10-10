import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  refundFindUnique: vi.fn(),
  sendRefundConfirmationEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: () => ({ refund: { findUnique: mocks.refundFindUnique } }) }))
vi.mock('@/lib/email', () => ({ sendRefundConfirmationEmail: mocks.sendRefundConfirmationEmail }))
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), logWarn: vi.fn(), logInfo: vi.fn() }))

import { notifyRefundProcessed, resetRefundEmailsForTest } from '@/lib/refunds/refund-email'

function refundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'refund_1',
    orderId: 'order_1',
    amount: 30,
    currency: 'GHS',
    status: 'PROCESSED',
    order: {
      user: { email: 'customer@example.test', profile: { firstName: 'Ada' } },
    },
    ...overrides,
  }
}

describe('notifyRefundProcessed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRefundEmailsForTest()
    mocks.refundFindUnique.mockResolvedValue(refundRow())
    mocks.sendRefundConfirmationEmail.mockResolvedValue(undefined)
  })

  it('sends the refund confirmation for a PROCESSED row', async () => {
    await notifyRefundProcessed('refund_1')

    expect(mocks.sendRefundConfirmationEmail).toHaveBeenCalledWith(
      'customer@example.test',
      'Ada',
      'order_1',
      30,
      'GHS'
    )
  })

  it('never sends twice for the same Refund id', async () => {
    await notifyRefundProcessed('refund_1')
    await notifyRefundProcessed('refund_1')
    await notifyRefundProcessed('refund_1')

    expect(mocks.sendRefundConfirmationEmail).toHaveBeenCalledTimes(1)
  })

  it('sends once per Refund row, so a partially refunded order announces each refund', async () => {
    mocks.refundFindUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 'refund_1') return refundRow({ id: 'refund_1', amount: 30 })
      return refundRow({ id: 'refund_2', orderId: 'order_1', amount: 70 })
    })

    await notifyRefundProcessed('refund_1')
    await notifyRefundProcessed('refund_2')

    // Two rows, two emails - one per refund, not one per order.
    expect(mocks.sendRefundConfirmationEmail).toHaveBeenCalledTimes(2)
    expect(mocks.sendRefundConfirmationEmail.mock.calls.map((call: any[]) => call[3])).toEqual([30, 70])
  })

  it('does not send for a row that is not PROCESSED', async () => {
    for (const status of ['PENDING', 'PROCESSING', 'NEEDS_ATTENTION', 'FAILED']) {
      mocks.refundFindUnique.mockResolvedValue(refundRow({ status }))
      await notifyRefundProcessed('refund_1')
    }

    expect(mocks.sendRefundConfirmationEmail).not.toHaveBeenCalled()
  })

  it('does not send when the refund row cannot be found', async () => {
    mocks.refundFindUnique.mockResolvedValue(null)

    await notifyRefundProcessed('missing')

    expect(mocks.sendRefundConfirmationEmail).not.toHaveBeenCalled()
  })

  it('does not send when the customer has no email address', async () => {
    mocks.refundFindUnique.mockResolvedValue(
      refundRow({ order: { user: { email: null, profile: null } } })
    )

    await notifyRefundProcessed('refund_1')

    expect(mocks.sendRefundConfirmationEmail).not.toHaveBeenCalled()
  })

  it('swallows a mail provider failure so the refund itself is not broken', async () => {
    mocks.sendRefundConfirmationEmail.mockRejectedValue(new Error('smtp down'))

    await expect(notifyRefundProcessed('refund_1')).resolves.toBeUndefined()
  })

  it('falls back to the email local part when the profile has no first name', async () => {
    mocks.refundFindUnique.mockResolvedValue(
      refundRow({ order: { user: { email: 'grace@example.test', profile: null } } })
    )

    await notifyRefundProcessed('refund_1')

    expect(mocks.sendRefundConfirmationEmail).toHaveBeenCalledWith(
      'grace@example.test',
      'grace',
      'order_1',
      30,
      'GHS'
    )
  })
})
