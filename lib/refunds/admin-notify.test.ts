import { describe, it, expect, vi, beforeEach } from 'vitest'

// Tests for notifySuperAdminsRefundRequested. The critical contract is that a
// notification or email failure NEVER breaks or blocks the cancellation that
// triggered it, so every assertion below also checks the promise resolves.

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  createNotification: vi.fn(),
  sendEmail: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: () => ({ user: { findMany: mocks.userFindMany } }),
}))
vi.mock('@/lib/notifications', () => ({ createNotification: mocks.createNotification }))
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/logger', () => ({ logError: mocks.logError }))

import { notifySuperAdminsRefundRequested } from '@/lib/refunds/admin-notify'

const SUPER_ADMINS = [
  { id: 'sa_1', email: 'admin1@example.test' },
  { id: 'sa_2', email: 'admin2@example.test' },
]

const NOTICE = {
  orderId: 'order_abcdef12345678',
  total: 120.5,
  storeName: 'Fake Store',
  source: 'CUSTOMER_CANCEL' as const,
}

describe('notifySuperAdminsRefundRequested', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.userFindMany.mockResolvedValue(SUPER_ADMINS)
    mocks.createNotification.mockResolvedValue(undefined)
    mocks.sendEmail.mockResolvedValue(undefined)
  })

  it('notifies every super admin in-app and by email', async () => {
    await notifySuperAdminsRefundRequested(NOTICE)

    expect(mocks.createNotification).toHaveBeenCalledTimes(2)
    for (const admin of SUPER_ADMINS) {
      expect(mocks.createNotification).toHaveBeenCalledWith(
        admin.id,
        'SYSTEM_ALERT',
        'Refund request waiting for a decision',
        expect.stringContaining('#12345678')
      )
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: admin.email })
      )
    }
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('carries the order reference, store name and amount, and no personal data', async () => {
    await notifySuperAdminsRefundRequested(NOTICE)

    const message = mocks.createNotification.mock.calls[0][3] as string
    const email = mocks.sendEmail.mock.calls[0][0] as { subject: string; textContent: string; htmlContent: string }
    const blob = [message, email.subject, email.textContent, email.htmlContent].join('\n')

    expect(blob).toContain('#12345678')
    expect(blob).toContain('Fake Store')
    expect(blob).toContain('120.50')

    // No customer identity, contact detail or payment reference.
    for (const forbidden of ['customer@', 'buyer@', '@example.test', 'paystack', 'DHV-', '055', 'Accra', 'phone']) {
      expect(blob.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })

  it('uses the vendor rejection wording for that source', async () => {
    await notifySuperAdminsRefundRequested({
      ...NOTICE,
      source: 'VENDOR_REJECTION',
      storeName: 'Other Store',
    })

    const message = mocks.createNotification.mock.calls[0][3] as string
    expect(message).toContain('Other Store')
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('handles a multi-store order by naming no store rather than guessing', async () => {
    await notifySuperAdminsRefundRequested({ ...NOTICE, storeName: null })

    const message = mocks.createNotification.mock.calls[0][3] as string
    expect(message).toContain('a store')
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('resolves quietly when there are no super admins', async () => {
    mocks.userFindMany.mockResolvedValue([])

    await expect(notifySuperAdminsRefundRequested(NOTICE)).resolves.toBeUndefined()
    expect(mocks.createNotification).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('never throws when the admin lookup fails', async () => {
    mocks.userFindMany.mockRejectedValue(new Error('db down'))

    await expect(notifySuperAdminsRefundRequested(NOTICE)).resolves.toBeUndefined()
    expect(mocks.logError).toHaveBeenCalled()
  })

  it('never throws when an in-app notification fails', async () => {
    mocks.createNotification.mockRejectedValue(new Error('notification down'))

    await expect(notifySuperAdminsRefundRequested(NOTICE)).resolves.toBeUndefined()
  })

  it('still emails the remaining admins when one email fails', async () => {
    mocks.sendEmail
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined)

    await expect(notifySuperAdminsRefundRequested(NOTICE)).resolves.toBeUndefined()
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('skips an admin with no email address rather than failing', async () => {
    mocks.userFindMany.mockResolvedValue([
      { id: 'sa_1', email: null },
      { id: 'sa_2', email: 'admin2@example.test' },
    ])

    await expect(notifySuperAdminsRefundRequested(NOTICE)).resolves.toBeUndefined()
    expect(mocks.createNotification).toHaveBeenCalledTimes(2)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })
})
