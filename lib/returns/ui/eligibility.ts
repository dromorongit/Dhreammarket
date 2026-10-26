import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/prisma'
import { checkReturnEligibility } from '@/lib/returns/eligibility'
import { getReturnWindowDays } from '@/lib/feature-flags'
import { NotFoundError } from './server'
import type { EligibilityReason, EligibilityResult } from '@/lib/returns/types'

const ORDER_ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export interface OrderItemSummary {
  id: string
  name: string
  price: number
  quantity: number
  imageUrl: string | null
  deliveredAt: Date | string | null
}

export interface OrderSummary {
  id: string
  status: string
  paymentStatus: string
  total: number
}

export interface EligibilityCheck {
  orderItemId: string
  item: OrderItemSummary
  order: OrderSummary
  windowDays: number
  eligibility: EligibilityResult
}

function toOrderSummary(order: any): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: Number(order.total ?? 0),
  }
}

function toItemSummary(item: any): OrderItemSummary {
  const images = Array.isArray(item.product?.images) ? item.product.images : []
  return {
    id: item.id,
    name: item.product?.name ?? 'Item',
    price: Number(item.price ?? 0),
    quantity: item.quantity,
    imageUrl: images[0]?.url ?? null,
    deliveredAt: item.deliveredAt,
  }
}

export async function getOrderItemEligibility(
  customerId: string,
  orderItemId: string,
  options: { now?: number | string | Date } = {},
): Promise<EligibilityCheck> {
  if (typeof orderItemId !== 'string' || !ORDER_ITEM_ID_PATTERN.test(orderItemId)) {
    throw new NotFoundError()
  }

  const item = await getPrisma().orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      id: true,
      price: true,
      quantity: true,
      deliveredAt: true,
      orderId: true,
      product: { select: { id: true, name: true, isReturnable: true, images: { select: { url: true } } } },
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
      returnRequests: { select: { id: true, status: true, orderItemId: true } },
    },
  })

  if (!item || item.order.userId !== customerId) {
    throw new NotFoundError()
  }

  const now = options.now ?? Date.now()
  const windowDays = getReturnWindowDays()

  const existingRequests = (item.returnRequests ?? []).map((r: any) => ({
    status: r.status,
    orderItemId: r.orderItemId,
  }))

  const eligibility = checkReturnEligibility({
    item: { id: item.id, price: item.price, quantity: item.quantity, deliveredAt: item.deliveredAt },
    order: {
      id: item.order.id,
      status: item.order.status,
      paymentStatus: item.order.paymentStatus,
      total: item.order.total,
      items: (item.order.items ?? []).map((i: any) => ({ id: i.id, price: i.price, quantity: i.quantity })),
      payment: item.order.payment ? { id: item.order.payment.id, amount: item.order.payment.amount } : null,
      refunds: item.order.refunds ?? [],
    },
    product: { isReturnable: item.product.isReturnable },
    existingRequests,
    now,
    windowDays,
  })

  return {
    orderItemId: item.id,
    item: toItemSummary(item),
    order: toOrderSummary(item.order),
    windowDays,
    eligibility,
  }
}

export function eligibilityToJson(eligibility: EligibilityResult, windowDays: number) {
  if (eligibility.eligible) {
    return {
      eligible: true,
      maxRefundAmount: eligibility.maxRefundAmount.toFixed(2),
      windowDays,
    }
  }
  return { eligible: false, reason: eligibility.reason, windowDays }
}
