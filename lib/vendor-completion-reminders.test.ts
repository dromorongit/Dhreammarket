import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runVendorCompletionReminders } from '@/lib/vendor-completion-reminders'
import { sendEmail } from '@/lib/email'

const CUTOVER = new Date('2026-10-01T00:00:00.000Z')
const NOW = new Date('2026-11-10T12:00:00.000Z')
const DELIVERED_24H_AGO = new Date(NOW.getTime() - 24 * 60 * 60 * 1000)
const DELIVERED_72H_AGO = new Date(NOW.getTime() - 72 * 60 * 60 * 1000)

const mockNotificationCreate = vi.fn()
const mockOrderUpdateMany = vi.fn()
const mockOrderFindMany = vi.fn()
const mockPlatformPolicyFindUnique = vi.fn()
const mockUserFindMany = vi.fn()
const mockVendorSettingsFindMany = vi.fn()

const mockPrisma = {
  platformPolicy: { findUnique: mockPlatformPolicyFindUnique },
  order: { findMany: mockOrderFindMany, updateMany: mockOrderUpdateMany },
  user: { findMany: mockUserFindMany },
  vendorSettings: { findMany: mockVendorSettingsFindMany },
  notification: { create: mockNotificationCreate },
  $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
}

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => mockPrisma) }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ success: true })) }))

const mockSendEmail = vi.mocked(sendEmail)

function anOrder(overrides: {
  id?: string
  status?: string
  createdAt?: Date
  completionReminder1At?: Date | null
  completionReminder2At?: Date | null
  deliveredAt?: Date | null
  vendorId?: string
  source?: string
} = {}) {
  const deliveredAt = overrides.deliveredAt ?? DELIVERED_24H_AGO
  return {
    id: overrides.id ?? 'order-1',
    status: overrides.status ?? 'DELIVERED',
    completedAt: null,
    createdAt: overrides.createdAt ?? new Date('2026-10-10T00:00:00.000Z'),
    completionReminder1At: overrides.completionReminder1At ?? null,
    completionReminder2At: overrides.completionReminder2At ?? null,
    deletedAt: null,
    source: overrides.source ?? 'ONLINE',
    items: [
      {
        deliveredAt,
        product: { store: { userId: overrides.vendorId ?? 'vendor-1' } },
      },
    ],
  } as any
}

describe('runVendorCompletionReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VENDOR_COMPLETION_REMINDER_ENABLED = 'true'
    mockPlatformPolicyFindUnique.mockResolvedValue({ systemCutoverTimestamp: CUTOVER } as any)
    mockUserFindMany.mockResolvedValue([
      { id: 'vendor-1', email: 'vendor@example.com', profile: { emailNotifications: true } },
    ])
    mockVendorSettingsFindMany.mockResolvedValue([
      { userId: 'vendor-1', notifyNewOrders: true },
    ])
  })

  afterEach(() => {
    delete process.env.VENDOR_COMPLETION_REMINDER_ENABLED
  })

  it('sends nothing when the feature flag is off', async () => {
    delete process.env.VENDOR_COMPLETION_REMINDER_ENABLED
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(0)
    expect(result.skipped).toBe('flag_off')
    expect(mockNotificationCreate).not.toHaveBeenCalled()
    expect(mockOrderUpdateMany).not.toHaveBeenCalled()
  })

  it('sends nothing when cutover is unset', async () => {
    mockPlatformPolicyFindUnique.mockResolvedValue({ systemCutoverTimestamp: null } as any)
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(0)
    expect(result.skipped).toBe('cutover_unset')
    expect(mockNotificationCreate).not.toHaveBeenCalled()
  })

  it('sends nothing for pre-cutover orders', async () => {
    // The real where clause (createdAt >= cutover) excludes pre-cutover orders,
    // so the DB returns none of them.
    mockOrderFindMany.mockResolvedValue([])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(0)
    expect(mockNotificationCreate).not.toHaveBeenCalled()
  })

  it('sends nothing before 24 hours', async () => {
    mockOrderFindMany.mockResolvedValue([
      anOrder({ deliveredAt: new Date(NOW.getTime() - 23 * 60 * 60 * 1000) }),
    ])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(0)
    expect(mockNotificationCreate).not.toHaveBeenCalled()
    expect(mockOrderUpdateMany).not.toHaveBeenCalled()
  })

  it('sends reminder 1 at 24 hours and stamps in the same transaction', async () => {
    mockOrderFindMany.mockResolvedValue([anOrder({ id: 'order-a', deliveredAt: DELIVERED_24H_AGO })])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(1)
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1)
    const data = mockNotificationCreate.mock.calls[0][0].data
    expect(data.userId).toBe('vendor-1')
    expect(data.message).toContain('You have 1 order(s) marked delivered')
    expect(data.message).toContain('mark the order as completed so your payout can be processed')
    expect(data.message).toContain('#order-a')
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      { where: { id: { in: ['order-a'] }, completionReminder1At: null }, data: { completionReminder1At: NOW } },
    )
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
  })

  it('sends reminder 2 at 72 hours when reminder 1 was already sent', async () => {
    mockOrderFindMany.mockResolvedValue([
      anOrder({
        id: 'order-b',
        deliveredAt: DELIVERED_72H_AGO,
        completionReminder1At: new Date('2026-10-05T00:00:00.000Z'),
        completionReminder2At: null,
      }),
    ])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(1)
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1)
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      { where: { id: { in: ['order-b'] }, completionReminder2At: null }, data: { completionReminder2At: NOW } },
    )
  })

  it('never repeats reminder 1 once stamped', async () => {
    mockOrderFindMany.mockResolvedValue([
      anOrder({
        id: 'order-c',
        deliveredAt: DELIVERED_24H_AGO,
        completionReminder1At: new Date('2026-10-05T00:00:00.000Z'),
      }),
    ])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(0)
    expect(mockNotificationCreate).not.toHaveBeenCalled()
    expect(mockOrderUpdateMany).not.toHaveBeenCalled()
  })

  it('sends nothing for completed orders', async () => {
    mockOrderFindMany.mockResolvedValue([])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(0)
    expect(mockNotificationCreate).not.toHaveBeenCalled()
  })

  it('includes manual orders', async () => {
    mockOrderFindMany.mockResolvedValue([
      anOrder({ id: 'order-m', source: 'MANUAL', deliveredAt: DELIVERED_24H_AGO }),
    ])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(1)
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1)
  })

  it('sends one combined message per vendor per run', async () => {
    mockOrderFindMany.mockResolvedValue([
      anOrder({ id: 'order-1', deliveredAt: DELIVERED_24H_AGO }),
      anOrder({ id: 'order-2', deliveredAt: DELIVERED_24H_AGO }),
    ])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(1)
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1)
    const data = mockNotificationCreate.mock.calls[0][0].data
    expect(data.message).toContain('You have 2 order(s) marked delivered')
    expect(data.message).toContain('#order-1')
    expect(data.message).toContain('#order-2')
    expect(mockOrderUpdateMany).toHaveBeenCalledWith(
      { where: { id: { in: ['order-1', 'order-2'] }, completionReminder1At: null }, data: { completionReminder1At: NOW } },
    )
  })

  it('respects email opt-out and does not email', async () => {
    mockUserFindMany.mockResolvedValue([
      { id: 'vendor-1', email: 'vendor@example.com', profile: { emailNotifications: false } },
    ])
    mockOrderFindMany.mockResolvedValue([anOrder({ deliveredAt: DELIVERED_24H_AGO })])
    await runVendorCompletionReminders(NOW)
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('does not notify a vendor who opted out of new order notifications', async () => {
    mockVendorSettingsFindMany.mockResolvedValue([
      { userId: 'vendor-1', notifyNewOrders: false },
    ])
    mockOrderFindMany.mockResolvedValue([anOrder({ deliveredAt: DELIVERED_24H_AGO })])
    const result = await runVendorCompletionReminders(NOW)
    expect(result.sent).toBe(0)
    expect(mockNotificationCreate).not.toHaveBeenCalled()
    expect(mockOrderUpdateMany).not.toHaveBeenCalled()
  })
})
