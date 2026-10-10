import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import crypto from 'crypto'

const mocks = vi.hoisted(() => ({
  listPaystackRefunds: vi.fn(),
  paymentFindUnique: vi.fn(),
  refundFindMany: vi.fn(),
  refundFindUnique: vi.fn(),
  refundUpdate: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  userFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  createAuditLog: vi.fn(),
  createNotification: vi.fn(),
  notifyRefundProcessed: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: () => ({
    payment: { findUnique: mocks.paymentFindUnique },
    refund: {
      findMany: mocks.refundFindMany,
      findUnique: mocks.refundFindUnique,
      update: mocks.refundUpdate,
    },
    order: { findUnique: mocks.orderFindUnique, update: mocks.orderUpdate },
    user: { findMany: mocks.userFindMany },
    notification: { create: mocks.notificationCreate },
  }),
}))

vi.mock('@/lib/paystack', () => ({ listPaystackRefunds: mocks.listPaystackRefunds }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }))
vi.mock('@/lib/notifications', () => ({ createNotification: mocks.createNotification }))
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), logWarn: vi.fn(), logInfo: vi.fn() }))
vi.mock('@/lib/refunds/refund-email', () => ({ notifyRefundProcessed: mocks.notifyRefundProcessed }))

const SECRET = 'sk_test_refund_webhook_key_0001'

let handleRefundWebhook: typeof import('@/lib/webhooks/refund-webhook-handler').handleRefundWebhook
let isRefundEvent: typeof import('@/lib/webhooks/refund-webhook-handler').isRefundEvent
let mapPaystackRefundStatus: typeof import('@/lib/webhooks/refund-webhook-handler').mapPaystackRefundStatus

beforeAll(async () => {
  // The handler captures the secret key as a module-scope const.
  process.env.PAYSTACK_SECRET_KEY = SECRET
  const mod = await import('@/lib/webhooks/refund-webhook-handler')
  handleRefundWebhook = mod.handleRefundWebhook
  isRefundEvent = mod.isRefundEvent
  mapPaystackRefundStatus = mod.mapPaystackRefundStatus
})

function sign(body: string): string {
  return crypto.createHmac('sha512', SECRET).update(body).digest('hex')
}

function payload(event: string, data: Record<string, unknown>): string {
  return JSON.stringify({ event, data })
}

function paystackRefund(overrides: Record<string, unknown> = {}) {
  return {
    id: 9001,
    reference: null,
    amount: 3000,
    currency: 'GHS',
    // A real Paystack refund status. 'success' is a TRANSACTION status.
    status: 'processed',
    transactionReference: 'DHV-ABC123',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  }
}

function refundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'refund_1',
    paymentId: 'pay_1',
    orderItemId: 'item_a',
    amount: 30,
    status: 'PENDING',
    idempotencyKey: 'CUSTOMER_CANCEL:item_a',
    paystackRefundId: null,
    paystackStatus: null,
    processedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function setRows(rows: unknown[]) {
  mocks.refundFindMany.mockImplementation(async (arg: any = {}) => {
    const allowed: string[] | undefined = arg?.where?.status?.in
    return rows.filter((row: any) => !allowed || allowed.includes(row.status))
  })
  mocks.refundFindUnique.mockImplementation(async ({ where }: any = {}) => {
    if (where?.id) {
      const row = rows.find((candidate: any) => candidate.id === where.id)
      if (!row) return null
      return {
        ...row,
        currency: 'GHS',
        order: { user: { email: 'customer@example.test', profile: { firstName: 'Ada' } } },
      }
    }
    return null
  })
  mocks.refundUpdate.mockImplementation(async ({ where, data }: any) => {
    // Apply the change so subsequent reads reflect it, like the real DB.
    const row = rows.find((candidate: any) => candidate.id === where.id)
    if (row) Object.assign(row, data)
    return row
  })
}

describe('isRefundEvent', () => {
  it('matches only refund.* lifecycle events, so they route ahead of DHV-/VER-/SUB-/ADV-', () => {
    expect(isRefundEvent('refund.pending')).toBe(true)
    expect(isRefundEvent('refund.processing')).toBe(true)
    expect(isRefundEvent('refund.needs-attention')).toBe(true)
    expect(isRefundEvent('refund.failed')).toBe(true)
    expect(isRefundEvent('refund.processed')).toBe(true)
    expect(isRefundEvent('charge.success')).toBe(false)
    expect(isRefundEvent('refunds.success')).toBe(false)
    expect(isRefundEvent(undefined)).toBe(false)
  })
})

describe('mapPaystackRefundStatus', () => {
  it("maps 'pending' and 'processing' to PROCESSING", () => {
    expect(mapPaystackRefundStatus('pending')).toBe('PROCESSING')
    expect(mapPaystackRefundStatus('processing')).toBe('PROCESSING')
    expect(mapPaystackRefundStatus('PENDING')).toBe('PROCESSING')
    expect(mapPaystackRefundStatus('Processing')).toBe('PROCESSING')
  })

  it("maps 'processed' to PROCESSED", () => {
    expect(mapPaystackRefundStatus('processed')).toBe('PROCESSED')
    expect(mapPaystackRefundStatus('PROCESSED')).toBe('PROCESSED')
  })

  it("maps 'failed' to FAILED", () => {
    expect(mapPaystackRefundStatus('failed')).toBe('FAILED')
    expect(mapPaystackRefundStatus('FAILED')).toBe('FAILED')
  })

  it("maps both 'needs-attention' and 'needs_attention' to NEEDS_ATTENTION", () => {
    expect(mapPaystackRefundStatus('needs-attention')).toBe('NEEDS_ATTENTION')
    expect(mapPaystackRefundStatus('needs_attention')).toBe('NEEDS_ATTENTION')
    expect(mapPaystackRefundStatus('NEEDS_ATTENTION')).toBe('NEEDS_ATTENTION')
  })

  it("does NOT accept 'success' as PROCESSED - it is a Paystack TRANSACTION status", () => {
    // In Paystack's own refund table the transaction status of a FAILED refund
    // is "Success", so accepting it here would mark money as returned when it
    // was not.
    expect(mapPaystackRefundStatus('success')).toBeNull()
    expect(mapPaystackRefundStatus('resolved')).toBeNull()
    expect(mapPaystackRefundStatus('cancelled')).toBeNull()
    expect(mapPaystackRefundStatus('canceled')).toBeNull()
    expect(mapPaystackRefundStatus('attention')).toBeNull()
    expect(mapPaystackRefundStatus('reversed')).toBeNull()
    expect(mapPaystackRefundStatus('')).toBeNull()
    expect(mapPaystackRefundStatus(undefined)).toBeNull()
  })

  it('returns null for any unrecognised status so the caller never guesses', () => {
    expect(mapPaystackRefundStatus('weird-new-status')).toBeNull()
    expect(mapPaystackRefundStatus('queued')).toBeNull()
  })

  it('covers every documented Paystack refund status', () => {
    for (const status of ['pending', 'processing', 'processed', 'failed', 'needs-attention']) {
      expect(mapPaystackRefundStatus(status)).not.toBeNull()
    }
  })
})

describe('handleRefundWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.paymentFindUnique.mockResolvedValue({ id: 'pay_1', orderId: 'order_1', amount: 100 })
    mocks.orderFindUnique.mockResolvedValue({
      id: 'order_1',
      payment: { id: 'pay_1', amount: 100 },
      refunds: [],
    })
    mocks.orderUpdate.mockResolvedValue({})
    mocks.refundUpdate.mockResolvedValue({})
    mocks.refundFindUnique.mockResolvedValue(null)
    mocks.userFindMany.mockResolvedValue([{ id: 'admin_1' }])
    mocks.notificationCreate.mockResolvedValue({})
    mocks.createAuditLog.mockResolvedValue(undefined)
    mocks.createNotification.mockResolvedValue(undefined)
    mocks.notifyRefundProcessed.mockResolvedValue(undefined)
    mocks.listPaystackRefunds.mockResolvedValue({ success: true, refunds: [paystackRefund()] })
    setRows([])
  })

  it('verifies the signature on the RAW body before anything else', async () => {
    const body = payload('refund.processed', { id: 9001, transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body) + '00')
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('Invalid signature')
    expect(mocks.listPaystackRefunds).not.toHaveBeenCalled()
    expect(mocks.paymentFindUnique).not.toHaveBeenCalled()
  })

  it('rejects a missing signature', async () => {
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, undefined)

    expect(response.status).toBe(401)
    expect(mocks.listPaystackRefunds).not.toHaveBeenCalled()
  })

  it('rejects a signature computed over anything but the exact raw body', async () => {
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })
    // A different payload must not validate against the bytes we were given.
    const other = payload('refund.processed', { transaction_reference: 'DHV-ABC123', status: 'processed' })

    const response = await handleRefundWebhook(body, sign(other))

    expect(response.status).toBe(401)
  })

  it('rejects malformed JSON with 400', async () => {
    const body = '{not json'

    const response = await handleRefundWebhook(body, sign(body))

    expect(response.status).toBe(400)
  })

  it('reads the transaction reference from data.transaction_reference', async () => {
    const body = payload('refund.processed', {
      id: 9001,
      transaction_reference: 'DHV-FLAT',
      status: 'processed',
    })

    await handleRefundWebhook(body, sign(body))

    expect(mocks.paymentFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { reference: 'DHV-FLAT' } }))
    expect(mocks.listPaystackRefunds).toHaveBeenCalledWith('DHV-FLAT')
  })

  it('reads the transaction reference from data.transaction.reference', async () => {
    const body = payload('refund.processed', {
      id: 9001,
      transaction: { reference: 'DHV-NESTED' },
      status: 'processed',
    })

    await handleRefundWebhook(body, sign(body))

    expect(mocks.paymentFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { reference: 'DHV-NESTED' } }))
    expect(mocks.listPaystackRefunds).toHaveBeenCalledWith('DHV-NESTED')
  })

  it('returns 400 when no transaction reference can be read', async () => {
    const body = payload('refund.processed', { id: 9001, status: 'processed' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('reference')
  })

  it('returns 404 for an unknown transaction', async () => {
    mocks.paymentFindUnique.mockResolvedValue(null)
    const body = payload('refund.processed', { transaction_reference: 'DHV-UNKNOWN' })

    const response = await handleRefundWebhook(body, sign(body))

    expect(response.status).toBe(404)
    expect(mocks.listPaystackRefunds).not.toHaveBeenCalled()
  })

  it('returns 502 so Paystack retries when the refund list cannot be read', async () => {
    mocks.listPaystackRefunds.mockResolvedValue({
      success: false,
      refunds: [],
      error: { code: 'API_ERROR', message: 'boom' },
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))

    expect(response.status).toBe(502)
    expect(mocks.refundUpdate).not.toHaveBeenCalled()
  })

  it('reconciles ALL matching rows from the authoritative list', async () => {
    setRows([
      refundRow({ id: 'refund_1', orderItemId: 'item_a', amount: 30 }),
      refundRow({ id: 'refund_2', orderItemId: 'item_b', amount: 70, idempotencyKey: 'CUSTOMER_CANCEL:item_b' }),
    ])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000 }), paystackRefund({ id: 9002, amount: 7000 })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.reconciled).toBe(2)
    expect(json.received).toBe(true)
    expect(mocks.refundUpdate).toHaveBeenCalledTimes(2)

    const updatedIds = mocks.refundUpdate.mock.calls.map((call: any[]) => call[0].where.id)
    expect(updatedIds).toEqual(['refund_1', 'refund_2'])
  })

  it("moves a PROCESSING row to PROCESSED on 'processed' and announces each refund", async () => {
    setRows([
      refundRow({ id: 'refund_1', status: 'PROCESSING', paystackRefundId: '9001' }),
      refundRow({ id: 'refund_2', status: 'PROCESSING', amount: 70, paystackRefundId: '9002', idempotencyKey: 'CUSTOMER_CANCEL:item_b' }),
    ])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000 }), paystackRefund({ id: 9002, amount: 7000 })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(json.reconciled).toBe(2)
    for (const id of ['refund_1', 'refund_2']) {
      expect(mocks.refundUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
          data: expect.objectContaining({ status: 'PROCESSED', paystackStatus: 'processed' }),
        })
      )
      expect(mocks.notifyRefundProcessed).toHaveBeenCalledWith(id)
    }
    // One announcement per refund row, never per webhook.
    expect(mocks.notifyRefundProcessed).toHaveBeenCalledTimes(2)
  })

  it('matches a row by its stored Paystack refund id', async () => {
    setRows([
      refundRow({
        id: 'refund_1',
        paystackRefundId: '9001',
        // Deliberately far in the past so only the id match can apply.
        createdAt: new Date(Date.now() - 90 * 60 * 1000),
      }),
    ])
    mocks.listPaystackRefunds.mockResolvedValue({ success: true, refunds: [paystackRefund({ id: 9001 })] })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(json.reconciled).toBe(1)
    // The id was already stored, so only the status is refreshed.
    expect(mocks.refundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'refund_1' },
        data: expect.objectContaining({ paystackStatus: 'processed', status: 'PROCESSED' }),
      })
    )
  })

  it('attaches a row by amount and creation time when exactly one candidate matches', async () => {
    const createdAt = new Date()
    setRows([refundRow({ id: 'refund_1', amount: 30, createdAt })])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000, createdAt: createdAt.toISOString() })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(json.attached).toBe(1)
    expect(mocks.refundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paystackRefundId: '9001', status: 'PROCESSED' }),
      })
    )
  })

  describe('creation-time fallback window', () => {
    it('matches when the Paystack timestamp is within 60 seconds', async () => {
      const createdAt = new Date()
      setRows([refundRow({ id: 'refund_1', amount: 30, createdAt })])
      mocks.listPaystackRefunds.mockResolvedValue({
        success: true,
        refunds: [
          paystackRefund({
            id: 9001,
            amount: 3000,
            // 45s of clock skew: outside the old 10s window, inside 60s.
            createdAt: new Date(createdAt.getTime() + 45_000).toISOString(),
          }),
        ],
      })
      const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

      const json = await (await handleRefundWebhook(body, sign(body))).json()

      expect(json.attached).toBe(1)
      expect(json.reconciled).toBe(1)
    })

    it('does not match beyond 60 seconds', async () => {
      const createdAt = new Date()
      setRows([refundRow({ id: 'refund_1', amount: 30, createdAt })])
      mocks.listPaystackRefunds.mockResolvedValue({
        success: true,
        refunds: [
          paystackRefund({
            id: 9001,
            amount: 3000,
            createdAt: new Date(createdAt.getTime() + 61_000).toISOString(),
          }),
        ],
      })
      const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

      const json = await (await handleRefundWebhook(body, sign(body))).json()

      expect(json.unmatched).toEqual(['refund_1'])
      expect(json.reconciled).toBe(0)
      expect(mocks.refundUpdate).not.toHaveBeenCalled()
    })

    it('does not match on amount alone (creation time must agree)', async () => {
      setRows([refundRow({ id: 'refund_1', amount: 30, createdAt: new Date(Date.now() - 30 * 60 * 1000) })])
      mocks.listPaystackRefunds.mockResolvedValue({
        success: true,
        refunds: [paystackRefund({ id: 9001, amount: 3000, createdAt: new Date().toISOString() })],
      })
      const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

      const json = await (await handleRefundWebhook(body, sign(body))).json()

      expect(json.reconciled).toBe(0)
      expect(mocks.refundUpdate).not.toHaveBeenCalled()
    })
  })

  it('changes nothing and notifies the admins when the match is ambiguous', async () => {
    const createdAt = new Date()
    setRows([refundRow({ id: 'refund_1', amount: 30, createdAt })])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [
        paystackRefund({ id: 9001, amount: 3000, createdAt: createdAt.toISOString() }),
        paystackRefund({ id: 9002, amount: 3000, createdAt: createdAt.toISOString() }),
      ],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(json.ambiguous).toEqual(['refund_1'])
    expect(json.reconciled).toBe(0)
    expect(mocks.refundUpdate).not.toHaveBeenCalled()
    // Super admins are notified so a human can resolve it.
    expect(mocks.userFindMany).toHaveBeenCalled()
    expect(mocks.createNotification).toHaveBeenCalled()
    expect(mocks.createNotification.mock.calls[0][3]).toContain('more than one matching Paystack refund')
  })

  it('changes nothing and notifies the admins when Paystack reports an unrecognised status', async () => {
    setRows([refundRow({ id: 'refund_1', amount: 30, status: 'PROCESSING' })])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000, status: 'brand-new-paystack-status' })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(response.status).toBe(200)
    // Nothing was changed and nothing was guessed.
    expect(json.reconciled).toBe(0)
    expect(mocks.refundUpdate).not.toHaveBeenCalled()
    // The raw status string reaches the admins verbatim.
    expect(json.unknown).toEqual([{ refundId: 'refund_1', paystackStatus: 'brand-new-paystack-status' }])
    expect(mocks.userFindMany).toHaveBeenCalled()
    const message = mocks.createNotification.mock.calls.map((call: any[]) => call[3]).join('\n')
    expect(message).toContain('brand-new-paystack-status')
  })

  it("treats 'success' as an unrecognised refund status and changes nothing", async () => {
    // 'success' is Paystack's TRANSACTION status for a FAILED refund, so it must
    // never move our row to PROCESSED.
    setRows([refundRow({ id: 'refund_1', amount: 30, status: 'PROCESSING' })])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000, status: 'success' })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const json = await (await handleRefundWebhook(body, sign(body))).json()

    expect(json.reconciled).toBe(0)
    expect(json.unknown).toEqual([{ refundId: 'refund_1', paystackStatus: 'success' }])
    expect(mocks.refundUpdate).not.toHaveBeenCalled()
    expect(mocks.notifyRefundProcessed).not.toHaveBeenCalled()
  })

  it('never moves a row backwards out of a final state', async () => {
    setRows([
      refundRow({ id: 'refund_1', status: 'PROCESSED', paystackRefundId: '9001' }),
      refundRow({ id: 'refund_2', idempotencyKey: 'CUSTOMER_CANCEL:item_b', amount: 70 }),
    ])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [
        paystackRefund({ id: 9001, amount: 3000, status: 'processing' }),
        paystackRefund({ id: 9002, amount: 7000 }),
      ],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const json = await (await handleRefundWebhook(body, sign(body))).json()

    expect(json.reconciled).toBe(1)
    const updatedIds = mocks.refundUpdate.mock.calls.map((call: any[]) => call[0].where.id)
    expect(updatedIds).toEqual(['refund_2'])
  })

  it('does not announce a refund that was already PROCESSED', async () => {
    setRows([refundRow({ id: 'refund_1', status: 'PROCESSED', paystackRefundId: '9001' })])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000, status: 'processed' })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    await handleRefundWebhook(body, sign(body))

    expect(mocks.notifyRefundProcessed).not.toHaveBeenCalled()
  })

  it('does not announce a refund that landed in FAILED', async () => {
    setRows([refundRow({ id: 'refund_1', amount: 30 })])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000, status: 'failed' })],
    })
    const body = payload('refund.failed', { transaction_reference: 'DHV-ABC123' })

    const json = await (await handleRefundWebhook(body, sign(body))).json()

    expect(json.reconciled).toBe(1)
    expect(mocks.refundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    )
    expect(mocks.notifyRefundProcessed).not.toHaveBeenCalled()
  })

  it('settles the order only when the PROCESSED refunds cover the full payment', async () => {
    setRows([
      refundRow({ id: 'refund_1', orderItemId: 'item_a', amount: 30 }),
      refundRow({ id: 'refund_2', orderItemId: 'item_b', amount: 70, idempotencyKey: 'CUSTOMER_CANCEL:item_b' }),
    ])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000 }), paystackRefund({ id: 9002, amount: 7000 })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    // 30 + 70 == the 100 charged, so the order settles.
    expect(json.paymentStatusUpdated).toBe(true)
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { paymentStatus: 'REFUNDED' },
    })
  })

  it('leaves the order PAID when the processed refunds only cover part of the payment', async () => {
    setRows([refundRow({ id: 'refund_1', orderItemId: 'item_a', amount: 30 })])
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000 })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const json = await (await handleRefundWebhook(body, sign(body))).json()

    expect(json.paymentStatusUpdated).toBe(false)
    expect(mocks.orderUpdate).not.toHaveBeenCalled()
  })

  it('leaves the order PAID while a refund row is still outstanding', async () => {
    setRows([
      refundRow({ id: 'refund_1', orderItemId: 'item_a', amount: 30 }),
      refundRow({ id: 'refund_2', orderItemId: 'item_b', amount: 70, idempotencyKey: 'CUSTOMER_CANCEL:item_b' }),
    ])
    // Only the first refund is back from Paystack; the second is still pending.
    mocks.listPaystackRefunds.mockResolvedValue({
      success: true,
      refunds: [paystackRefund({ id: 9001, amount: 3000 })],
    })
    const body = payload('refund.processed', { transaction_reference: 'DHV-ABC123' })

    const json = await (await handleRefundWebhook(body, sign(body))).json()

    expect(json.paymentStatusUpdated).toBe(false)
    expect(mocks.orderUpdate).not.toHaveBeenCalled()
  })

  it('acknowledges a refund event with an empty Paystack list without touching rows', async () => {
    setRows([refundRow()])
    mocks.listPaystackRefunds.mockResolvedValue({ success: true, refunds: [] })
    const body = payload('refund.pending', { transaction_reference: 'DHV-ABC123' })

    const response = await handleRefundWebhook(body, sign(body))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.reconciled).toBe(0)
    expect(mocks.refundUpdate).not.toHaveBeenCalled()
  })
})
