import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
  },
  fulfillmentEvent: {
    create: vi.fn().mockResolvedValue({ id: 'event_1' }),
  },
  user: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

const createNotificationMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const formatNotificationMessageMock = vi.hoisted(() => vi.fn((msg: string) => msg))
vi.mock('@/lib/notifications', () => ({
  createNotification: createNotificationMock,
  formatNotificationMessage: formatNotificationMessageMock,
}))

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/email', () => ({
  sendEmail: sendEmailMock,
}))

const canSendCustomerEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))
vi.mock('./notification-preferences', () => ({
  canSendCustomerEmail: canSendCustomerEmailMock,
}))

describe('fulfillment-events null-userId guards', () => {
  let mockPrisma: typeof prismaMock

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = prismaMock
    ;(createNotificationMock as any).mockResolvedValue(undefined)
    ;(sendEmailMock as any).mockResolvedValue(undefined)
    ;(canSendCustomerEmailMock as any).mockResolvedValue(true)
  })

  it('skips notification when userId is null', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: null,
      customerEmail: null,
      items: [{ product: { name: 'Widget' } }],
    })

    const { recordFulfillmentEvent } = await import('@/lib/fulfillment-events')
    await recordFulfillmentEvent(
      'order_1',
      'DELIVERED',
      'user_1',
      { productName: 'Widget' }
    )

    // No notification created because userId is null
    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it('sends notification when userId exists', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: 'user_1',
      customerEmail: 'customer@test.com',
      items: [{ product: { name: 'Widget' } }],
    })

    const { recordFulfillmentEvent } = await import('@/lib/fulfillment-events')
    await recordFulfillmentEvent('order_1', 'DELIVERED', 'user_1', {
      productName: 'Widget',
    })

    expect(createNotificationMock).toHaveBeenCalled()
  })

  it('skips email when userId is null even with customerEmail', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order_1',
      userId: null,
      customerEmail: 'customer@test.com',
      items: [{ product: { name: 'Widget' } }],
    })

    const { recordFulfillmentEvent } = await import('@/lib/fulfillment-events')
    await recordFulfillmentEvent('order_1', 'DELIVERED', 'user_1', {
      productName: 'Widget',
    })

    // Email skipped because userId is null
    expect(canSendCustomerEmailMock).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
