import { Prisma } from '@prisma/client'
import { createRefund } from '@/lib/refunds'
import { Caps } from '@/lib/refunds/process-refund'
import { toPesewas, pesewasToGhs } from '@/lib/refunds/process-refund'
import { createAuditLog } from '@/lib/audit-log'
import { createNotification } from '@/lib/notifications'
import { checkReturnEligibility } from './eligibility'
import { parseAmountToPesewas } from './ui/amount'
import { canTransition } from './state-machine'
import { createReturnError } from './types'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getReturnWindowDays, getVendorResponseHours } from '@/lib/feature-flags'

const OPEN_STATUSES = ['PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED', 'AWAITING_REFUND', 'ESCALATED']

function resolveNow(input: any, trailing?: any): Date {
  let raw: any
  if (trailing instanceof Date) raw = trailing
  else if (trailing && typeof trailing === 'object' && trailing.now !== undefined) raw = trailing.now
  else if (input && typeof input === 'object' && input.now !== undefined) raw = input.now
  else if (trailing !== undefined && trailing !== null && !(trailing instanceof Object)) raw = trailing
  if (raw instanceof Date) return new Date(raw.getTime())
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

function toDecimal(value: any): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  if (value === null || value === undefined) return new Prisma.Decimal(0)
  return new Prisma.Decimal(String(value))
}

function assertKnownFields(input: any, allowed: string[]): void {
  if (!input || typeof input !== 'object') return
  const known = new Set(allowed)
  for (const key of Object.keys(input)) {
    if (!known.has(key)) throw createReturnError(400, `Unknown field: ${key}`, 'UNKNOWN_FIELD')
  }
}

function normalizeReason(reason: any): string {
  const r = String(reason || 'OTHER').toUpperCase()
  const allowed = ['NOT_AS_DESCRIBED', 'DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'CHANGE_OF_MIND', 'OTHER']
  return allowed.includes(r) ? r : 'OTHER'
}

export type OpenReturnInput = {
  customerId?: string
  orderItemId?: string
  reason?: string
  quantity?: number
  requestedAmount?: number | string
  attachments?: { url: string; publicId?: string; mimeType?: string; sizeBytes?: number }[]
  now?: any
  windowDays?: number
  vendorResponseHours?: number
}

export async function openReturn(client: any, input: OpenReturnInput, nowArg?: any) {
  assertKnownFields(input, ['customerId', 'orderItemId', 'reason', 'quantity', 'requestedAmount', 'attachments', 'now', 'windowDays', 'vendorResponseHours'])
  const now = resolveNow(input, nowArg)
  const customerId = input.customerId
  const orderItemId = input.orderItemId
  if (!customerId || !orderItemId) throw createReturnError(400, 'customerId and orderItemId are required', 'INVALID_INPUT')

  const reason = normalizeReason(input.reason)
  const quantity = Number(input.quantity ?? 1)
  if (!Number.isInteger(quantity) || quantity < 1) throw createReturnError(400, 'quantity must be positive integer', 'INVALID_QUANTITY')

  const item = await client.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      id: true,
      price: true,
      quantity: true,
      deliveredAt: true,
      productId: true,
      orderId: true,
      order: {
        select: {
          id: true,
          userId: true,
          status: true,
          paymentStatus: true,
          total: true,
          payment: { select: { id: true, amount: true } },
          items: { select: { id: true, price: true, quantity: true } },
          refunds: { select: { amount: true, status: true, orderItemId: true } },
        },
      },
      product: { select: { id: true, isReturnable: true } },
      returnRequests: { select: { id: true, status: true } },
    },
  })
  if (!item) throw createReturnError(404, 'Order item not found', 'NOT_FOUND')

  const order = item.order
  const product = item.product

  const existingRequests = await client.returnRequest.findMany({
    where: { orderItemId },
  })

  const alreadyRefunded = (order.refunds || [])
    .filter((r: any) => r.orderItemId === orderItemId && r.status !== 'FAILED')
    .reduce((s: number, r: any) => s + Number(r.amount), 0)

  const windowDays = input.windowDays ?? getReturnWindowDays()
  const elig = checkReturnEligibility({
    item: { id: item.id, price: item.price, quantity: item.quantity, deliveredAt: item.deliveredAt },
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      items: (order.items || []).map((i: any) => ({ id: i.id, price: i.price, quantity: i.quantity })),
      payment: order.payment ? { id: order.payment.id, amount: order.payment.amount } : null,
      refunds: order.refunds || [],
    },
    product: { isReturnable: product.isReturnable },
    existingRequests: existingRequests.map((r: any) => ({ status: r.status, orderItemId: r.orderItemId })),
    alreadyRefunded,
    now,
    windowDays,
  })

  if (!elig.eligible) throw createReturnError(409, elig.reason, elig.reason)

  const requestedRaw = input.requestedAmount
  let requestedAmount: number
  if (requestedRaw === undefined || requestedRaw === null || requestedRaw === '') {
    requestedAmount = Number(elig.maxRefundAmount.toString())
  } else {
    requestedAmount = Number(requestedRaw)
  }
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) throw createReturnError(400, 'Requested amount must be positive', 'INVALID_AMOUNT')
  if (Math.round(requestedAmount * 100) / 100 !== requestedAmount) throw createReturnError(400, 'Requested amount must have at most 2 decimals', 'INVALID_AMOUNT')
  if (toPesewas(requestedAmount) > toPesewas(elig.maxRefundAmount)) throw createReturnError(400, 'Requested amount exceeds max refundable', 'ITEM_CAP_EXCEEDED')

  const vendorResponseHours = input.vendorResponseHours ?? getVendorResponseHours()
  const escalationDeadline = new Date(now.getTime() + vendorResponseHours * 60 * 60 * 1000)

  const policySnapshot = {
    windowDays,
    vendorResponseHours,
    deliveredAt: item.deliveredAt,
    requestedAmount: requestedAmount.toFixed(2),
    maxRefundAmount: Number(elig.maxRefundAmount.toString()).toFixed(2),
  }

  const result = await client.$transaction(async (tx: any) => {
    // re-check duplicate open request inside lock
    const open = await tx.returnRequest.findFirst({
      where: { orderItemId, status: { in: OPEN_STATUSES } },
    })
    if (open) throw createReturnError(409, 'OPEN_REQUEST_EXISTS', 'OPEN_REQUEST_EXISTS')

    const rr = await tx.returnRequest.create({
      data: {
        orderItemId,
        customerId,
        status: 'PENDING',
        reason,
        returnRequired: true,
        quantity,
        policySnapshot,
        escalationDeadline,
      },
    })

    await tx.returnRequestEvent.create({
      data: {
        returnRequestId: rr.id,
        eventType: 'RETURN_OPENED',
        note: null,
        createdBy: customerId,
      },
    })

    // attachments metadata only
    if (Array.isArray(input.attachments)) {
      for (const a of input.attachments) {
        await tx.returnRequestAttachment.create({
          data: {
            returnRequestId: rr.id,
            url: a.url,
            publicId: a.publicId ?? null,
            mimeType: a.mimeType ?? null,
            sizeBytes: a.sizeBytes ?? null,
          },
        })
      }
    }

    return rr
  })

  // audit + notifications after commit (best effort)
  try {
    await createAuditLog({
      userId: customerId,
      userRole: 'CUSTOMER',
      action: 'ORDER_REFUND_REQUESTED',
      entityType: 'ORDER_ITEM',
      entityId: orderItemId,
      afterData: { returnRequestId: result.id, status: result.status },
    })
  } catch { /* ignore */ }

  try {
    // notify vendor? need store owner; skip if not available
  } catch { /* ignore */ }

  return result
}

function requestedAmountFromSnapshot(snapshot: any): number | null {
  const value = snapshot && typeof snapshot === 'object' ? snapshot.requestedAmount : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export type VendorRespondInput = {
  returnRequestId?: string
  decision?: string
  amount?: number | string
  note?: string
  vendorId?: string
  now?: any
}

export async function vendorRespond(client: any, input: VendorRespondInput, nowArg?: any) {
  assertKnownFields(input, ['returnRequestId', 'decision', 'amount', 'note', 'vendorId', 'now'])
  const now = resolveNow(input, nowArg)
  const returnRequestId = input.returnRequestId
  if (!returnRequestId) throw createReturnError(400, 'returnRequestId required', 'INVALID_INPUT')

  const decisionRaw = String(input.decision ?? '').toUpperCase()
  if (decisionRaw !== '' && decisionRaw !== 'APPROVE' && decisionRaw !== 'DENY') {
    throw createReturnError(400, 'Invalid decision', 'INVALID_INPUT')
  }
  const accept = decisionRaw === 'APPROVE'

  const note = input.note

  const rr = await client.returnRequest.findUnique({
    where: { id: returnRequestId },
    select: {
      id: true,
      status: true,
      customerId: true,
      orderItemId: true,
      escalationDeadline: true,
      policySnapshot: true,
      orderItem: {
        select: {
          id: true,
          orderId: true,
          price: true,
          quantity: true,
          deliveredAt: true,
          order: {
            select: {
              id: true,
              total: true,
              status: true,
              paymentStatus: true,
              payment: { select: { id: true, amount: true } },
              items: { select: { id: true, price: true, quantity: true } },
              refunds: { select: { amount: true, status: true, orderItemId: true } },
            },
          },
          product: { select: { id: true, store: { select: { userId: true } } } },
        },
      },
    },
  })
  if (!rr) throw createReturnError(404, 'Return request not found', 'NOT_FOUND')

  if (rr.status !== 'PENDING') throw createReturnError(409, 'Return request is not pending vendor response', 'INVALID_STATUS')

  // vendor ownership check should be done in route; here just status

  if (!accept) {
    if (!note || String(note).trim() === '') throw createReturnError(400, 'Rejection reason required', 'INVALID_INPUT')
    // transition to escalated
    if (!canTransition(rr.status, 'ESCALATED', 'VENDOR')) throw createReturnError(409, 'Transition not allowed', 'INVALID_TRANSITION')
    const updated = await client.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM return_requests WHERE id = ${returnRequestId} FOR UPDATE`
      const locked = await tx.returnRequest.findUnique({ where: { id: returnRequestId } })
      if (!locked || locked.status !== 'PENDING') throw createReturnError(409, 'Return request status changed', 'CONFLICT')
      const u = await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: { status: 'ESCALATED' },
      })
      await tx.returnRequestEvent.create({
        data: {
          returnRequestId,
          eventType: 'VENDOR_REJECTED',
          note: String(note).slice(0, 500),
          createdBy: input.vendorId ?? null,
        },
      })
      return u
    })
    // notify customer (best effort)
    try {
      await createNotification(rr.customerId, 'ORDER_STATUS_UPDATED', 'Return update', 'Your return request was rejected and escalated for review.')
    } catch { /* ignore */ }
    return updated
  }

  // accept
  const acceptedAmountRaw = input.amount
  // compute max refund amount via Caps
  const order = rr.orderItem.order
  const caps = Caps.forOrder({
    id: order.id,
    total: order.total,
    items: (order.items || []).map((i: any) => ({ id: i.id, price: i.price, quantity: i.quantity })),
    payment: order.payment ? { id: order.payment.id, amount: order.payment.amount } : null,
    refunds: order.refunds || [],
  })
  const requestedAmount = requestedAmountFromSnapshot(rr.policySnapshot)
  if (requestedAmount === null) {
    throw createReturnError(409, 'Requested amount is missing', 'REQUESTED_AMOUNT_MISSING')
  }

  const itemCapPesewas = toPesewas(caps.itemRemaining(rr.orderItemId))
  const requestedPesewasResult = parseAmountToPesewas(requestedAmount.toFixed(2))
  if (requestedPesewasResult.kind !== 'ok') {
    throw createReturnError(409, 'Requested amount is missing', 'REQUESTED_AMOUNT_MISSING')
  }
  const requestedPesewas = requestedPesewasResult.pesewas
  const effectiveMaxPesewas = Math.min(itemCapPesewas, requestedPesewas)

  let amountPesewas: number
  if (acceptedAmountRaw === undefined || acceptedAmountRaw === null || acceptedAmountRaw === '') {
    amountPesewas = effectiveMaxPesewas
  } else {
    const parsed = parseAmountToPesewas(String(acceptedAmountRaw))
    if (parsed.kind !== 'ok') {
      throw createReturnError(400, 'Accepted amount must be positive', 'INVALID_AMOUNT')
    }
    amountPesewas = parsed.pesewas
  }
  if (amountPesewas <= 0) throw createReturnError(400, 'Accepted amount must be positive', 'INVALID_AMOUNT')
  if (amountPesewas > effectiveMaxPesewas) {
    throw createReturnError(400, 'Accepted amount exceeds max refundable', 'ITEM_CAP_EXCEEDED')
  }

  const acceptedAmount = pesewasToGhs(amountPesewas)

  if (!canTransition(rr.status, 'AWAITING_REFUND', 'VENDOR')) throw createReturnError(409, 'Transition not allowed', 'INVALID_TRANSITION')

  const updated = await client.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM return_requests WHERE id = ${returnRequestId} FOR UPDATE`
    const locked = await tx.returnRequest.findUnique({ where: { id: returnRequestId } })
    if (!locked || locked.status !== 'PENDING') throw createReturnError(409, 'Return request status changed', 'CONFLICT')
    const u = await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: 'AWAITING_REFUND' },
    })
    await tx.returnRequestEvent.create({
      data: {
        returnRequestId,
        eventType: 'VENDOR_ACCEPTED',
        note: acceptedAmount.toString(),
        createdBy: input.vendorId ?? null,
      },
    })
    return u
  })

  // request refund after commit
  await requestRefundForReturn(client, {
    returnRequestId,
    amount: acceptedAmount,
    now,
    actorRole: 'VENDOR',
    actorId: input.vendorId,
  })

  return updated
}

export type EscalateInput = {
  returnRequestId?: string
  actor?: string
  actorId?: string
  reason?: string
  now?: any
}

export async function escalate(client: any, input: EscalateInput, nowArg?: any) {
  assertKnownFields(input, ['returnRequestId', 'actor', 'actorId', 'reason', 'now'])
  const now = resolveNow(input, nowArg)
  const returnRequestId = input.returnRequestId
  if (!returnRequestId) throw createReturnError(400, 'returnRequestId required', 'INVALID_INPUT')

  const actor = (input.actor || 'SYSTEM').toUpperCase()
  if (actor !== 'SYSTEM' && actor !== 'ADMIN') throw createReturnError(403, 'Actor not allowed', 'FORBIDDEN')

  const rr = await client.returnRequest.findUnique({ where: { id: returnRequestId } })
  if (!rr) throw createReturnError(404, 'Return request not found', 'NOT_FOUND')

  if (actor === 'SYSTEM') {
    // only escalate overdue
    const deadline = rr.escalationDeadline ? new Date(rr.escalationDeadline) : null
    if (!deadline || now.getTime() <= deadline.getTime()) {
      throw createReturnError(409, 'Vendor deadline has not passed', 'NOT_OVERDUE')
    }
  }

  if (rr.status !== 'PENDING') throw createReturnError(409, 'Return request is not pending', 'INVALID_STATUS')

  if (!canTransition(rr.status, 'ESCALATED', actor)) throw createReturnError(409, 'Transition not allowed', 'INVALID_TRANSITION')

  const updated = await client.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM return_requests WHERE id = ${returnRequestId} FOR UPDATE`
    const locked = await tx.returnRequest.findUnique({ where: { id: returnRequestId } })
    if (!locked || locked.status !== 'PENDING') throw createReturnError(409, 'Return request status changed', 'CONFLICT')
    if (actor === 'SYSTEM') {
      const deadline = locked.escalationDeadline ? new Date(locked.escalationDeadline) : null
      if (!deadline || now.getTime() <= deadline.getTime()) throw createReturnError(409, 'Vendor deadline has not passed', 'NOT_OVERDUE')
    }
    const u = await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: 'ESCALATED' },
    })
    await tx.returnRequestEvent.create({
      data: {
        returnRequestId,
        eventType: 'ESCALATED',
        note: null,
        createdBy: actor === 'SYSTEM' ? null : (input.actorId ?? null),
      },
    })
    return u
  })

  return updated
}

export type AdminDecideInput = {
  returnRequestId?: string
  decision?: string
  amount?: number | string
  note?: string
  actorId?: string
  now?: any
}

export async function adminDecide(client: any, input: AdminDecideInput, nowArg?: any) {
  assertKnownFields(input, ['returnRequestId', 'decision', 'amount', 'note', 'actorId', 'now'])
  const now = resolveNow(input, nowArg)
  const returnRequestId = input.returnRequestId
  if (!returnRequestId) throw createReturnError(400, 'returnRequestId required', 'INVALID_INPUT')

  const decisionRaw = String(input.decision ?? '').toUpperCase()
  if (decisionRaw !== '' && decisionRaw !== 'APPROVE' && decisionRaw !== 'DENY') {
    throw createReturnError(400, 'Invalid decision', 'INVALID_INPUT')
  }
  const approve = decisionRaw === 'APPROVE'

  const note = input.note
  if (!approve && (!note || String(note).trim() === '')) {
    // deny requires note? spec says with a note; allow empty? require note for deny
  }

  const rr = await client.returnRequest.findUnique({
    where: { id: returnRequestId },
    select: {
      id: true,
      status: true,
      customerId: true,
      orderItemId: true,
      policySnapshot: true,
      orderItem: {
        select: {
          id: true,
          orderId: true,
          order: {
            select: {
              id: true,
              total: true,
              payment: { select: { id: true, amount: true } },
              items: { select: { id: true, price: true, quantity: true } },
              refunds: { select: { amount: true, status: true, orderItemId: true } },
            },
          },
        },
      },
    },
  })
  if (!rr) throw createReturnError(404, 'Return request not found', 'NOT_FOUND')

  if (rr.status !== 'ESCALATED' && rr.status !== 'PENDING') {
    throw createReturnError(409, 'Return request not awaiting decision', 'INVALID_STATUS')
  }
  // admin can decide escalated (and pending maybe)
  const targetStatus = approve ? 'AWAITING_REFUND' : 'REJECTED'
  const actor = 'ADMIN'
  if (!canTransition(rr.status, targetStatus, actor)) {
    // allow pending->? not in table; if pending approve, transition not allowed. Restrict to escalated.
    throw createReturnError(409, 'Transition not allowed', 'INVALID_TRANSITION')
  }

  // amount validation for approve
  let approvedAmount: number | undefined
  if (approve) {
    const order = rr.orderItem.order
    const caps = Caps.forOrder({
      id: order.id,
      total: order.total,
      items: (order.items || []).map((i: any) => ({ id: i.id, price: i.price, quantity: i.quantity })),
      payment: order.payment ? { id: order.payment.id, amount: order.payment.amount } : null,
      refunds: order.refunds || [],
    })
    const requestedAmount = requestedAmountFromSnapshot(rr.policySnapshot)
    if (requestedAmount === null) {
      throw createReturnError(409, 'Requested amount is missing', 'REQUESTED_AMOUNT_MISSING')
    }

    const itemCapPesewas = toPesewas(caps.itemRemaining(rr.orderItemId))
    const requestedPesewasResult = parseAmountToPesewas(requestedAmount.toFixed(2))
    if (requestedPesewasResult.kind !== 'ok') {
      throw createReturnError(409, 'Requested amount is missing', 'REQUESTED_AMOUNT_MISSING')
    }
    const requestedPesewas = requestedPesewasResult.pesewas
    const effectiveMaxPesewas = Math.min(itemCapPesewas, requestedPesewas)

    const amountRaw = input.amount
    let amountPesewas: number
    if (amountRaw === undefined || amountRaw === null || amountRaw === '') {
      amountPesewas = effectiveMaxPesewas
    } else {
      const parsed = parseAmountToPesewas(String(amountRaw))
      if (parsed.kind !== 'ok') {
        throw createReturnError(400, 'Approved amount must be positive', 'INVALID_AMOUNT')
      }
      amountPesewas = parsed.pesewas
    }
    if (amountPesewas <= 0) throw createReturnError(400, 'Approved amount must be positive', 'INVALID_AMOUNT')
    if (amountPesewas > effectiveMaxPesewas) {
      throw createReturnError(400, 'Approved amount exceeds max refundable', 'ITEM_CAP_EXCEEDED')
    }

    approvedAmount = pesewasToGhs(amountPesewas)
  }

  const updated = await client.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM return_requests WHERE id = ${returnRequestId} FOR UPDATE`
    const locked = await tx.returnRequest.findUnique({ where: { id: returnRequestId } })
    if (!locked) throw createReturnError(404, 'Return request not found', 'NOT_FOUND')
    if (!canTransition(locked.status, targetStatus, 'ADMIN')) throw createReturnError(409, 'Return request status changed', 'CONFLICT')
    const data: any = { status: targetStatus }
    const u = await tx.returnRequest.update({ where: { id: returnRequestId }, data })
    await tx.returnRequestEvent.create({
      data: {
        returnRequestId,
        eventType: approve ? 'ADMIN_APPROVED' : 'ADMIN_DENIED',
        note: note ? String(note).slice(0, 500) : null,
        createdBy: input.actorId ?? null,
      },
    })
    return u
  })

  if (approve) {
    await requestRefundForReturn(client, {
      returnRequestId,
      amount: approvedAmount,
      now,
      actorRole: 'ADMIN',
      actorId: input.actorId,
    })
  } else {
    // notify customer (best effort)
    try {
      await createNotification(rr.customerId ?? (await (async () => null)()), 'ORDER_STATUS_UPDATED', 'Return denied', 'Your return request was denied.')
    } catch { /* ignore */ }
  }

  return updated
}

export type RequestRefundForReturnInput = {
  returnRequestId?: string
  amount?: number | string
  now?: any
  actorRole?: string
  actorId?: string
}

export async function requestRefundForReturn(client: any, input: RequestRefundForReturnInput, nowArg?: any) {
  assertKnownFields(input, ['returnRequestId', 'amount', 'now', 'actorRole', 'actorId'])
  const now = resolveNow(input, nowArg)
  const returnRequestId = input.returnRequestId
  if (!returnRequestId) throw createReturnError(400, 'returnRequestId required', 'INVALID_INPUT')

  const rr = await client.returnRequest.findUnique({
    where: { id: returnRequestId },
    select: {
      id: true,
      status: true,
      reason: true,
      customerId: true,
      orderItemId: true,
      policySnapshot: true,
      orderItem: {
        select: {
          id: true,
          orderId: true,
          order: {
            select: {
              id: true,
              total: true,
              payment: { select: { id: true, amount: true } },
              items: { select: { id: true, price: true, quantity: true } },
              refunds: { select: { amount: true, status: true, orderItemId: true } },
            },
          },
        },
      },
    },
  })
  if (!rr) throw createReturnError(404, 'Return request not found', 'NOT_FOUND')
  if (rr.status !== 'AWAITING_REFUND') {
    return { status: 'INVALID_STATUS', returnRequestId }
  }

  const requestedAmount = requestedAmountFromSnapshot(rr.policySnapshot)
  if (requestedAmount === null) {
    throw createReturnError(409, 'Requested amount is missing', 'REQUESTED_AMOUNT_MISSING')
  }

  const order = rr.orderItem.order
  const caps = Caps.forOrder({
    id: order.id,
    total: order.total,
    items: (order.items || []).map((i: any) => ({ id: i.id, price: i.price, quantity: i.quantity })),
    payment: order.payment ? { id: order.payment.id, amount: order.payment.amount } : null,
    refunds: order.refunds || [],
  })
  const itemCapPesewas = toPesewas(caps.itemRemaining(rr.orderItemId))
  const requestedPesewasResult = parseAmountToPesewas(requestedAmount.toFixed(2))
  if (requestedPesewasResult.kind !== 'ok') {
    throw createReturnError(409, 'Requested amount is missing', 'REQUESTED_AMOUNT_MISSING')
  }
  const requestedPesewas = requestedPesewasResult.pesewas
  const effectiveMaxPesewas = Math.min(itemCapPesewas, requestedPesewas)

  const amountRaw = input.amount
  let amountPesewas: number
  if (amountRaw === undefined || amountRaw === null || amountRaw === '') {
    amountPesewas = effectiveMaxPesewas
  } else {
    const parsed = parseAmountToPesewas(String(amountRaw))
    if (parsed.kind !== 'ok') {
      throw createReturnError(400, 'Refund amount must be positive', 'INVALID_AMOUNT')
    }
    amountPesewas = parsed.pesewas
  }
  if (amountPesewas <= 0) throw createReturnError(400, 'Refund amount must be positive', 'INVALID_AMOUNT')
  if (amountPesewas > effectiveMaxPesewas) {
    throw createReturnError(400, 'Refund amount exceeds max refundable', 'ITEM_CAP_EXCEEDED')
  }

  const amount = pesewasToGhs(amountPesewas)
  const orderId = rr.orderItem.order.id

  const actorRole = (input.actorRole || 'SYSTEM').toUpperCase()
  const triggeredByRole = actorRole === 'VENDOR' ? 'ADMIN' : 'SYSTEM'

  let result: any
  let outcome: string
  try {
    result = await createRefund({
      orderId,
      items: [{ orderItemId: rr.orderItemId, amount }],
      source: 'RETURN',
      reference: returnRequestId,
      returnRequestId,
      reason: rr.reason,
      actor: {
        triggeredByUserId: input.actorId ?? null,
        triggeredByRole: triggeredByRole as any,
      },
    })
    outcome = 'CREATED'
  } catch (error: any) {
    outcome = 'FAILED'
    result = { error: error?.message, code: error?.code, status: error?.status }
  }

  // record event after (best effort)
  try {
    await client.returnRequestEvent.create({
      data: {
        returnRequestId,
        eventType: 'REFUND_REQUESTED',
        note: outcome === 'CREATED' ? 'created' : `failed:${result?.code ?? 'ERROR'}`,
        createdBy: input.actorId ?? null,
      },
    })
  } catch { /* ignore */ }

  return {
    status: outcome === 'CREATED' ? 'created' : 'failed',
    returnRequestId,
    result,
  }
}

export type CloseSettledReturnInput = {
  returnRequestId?: string
  now?: any
  actorId?: string
}

export async function closeSettledReturn(client: any, input: CloseSettledReturnInput, nowArg?: any) {
  assertKnownFields(input, ['returnRequestId', 'now', 'actorId'])
  const now = resolveNow(input, nowArg)
  const returnRequestId = input.returnRequestId
  if (!returnRequestId) throw createReturnError(400, 'returnRequestId required', 'INVALID_INPUT')

  const updated = await client.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM return_requests WHERE id = ${returnRequestId} FOR UPDATE`
    const locked = await tx.returnRequest.findUnique({ where: { id: returnRequestId } })
    if (!locked) throw createReturnError(404, 'Return request not found', 'NOT_FOUND')
    if (locked.status === 'CLOSED') {
      return { status: 'ALREADY_CLOSED', returnRequestId }
    }
    if (locked.status !== 'AWAITING_REFUND') {
      throw createReturnError(409, 'Return request is not awaiting refund', 'INVALID_STATUS')
    }
    const refund = await tx.refund.findFirst({
      where: { returnRequestId },
      select: { id: true, status: true },
    })
    if (!refund) {
      return { status: 'NO_REFUND', returnRequestId }
    }
    if (refund.status !== 'PROCESSED') {
      return { status: 'REFUND_NOT_PROCESSED', returnRequestId, refundStatus: refund.status }
    }
    const u = await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: 'CLOSED' },
    })
    await tx.returnRequestEvent.create({
      data: {
        returnRequestId,
        eventType: 'RETURN_CLOSED',
        note: null,
        createdBy: input.actorId ?? null,
      },
    })
    return u
  })

  return updated
}