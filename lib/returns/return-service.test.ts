import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

function buildClient({ item, existingRequests = [], txLockedStatus = null, seq } = {}) {
  const it = item ?? buildItem()
  const requests = existingRequests.map((r) => ({ ...r }))
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
        client.calls.push('orderItem.findUnique')
        if (args?.where?.id !== it.id) return null
        return { ...it, returnRequests: requests }
      }),
    },
    returnRequest: {
      findMany: vi.fn(async (args: any) => {
        client.calls.push('returnRequest.findMany')
        const where = args?.where ?? {}
        return requests.filter((r) => {
          if (where.orderItemId !== undefined && r.orderItemId !== where.orderItemId) return false
          return true
        })
      }),
      findUnique: vi.fn(async (args: any) => {
        client.calls.push('returnRequest.findUnique')
        const found = requests.find((r) => r.id === args?.where?.id)
        return found ? fullRequest(found) : null
      }),
      findFirst: vi.fn(async (args: any) => {
        client.calls.push('returnRequest.findFirst')
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
        client.calls.push('returnRequest.create')
        const id = 'rr_' + (requests.length + 1)
        const r = { id, ...args.data, status: args.data.status }
        requests.push(r)
        return r
      }),
      update: vi.fn(async (args: any) => {
        client.calls.push('returnRequest.update')
        const idx = requests.findIndex((r) => r.id === args.where.id)
        if (idx === -1) return null
        requests[idx] = { ...requests[idx], ...args.data }
        return requests[idx]
      }),
    },
    returnRequestEvent: {
      create: vi.fn(async (args: any) => {
        client.calls.push('returnRequestEvent.create')
        events.push(args.data)
        return args.data
      }),
    },
    returnRequestAttachment: {
      create: vi.fn(async (args: any) => {
        client.calls.push('returnRequestAttachment.create')
        return args.data
      }),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (callback: any) => {
      const tx: any = {
        returnRequest: {
          findFirst: vi.fn(async (args: any) => {
            const where = args?.where ?? {}
            const base = txLockedStatus ?? 'PENDING'
            const r = requests.find((rr) => rr.orderItemId === where.orderItemId && where.status?.in.includes(rr.status))
            if (!r) return null
            return { ...r, status: base }
          }),
          findUnique: vi.fn(async (args: any) => {
            const r = requests.find((rr) => rr.id === args?.where?.id)
            if (!r) return null
            return { ...fullRequest(r), status: txLockedStatus ?? r.status }
          }),
          create: vi.fn(async (args: any) => {
            const id = 'rr_' + (requests.length + 1)
            const r = { id, ...args.data }
            requests.push(r)
            return r
          }),
          update: vi.fn(async (args: any) => {
            if (seq) seq.push('tx-update')
            const idx = requests.findIndex((r) => r.id === args.where.id)
            requests[idx] = { ...requests[idx], ...args.data }
            return requests[idx]
          }),
        },
        returnRequestEvent: {
          create: vi.fn(async (args: any) => {
            events.push(args.data)
            return args.data
          }),
        },
        $queryRaw: vi.fn(async () => []),
      }
      return callback(tx)
    }),
  }
  return { client, events, requests }
}

function refundCalls() {
  return createRefundMock.mock.calls.map((args: any) => args[0])
}

describe('return-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createRefundMock.mockResolvedValue({ refunds: [{ alreadyExisted: false }] })
  })

  describe('openReturn', () => {
    it('customer opens a PENDING request and writes exactly one RETURN_OPENED event', async () => {
      const { client, events } = buildClient()
      const result = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        quantity: 1,
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      expect(result.status).toBe('PENDING')
      expect(result.customerId).toBe(CUSTOMER)
      expect(result.orderItemId).toBe(ORDER_ITEM)
      const opened = events.filter((e) => e.eventType === 'RETURN_OPENED')
      expect(opened.length).toBe(1)
      expect(opened[0].createdBy).toBe(CUSTOMER)
      expect(createRefundMock).not.toHaveBeenCalled()
    })

    it('rejects amounts above the cap, zero, negative and three-decimal', async () => {
      const { client } = buildClient()
      const base = {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      }
      for (const amount of [150, 0, -5, 10.123]) {
        await expect(openReturn(client, { ...base, requestedAmount: amount })).rejects.toMatchObject({
          status: 400,
        })
      }
      expect(createRefundMock).not.toHaveBeenCalled()
    })

    it('rejects a duplicate open request with OPEN_REQUEST_EXISTS', async () => {
      const existing = [{ id: 'rr_existing', status: 'PENDING', orderItemId: ORDER_ITEM }]
      const { client } = buildClient({ existingRequests: existing })
      await expect(
        openReturn(client, {
          customerId: CUSTOMER,
          orderItemId: ORDER_ITEM,
          reason: 'DAMAGED',
          windowDays: 7,
          vendorResponseHours: 72,
          now: NOW,
        })
      ).rejects.toMatchObject({ code: 'OPEN_REQUEST_EXISTS', status: 409 })
      expect(createRefundMock).not.toHaveBeenCalled()
    })
  })

  describe('vendorRespond', () => {
    it('vendor accepts: transitions to AWAITING_REFUND, one VENDOR_ACCEPTED event, refund requested once', async () => {
      const { client, events, requests } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      const updated = await vendorRespond(client, {
        returnRequestId: rr.id,
        decision: 'ACCEPT',
        vendorId: VENDOR,
        now: NOW,
      })
      expect(updated.status).toBe('AWAITING_REFUND')
      const accepted = events.filter((e) => e.eventType === 'VENDOR_ACCEPTED')
      expect(accepted.length).toBe(1)
      expect(accepted[0].createdBy).toBe(VENDOR)
      const calls = refundCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].source).toBe('RETURN')
      expect(calls[0].reference).toBe(rr.id)
      expect(calls[0].returnRequestId).toBe(rr.id)
      expect(calls[0].items[0].orderItemId).toBe(ORDER_ITEM)
      expect(calls[0].items[0].amount).toBe(100)
    })

    it('vendor rejects: transitions to ESCALATED, one VENDOR_REJECTED event, no refund', async () => {
      const { client, events } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'DAMAGED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      const updated = await vendorRespond(client, {
        returnRequestId: rr.id,
        decision: 'REJECT',
        rejectionReason: 'not valid',
        vendorId: VENDOR,
        now: NOW,
      })
      expect(updated.status).toBe('ESCALATED')
      const rejected = events.filter((e) => e.eventType === 'VENDOR_REJECTED')
      expect(rejected.length).toBe(1)
      expect(rejected[0].createdBy).toBe(VENDOR)
      expect(createRefundMock).not.toHaveBeenCalled()
    })

    it('a second state change on an already-moved request is rejected', async () => {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'ACCEPT', vendorId: VENDOR, now: NOW })
      // status is now AWAITING_REFUND; another vendor response is rejected
      await expect(
        vendorRespond(client, { returnRequestId: rr.id, decision: 'ACCEPT', vendorId: VENDOR, now: NOW })
      ).rejects.toMatchObject({ status: 409 })
    })

    it('in-lock re-check rejects when the status changed inside the transaction', async () => {
      const { client } = buildClient({ txLockedStatus: 'AWAITING_REFUND' })
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await expect(
        vendorRespond(client, { returnRequestId: rr.id, decision: 'ACCEPT', vendorId: VENDOR, now: NOW })
      ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
    })

    it('rejects unknown body fields via caller-side validation is a route concern; service accepts known fields', async () => {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, {
        returnRequestId: rr.id,
        decision: 'ACCEPT',
        vendorId: VENDOR,
        acceptedAmount: 50,
        now: NOW,
      })
      const calls = refundCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].items[0].amount).toBe(50)
    })
  })

  describe('adminDecide', () => {
    it('vendor rejects, admin approves a partial amount: refund requested once with that amount', async () => {
      const { client, events } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'WRONG_ITEM',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'REJECT', rejectionReason: 'no', vendorId: VENDOR, now: NOW })
      const updated = await adminDecide(client, {
        returnRequestId: rr.id,
        decision: 'APPROVE',
        approvedAmount: 30,
        actorId: ADMIN,
        now: NOW,
      })
      expect(updated.status).toBe('AWAITING_REFUND')
      const approved = events.filter((e) => e.eventType === 'ADMIN_APPROVED')
      expect(approved.length).toBe(1)
      expect(approved[0].createdBy).toBe(ADMIN)
      const calls = refundCalls()
      expect(calls.length).toBe(1)
      expect(calls[0].source).toBe('RETURN')
      expect(calls[0].reference).toBe(rr.id)
      expect(calls[0].items[0].amount).toBe(30)
    })

    it('admin denies: transitions to REJECTED, one ADMIN_DENIED event, no refund requested', async () => {
      const { client, events } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_RECEIVED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'REJECT', rejectionReason: 'no', vendorId: VENDOR, now: NOW })
      const updated = await adminDecide(client, {
        returnRequestId: rr.id,
        decision: 'DENY',
        reason: 'ineligible',
        actorId: ADMIN,
        now: NOW,
      })
      expect(updated.status).toBe('REJECTED')
      const denied = events.filter((e) => e.eventType === 'ADMIN_DENIED')
      expect(denied.length).toBe(1)
      expect(denied[0].createdBy).toBe(ADMIN)
      expect(createRefundMock).not.toHaveBeenCalled()
    })

    it('admin approve above the cap is rejected', async () => {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'DAMAGED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'REJECT', rejectionReason: 'no', vendorId: VENDOR, now: NOW })
      await expect(
        adminDecide(client, { returnRequestId: rr.id, decision: 'APPROVE', approvedAmount: 999, actorId: ADMIN, now: NOW })
      ).rejects.toMatchObject({ status: 400 })
      expect(createRefundMock).not.toHaveBeenCalled()
    })

    it('zero, negative and three-decimal approved amounts are rejected', async () => {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'DAMAGED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'REJECT', rejectionReason: 'no', vendorId: VENDOR, now: NOW })
      for (const amount of [0, -5, 10.123]) {
        await expect(
          adminDecide(client, { returnRequestId: rr.id, decision: 'APPROVE', approvedAmount: amount, actorId: ADMIN, now: NOW })
        ).rejects.toMatchObject({ status: 400 })
      }
      expect(createRefundMock).not.toHaveBeenCalled()
    })
  })

  describe('escalate', () => {
    it('SYSTEM can only escalate overdue PENDING requests', async () => {
      const past = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000)
      const { client, events } = buildClient({
        item: { ...buildItem(), escalationDeadline: past },
      })
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 1,
        now: NOW,
      })
      // force escalation deadline into the past
      await client.returnRequest.update({ where: { id: rr.id }, data: { escalationDeadline: past } })
      const updated = await escalate(client, { returnRequestId: rr.id, actor: 'SYSTEM', now: NOW })
      expect(updated.status).toBe('ESCALATED')
      const esc = events.filter((e: any) => e.eventType === 'ESCALATED')
      expect(esc.length).toBe(1)
      expect(esc[0].createdBy).toBeNull()
    })

    it('SYSTEM cannot escalate before the deadline', async () => {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await expect(
        escalate(client, { returnRequestId: rr.id, actor: 'SYSTEM', now: NOW })
      ).rejects.toMatchObject({ code: 'NOT_OVERDUE', status: 409 })
    })

    it('a customer cannot escalate', async () => {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await expect(
        escalate(client, { returnRequestId: rr.id, actor: 'CUSTOMER', now: NOW })
      ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
    })
  })

  describe('retry after a failed refund', () => {
    it('retries with the identical idempotency input (carried by `reference`) and results in at most one refund', async () => {
      const { client } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      // first attempt fails (Paystack down) - triggered by vendor accept
      createRefundMock.mockRejectedValueOnce(new Error('paystack timeout'))
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'ACCEPT', vendorId: VENDOR, now: NOW })
      // retry is idempotent: alreadyExisted (at most one refund)
      createRefundMock.mockResolvedValueOnce({ refunds: [{ alreadyExisted: true }] })
      await requestRefundForReturn(client, { returnRequestId: rr.id, actorRole: 'VENDOR', actorId: VENDOR, now: NOW })
      const calls = refundCalls()
      expect(calls.length).toBe(2)
      // identical idempotency input across attempts, carried by `reference` (= returnRequestId)
      for (const c of calls) {
        expect(c.source).toBe('RETURN')
        expect(c.reference).toBe(rr.id)
        expect(c.returnRequestId).toBe(rr.id)
      }
    })
  })

  describe('call ordering and delegate isolation', () => {
    it('createRefund is invoked after the transaction callback has returned', async () => {
      const order: string[] = []
      const { client } = buildClient({ seq: order })
      createRefundMock.mockImplementation(async () => {
        order.push('create-refund')
        return { refunds: [{ alreadyExisted: false }] }
      })
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'ACCEPT', vendorId: VENDOR, now: NOW })
      const txUpdateIdx = order.indexOf('tx-update')
      const createRefundIdx = order.indexOf('create-refund')
      expect(txUpdateIdx).toBeGreaterThanOrEqual(0)
      expect(createRefundIdx).toBeGreaterThan(txUpdateIdx)
    })

    it('the service never touches refund/payment/wallet/vendorBalanceAdjustment/vendorPayout except through createRefund', async () => {
      const { client, calls } = buildClient()
      const rr = await openReturn(client, {
        customerId: CUSTOMER,
        orderItemId: ORDER_ITEM,
        reason: 'NOT_AS_DESCRIBED',
        windowDays: 7,
        vendorResponseHours: 72,
        now: NOW,
      })
      await vendorRespond(client, { returnRequestId: rr.id, decision: 'ACCEPT', vendorId: VENDOR, now: NOW })
      const forbidden = /(refund|payment|wallet|vendorBalanceAdjustment|vendorPayout)/i
      for (const c of client.calls) {
        expect(forbidden.test(c)).toBe(false)
      }
      // the only refund delegate invoked is createRefund (mocked)
      expect(createRefundMock).toHaveBeenCalled()
    })
  })
})
