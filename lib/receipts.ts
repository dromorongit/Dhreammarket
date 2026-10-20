import { getPrisma } from '@/lib/prisma'
import { orderDisplayNumber } from '@/lib/manual-orders'
import {
  PUBLIC_ORDER_ITEM_SELECT,
  PUBLIC_ORDER_SELECT,
} from '@/lib/public-selects'

const RECEIPT_TOKEN_REGEX = /^[0-9a-f]{32}$/

export interface ReceiptItem {
  name: string
  variantLabel: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ReceiptDTO {
  storeName: string
  storeSlug: string
  storeLogo: string | null
  storeContact: string | null
  displayNumber: string
  createdAt: string
  items: ReceiptItem[]
  subtotal: number
  deliveryFee: number
  total: number
  currency: string
  paymentStatus: 'PAID' | 'UNPAID'
  paymentMethod: string | null
  status: string
  customerFirstName: string | null
}

function variantLabel(variant: { color?: string | null; size?: string | null; age?: string | null } | null): string | null {
  if (!variant) return null
  const parts = [variant.color, variant.size, variant.age].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : null
}

export async function getReceiptByToken(token: string): Promise<ReceiptDTO | null> {
  if (!RECEIPT_TOKEN_REGEX.test(token)) {
    return null
  }

  const prisma = getPrisma()

  const order = await prisma.order.findFirst({
    where: {
      receiptToken: token,
      source: 'MANUAL',
    },
    // The receipt is public: the token is the only gate. Every field is
    // selected on purpose, because an `include` would ship the vendor's cost
    // price and the delivery cost to an anonymous browser.
    select: {
      ...PUBLIC_ORDER_SELECT,
      vendorCustomer: {
        select: {
          store: {
            select: {
              name: true,
              slug: true,
              logo: true,
              mainPhoneNumber: true,
              whatsappNumber: true,
            },
          },
        },
      },
      items: {
        select: {
          ...PUBLIC_ORDER_ITEM_SELECT,
          product: {
            select: {
              name: true,
            },
          },
          productVariant: {
            select: {
              color: true,
              size: true,
              age: true,
            },
          },
        },
      },
    },
  })

  if (!order) {
    return null
  }

  const store = order.vendorCustomer?.store
  const customerFirstName = order.customerFirstName || null
  const paymentStatus: 'PAID' | 'UNPAID' = order.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'
  const paymentMethod = paymentStatus === 'PAID' ? order.paymentMethod : null

  // Store public contact: prefer whatsapp, fall back to main phone.
  const storeContact = store?.whatsappNumber || store?.mainPhoneNumber || null

  return {
    storeName: store?.name ?? '',
    storeSlug: store?.slug ?? '',
    storeLogo: store?.logo ?? null,
    storeContact,
    displayNumber: orderDisplayNumber(order.id),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      name: item.product.name,
      variantLabel: variantLabel(item.productVariant),
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal: item.price * item.quantity,
    })),
    subtotal: order.subtotal ?? 0,
    deliveryFee: order.shipping ?? 0,
    total: order.total,
    currency: 'GHS',
    paymentStatus,
    paymentMethod,
    status: order.status,
    customerFirstName,
  }
}
