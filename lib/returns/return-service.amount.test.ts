import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  openReturn,
  vendorRespond,
  adminDecide,
  escalate,
  requestRefundForReturn,
} from '@/lib/returns/return-service'

const createRefundMock = vi.hoisted(() => vi.fn().mockResolvedValue({ refunds: [{ alreadyExisted: false }] }))
vi.mock('@/lib/refunds', () => ({ createRefund: createRefundMock }))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: createAuditLogMock }))

const createNotificationMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/notifications', () => ({ createNotification: createNotificationMock }))

const NOW = new Date('2026-10-25T12:00:00.000Z')
const CUSTOMER = 'cust_1'
const VENDOR = 'vend_1'
const ADMIN = 'admin_1'
const ORDER_ITEM = 'oi_1'
const ORDER = 'order_1'

function buildItem(overrides: any = {}) {
  return {
    id: ORDER_ITEM,
    price: 100,
    quantity: 1,
    deliveredAt: new Date('2026-10-20T10:00:00.000Z'),
    productId: 'p_1',
    orderId: ORDER,
    product: { id: 'p_1', isReturnable: true },
    returnRequests: [],
    order: {
      id: ORDER,
      userId: CUSTOMER,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      total: 100,
      payment: { id: 'pay_1', amount: 100 },
      items: [{ id: ORDER_ITEM, price: 100, quantity: 1 }],
      refunds: [],
    },
    ...overrides,
  }
}

function buildClient({ item, existingRequests = [], txLockedStatus = null }: any = {}) {
  const it = item ?? buildItem()
  const requests: any[] = existingRequests.map((r: any) => ({ ...r }))
  const events: any[] = []
  const fullRequest = (r: any) => ({
    ...r,
    orderItem: {
      id: it.id,
      orderId: it.orderId,
      price: it.price,
      quantity: it.quantity,
      deliveredAt: it.deliveredAt,
      order: it.order,
      product: it.product,
    },
  })
  const client: any = {
    calls: [] as string[],
    orderItem: {
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.id !== it.id) return null
        return { ...it, returnRequests: requests }
      }),
    },
    returnRequest: {
      findMany: vi.fn(async () => requests),
      findUnique: vi.fn(async (args: any) => {
        const found = requests.find((r) => r.id === args?.where?.id)
        return found ? fullRequest(found) : null
      }),
      findFirst: vi.fn(async (args: any) => {
        const where = args?.where ?? {}
        return (
          requests.find((r) => {
            if (where.orderItemId !== undefined && r.orderItemId !== where.orderItemId) return false
            if (where.status?.in !== undefined && !where.status.in.includes(r.status)) return false
            return true
          }) ?? null
        )
      }),
      create: vi.fn(async (args: any) => {
        const id = 'rr_' + (requests.length + 1)
        const r = { id, ...args.data }
        requests.push(r)
        return r
      }),
      update: vi.fn(async (args: any) => {
        const idx = requests.findIndex((r) => r.id === args.where.id)
        if (idx === -1) return null
        requests[idx] = { ...requests[idx], ...args.data }
        return requests[idx]
      }),
    },
    returnRequestEvent: { create: vi.fn(async (args: any) => { events.push(args.data); return args.data }) },
    returnRequestAttachment: { create: vi.fn(async (args: any) => args.data) },
    refund: { findFirst: vi.fn(async () => null) },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (callback: any) => {
      const tx: any = {
        returnRequest: {
          findFirst: vi.fn(async (args: any) => {
            const where = args?.where ?? {}
            const r = requests.find((rr) => rr.orderItemId === where.orderItemId && where.status?.in?.includes(rr.status))
            return r ? { ...r, status: txLockedStatus ?? r.status } : null
          }),
          findUnique: vi.fn(async (args: any) => {
            const r = requests.find((rr) => rr.id === args?.where?.id)
            return r ? { ...fullRequest(r), status: txLockedStatus ?? r.status } : null
          }),
          create: vi.fn(async (args: any) => {
            const id = 'rr_' + (requests.length + 1)
            const r = { id, ...args.data }
            requests.push(r)
            return r
          }),
          update: vi.fn(async (args: any) => {
            const idx = requests.findIndex((r) => r.id === args.where.id)
            requests[idx] = { ...requests[idx], ...args.data }
            return requests[idx]
          }),
        },
        returnRequestEvent: { create: vi.fn(async (args: any) => { events.push(args.data); return args.data }) },
        refund: { findFirst: vi.fn(async () => null) },
        $queryRaw: vi.fn(async () => []),
      }
      return callback(tx)
    }),
  }
  return { client, events, requests }
}

beforeEach(() => {
  vi.clearAllMocks()
  createRefundMock.mockResolvedValue({ refunds: [{ alreadyExisted: false }] })
})

describe('requested amount cap (vendor)', () => {
  it('accepts exactly the requested amount and refunds it', async () => {
    const { client, requests } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    const before = createRefundMock.mock.calls.length
    const updated = await vendorRespond(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      amount: '20.00',
      vendorId: VENDOR,
      now: NOW,
    })
    expect(updated.status).toBe('AWAITING_REFUND')
    expect(createRefundMock.mock.calls.length).toBe(before + 1)
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(20)
    expect(requests[0].policySnapshot.requestedAmount).toBe('20.00')
  })

  it('rejects 20.01 and 100.00 with ITEM_CAP_EXCEEDED', async () => {
    for (const amt of ['20.01', '100.00']) {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        quantity: 1,
        requestedAmount: 20,
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      const callsBefore = createRefundMock.mock.calls.length
      await expect(
        vendorRespond(client, {
          returnRequestId: rr.id,
          decision: 'APPROVE',
          amount: amt,
          vendorId: VENDOR,
          now: NOW,
        })
      ).rejects.toMatchObject({ code: 'ITEM_CAP_EXCEEDED', status: 400 })
      expect(createRefundMock.mock.calls.length).toBe(callsBefore)
    }
  })

  it('defaults to the effective max when amount is empty', async () => {
    const { client } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await vendorRespond(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      vendorId: VENDOR,
      now: NOW,
    })
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(20)
  })

  it('fails closed when requestedAmount is missing or malformed', async () => {
    const malformed: any[] = [undefined, null, '', '0', '-5', '20.001', 20, 'abc']
    for (const val of malformed) {
      const { client, requests } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        quantity: 1,
        requestedAmount: 20,
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      if (val === undefined) {
        delete requests[0].policySnapshot.requestedAmount
      } else {
        requests[0].policySnapshot.requestedAmount = val
      }
      const callsBefore = createRefundMock.mock.calls.length
      await expect(
        vendorRespond(client, {
          returnRequestId: rr.id,
          decision: 'APPROVE',
          amount: '20.00',
          vendorId: VENDOR,
          now: NOW,
        })
      ).rejects.toMatchObject({ code: 'REQUESTED_AMOUNT_MISSING', status: 409 })
      expect(createRefundMock.mock.calls.length).toBe(callsBefore)
      // denial still works
      await vendorRespond(client, {
        returnRequestId: rr.id,
        decision: 'DENY',
        note: 'no',
        vendorId: VENDOR,
        now: NOW,
      })
      expect(createRefundMock.mock.calls.length).toBe(callsBefore)
    }
  })

  it('uses the item cap when it is smaller than the requested amount', async () => {
    const item = buildItem()
    const { client } = buildClient({ item })
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 10,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    // simulate item cap shrinking below the requested amount after open
    item.order.payment.amount = 5
    await vendorRespond(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      amount: '5.00',
      vendorId: VENDOR,
      now: NOW,
    })
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(5)
    const { client: c2 } = buildClient({ item })
    const rr2 = await openReturn(c2, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 5,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    item.order.payment.amount = 5
    await expect(
      vendorRespond(c2, {
        returnRequestId: rr2.id,
        decision: 'APPROVE',
        amount: '5.01',
        vendorId: VENDOR,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'ITEM_CAP_EXCEEDED', status: 400 })
  })

  it('handles pesewa edge cases', async () => {
    const { client } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 0.01,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await vendorRespond(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      amount: '0.01',
      vendorId: VENDOR,
      now: NOW,
    })
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(0.01)

    const { client: c2 } = buildClient()
    const rr2 = await openReturn(c2, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 0.3,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await vendorRespond(c2, {
      returnRequestId: rr2.id,
      decision: 'APPROVE',
      amount: '0.30',
      vendorId: VENDOR,
      now: NOW,
    })
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(0.3)

    const { client: c3 } = buildClient()
    const rr3 = await openReturn(c3, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await expect(
      vendorRespond(c3, {
        returnRequestId: rr3.id,
        decision: 'APPROVE',
        amount: '19.99',
        vendorId: VENDOR,
        now: NOW,
      })
    ).resolves.toBeDefined()
    // 20.00 boundary
    const { client: c4 } = buildClient()
    const rr4 = await openReturn(c4, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await vendorRespond(c4, {
      returnRequestId: rr4.id,
      decision: 'APPROVE',
      amount: '20.00',
      vendorId: VENDOR,
      now: NOW,
    })
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(20)
  })

  it('does not change the stored requested amount after transition', async () => {
    const { client, requests } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await vendorRespond(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      amount: '20.00',
      vendorId: VENDOR,
      now: NOW,
    })
    expect(requests[0].policySnapshot.requestedAmount).toBe('20.00')
  })
})

describe('requested amount cap (admin)', () => {
  it('approves the requested amount', async () => {
    const { client } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await escalate(client, { returnRequestId: rr.id, actor: 'ADMIN', actorId: ADMIN, now: NOW })
    await adminDecide(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      amount: '20.00',
      actorId: ADMIN,
      now: NOW,
    })
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(20)
  })

  it('fails closed on malformed requestedAmount', async () => {
    const { client, requests } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await escalate(client, { returnRequestId: rr.id, actor: 'ADMIN', actorId: ADMIN, now: NOW })
    delete requests[0].policySnapshot.requestedAmount
    const callsBefore = createRefundMock.mock.calls.length
    await expect(
      adminDecide(client, {
        returnRequestId: rr.id,
        decision: 'APPROVE',
        amount: '20.00',
        actorId: ADMIN,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'REQUESTED_AMOUNT_MISSING', status: 409 })
    expect(createRefundMock.mock.calls.length).toBe(callsBefore)
    // deny still works without amount
    const { client: c2, requests: r2 } = buildClient()
    const rr2 = await openReturn(c2, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await escalate(c2, { returnRequestId: rr2.id, actor: 'ADMIN', actorId: ADMIN, now: NOW })
    delete r2[0].policySnapshot.requestedAmount
    // deny should succeed even with missing amount
    await expect(
      adminDecide(c2, {
        returnRequestId: rr2.id,
        decision: 'DENY',
        note: 'no',
        actorId: ADMIN,
        now: NOW,
      })
    ).resolves.toBeDefined()
  })
})

describe('requestRefundForReturn cap', () => {
  it('never exceeds min(item cap, requested)', async () => {
    const { client } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await vendorRespond(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      amount: '20.00',
      vendorId: VENDOR,
      now: NOW,
    })
    await requestRefundForReturn(client, {
      returnRequestId: rr.id,
      actorRole: 'VENDOR',
      actorId: VENDOR,
      now: NOW,
    })
    // amount should be capped at 20
    expect(createRefundMock.mock.calls[createRefundMock.mock.calls.length - 1][0].items[0].amount).toBe(20)
  })

  it('fails closed when requested amount missing', async () => {
    const { client, requests } = buildClient()
    const rr = await openReturn(client, {
      customerId: CUSTOMER,
      orderItemId: ORDER_ITEM,
      reason: 'NOT_AS_DESCRIBED',
      quantity: 1,
      requestedAmount: 20,
      windowDays: 7,
      vendorResponseHours: 72,
      now: NOW,
    })
    await vendorRespond(client, {
      returnRequestId: rr.id,
      decision: 'APPROVE',
      amount: '20.00',
      vendorId: VENDOR,
      now: NOW,
    })
    delete requests[0].policySnapshot.requestedAmount
    const callsBefore = createRefundMock.mock.calls.length
    await expect(
      requestRefundForReturn(client, {
        returnRequestId: rr.id,
        amount: '20.00',
        actorRole: 'VENDOR',
        actorId: VENDOR,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'REQUESTED_AMOUNT_MISSING', status: 409 })
    expect(createRefundMock.mock.calls.length).toBe(callsBefore)
  })
})