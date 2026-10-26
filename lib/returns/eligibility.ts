import { Prisma } from '@prisma/client'
import { Caps } from '@/lib/refunds/process-refund'
import type { EligibilityReason, EligibilityResult } from './types'

type Item = {
  id: string
  price: number
  quantity: number
  deliveredAt?: Date | string | null
}

type Order = {
  id?: string
  status?: string
  paymentStatus?: string
  total?: number
  items?: Item[]
  payment?: { id?: string; amount?: number | string | Prisma.Decimal } | null
  refunds?: { amount: number | string | Prisma.Decimal | null; status: string; orderItemId?: string | null }[]
}

type Product = {
  isReturnable?: boolean
}

type ExistingRequest = { status: string; orderItemId?: string }

export type CheckReturnEligibilityInput = {
  item: Item
  order: Order
  product: Product
  existingRequests: ExistingRequest[]
  alreadyRefunded?: number | string | Prisma.Decimal
  now: Date | string | number
  windowDays: number
}

const OPEN_STATUSES = new Set([
  'PENDING',
  'ITEM_IN_TRANSIT',
  'ITEM_RECEIVED',
  'AWAITING_REFUND',
  'ESCALATED',
])

export function checkReturnEligibility(
  input: CheckReturnEligibilityInput
): EligibilityResult {
  const { item, order, product, existingRequests, now, windowDays } = input
  const nowDate = now instanceof Date ? now : new Date(now)

  const deliveredAt =
    item.deliveredAt instanceof Date
      ? item.deliveredAt
      : item.deliveredAt
      ? new Date(item.deliveredAt)
      : null

  if (!deliveredAt || deliveredAt.getTime() > nowDate.getTime()) {
    return { eligible: false, reason: 'INVALID_DELIVERY_DATE' }
  }

  if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
    return { eligible: false, reason: 'NOT_DELIVERED' }
  }

  if (order.paymentStatus !== 'PAID') {
    return { eligible: false, reason: 'ORDER_NOT_PAID' }
  }

  if (product.isReturnable === false) {
    return { eligible: false, reason: 'NOT_RETURNABLE_PRODUCT' }
  }

  const deadline = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
  if (nowDate.getTime() > deadline.getTime()) {
    return { eligible: false, reason: 'WINDOW_EXPIRED' }
  }

  const items = order.items && order.items.length > 0 ? order.items : [item]

  let refunds = order.refunds ? [...order.refunds] : []
  if ((!order.refunds || order.refunds.length === 0) && input.alreadyRefunded) {
    refunds = [
      {
        amount: input.alreadyRefunded as any,
        status: 'PROCESSED',
        orderItemId: item.id,
      },
    ]
  }

  const capsOrder = {
    id: order.id ?? 'order',
    total: order.total ?? items.reduce((s, i) => s + i.price * i.quantity, 0),
    items: items.map((i) => ({ id: i.id, price: i.price, quantity: i.quantity })),
    payment: {
      id: order.payment?.id ?? 'payment',
      amount: order.payment?.amount ?? order.total ?? 0,
    },
    refunds: refunds.map((r) => ({
      amount: r.amount as any,
      status: r.status as any,
      orderItemId: r.orderItemId ?? null,
    })),
  }

  const caps = Caps.forOrder(capsOrder as any)
  const maxRefundAmount = new Prisma.Decimal(
    String(caps.itemRemaining(item.id))
  )

  if (maxRefundAmount.lte(0)) {
    return { eligible: false, reason: 'FULLY_REFUNDED' }
  }

  const hasOpen = (existingRequests || []).some(
    (r) => OPEN_STATUSES.has(r.status) && (!r.orderItemId || r.orderItemId === item.id)
  )
  if (hasOpen) {
    return { eligible: false, reason: 'OPEN_REQUEST_EXISTS' }
  }

  return { eligible: true, maxRefundAmount }
}