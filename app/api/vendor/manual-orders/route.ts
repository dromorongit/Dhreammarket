import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { rateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit-log'
import { consumeManualSaleStock } from '@/lib/stock-reservation'
import {
  computeOrderTotals,
  generateReceiptToken,
  validateChannel,
  validateDeliveryFee,
  validateIdempotencyKey,
  validateQuantity,
  resolveLinePrice,
  splitCustomerName,
  buildReceiptUrl,
  orderDisplayNumber,
  normalizeCustomerPhone,
  type ManualOrderLineInput,
  type ResolvedManualOrderLine,
} from '@/lib/manual-orders'
import {
  fromPesewas,
  resolveUnitCostPesawas,
  validateDeliveryCost,
} from '@/lib/sales-summary'
import { invalidateSalesSummaryCache } from '@/lib/sales-summary-cache'

export const dynamic = 'force-dynamic'

class InsufficientStockError extends Error {
  readonly products: Array<{ productId: string; productName: string }>
  constructor(products: Array<{ productId: string; productName: string }>, message?: string) {
    super(message || 'Insufficient stock to complete the manual order')
    this.name = 'InsufficientStockError'
    this.products = products
  }
}

type TxResult =
  | { kind: 'replay'; order: any }
  | { kind: 'conflict'; error: string }
  | { kind: 'created'; order: any; lines: ResolvedManualOrderLine[] }

function buildOrderResponse(order: any) {
  return {
    id: order.id,
    displayNumber: orderDisplayNumber(order.id),
    receiptToken: order.receiptToken,
    receiptUrl: order.receiptToken ? buildReceiptUrl(order.receiptToken) : null,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    channel: order.channel,
    currency: 'GHS',
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    deliveryCost: order.deliveryCost ?? null,
    customer: {
      name: order.customerFirstName,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
    items: (order.items || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.productVariantId,
      quantity: item.quantity,
      unitPrice: item.price,
    })),
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to create manual orders' },
        { status: 403 }
      )
    }

    const manualOrderRateLimit = rateLimit('manual-orders')
    const rateLimitResult = manualOrderRateLimit(request)
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const {
      customer,
      channel,
      items,
      deliveryFee,
      deliveryCost,
      markPaid,
      paymentMethod,
      idempotencyKey,
    } = body

    if (!customer || typeof customer !== 'object') {
      return NextResponse.json({ error: 'customer is required' }, { status: 400 })
    }

    const nameResult = typeof customer.name === 'string' && customer.name.trim().length > 0
      ? { name: customer.name.trim() }
      : { error: 'customer.name is required' }
    if ('error' in nameResult) {
      return NextResponse.json({ error: nameResult.error }, { status: 400 })
    }
    const name = nameResult.name

    const phoneResult = normalizeCustomerPhone(customer.phone)
    if ('error' in phoneResult) {
      return NextResponse.json({ error: phoneResult.error }, { status: 400 })
    }
    const normalizedPhone = phoneResult.phone

    const email = typeof customer.email === 'string' && customer.email.trim().length > 0
      ? customer.email.trim()
      : null

    const channelResult = validateChannel(channel)
    if ('error' in channelResult) {
      return NextResponse.json({ error: channelResult.error }, { status: 400 })
    }
    const saleChannel = channelResult.channel

    const idempotencyResult = validateIdempotencyKey(idempotencyKey)
    if ('error' in idempotencyResult) {
      return NextResponse.json({ error: idempotencyResult.error }, { status: 400 })
    }
    const idempotencyKeyValue = idempotencyResult.idempotencyKey

    const deliveryFeeResult = validateDeliveryFee(deliveryFee)
    if ('error' in deliveryFeeResult) {
      return NextResponse.json({ error: deliveryFeeResult.error }, { status: 400 })
    }
    const shippingPesewas = deliveryFeeResult.pesewas

    // What the vendor actually paid the rider. Optional: when it is not
    // given the order keeps a NULL delivery cost, which the money view
    // reports as "unknown" rather than as a free delivery.
    const deliveryCostResult = validateDeliveryCost(deliveryCost)
    if ('error' in deliveryCostResult) {
      return NextResponse.json({ error: deliveryCostResult.error }, { status: 400 })
    }
    const deliveryCostValue =
      deliveryCostResult.provided ? fromPesewas(deliveryCostResult.pesewas) : null

    const markPaidFlag = markPaid === true
    let paymentMethodValue: string | null = null
    if (markPaidFlag) {
      if (typeof paymentMethod !== 'string' || paymentMethod.trim().length === 0) {
        return NextResponse.json(
          { error: 'paymentMethod is required when markPaid is true' },
          { status: 400 }
        )
      }
      paymentMethodValue = paymentMethod.trim()
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'items must contain at most 100 lines' }, { status: 400 })
    }

    // Validate and price every line before opening the transaction.
    const productIds = items.map((item) => item.productId)
    const products = await getPrisma().product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    const resolvedLines: ResolvedManualOrderLine[] = []
    const overrideLines: Array<{ productId: string; variantId: string | null; unitPricePesewas: number; cataloguePricePesewas: number }> = []

    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== 'object') {
        return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
      }
      const { productId, variantId, quantity, unitPrice } = rawItem as ManualOrderLineInput

      if (typeof productId !== 'string' || productId.length === 0) {
        return NextResponse.json({ error: 'Each item requires a productId' }, { status: 400 })
      }
      const product = productMap.get(productId)
      if (!product) {
        return NextResponse.json({ error: `Product ${productId} not found` }, { status: 404 })
      }
      if (product.storeId !== store.id) {
        return NextResponse.json({ error: `Product ${productId} does not belong to your store` }, { status: 403 })
      }
      if (product.availabilityType !== 'IN_STOCK') {
        return NextResponse.json({ error: `Product ${product.name} is not available for manual sale` }, { status: 400 })
      }

      let variant: { price?: number | null; costPrice?: number | null } | null = null
      if (variantId) {
        if (typeof variantId !== 'string' || variantId.length === 0) {
          return NextResponse.json({ error: 'Invalid variantId' }, { status: 400 })
        }
        variant = (product.variants || []).find((v) => v.id === variantId) || null
        if (!variant) {
          return NextResponse.json({ error: `Variant ${variantId} does not belong to product ${productId}` }, { status: 400 })
        }
      }

      const quantityResult = validateQuantity(quantity)
      if ('error' in quantityResult) {
        return NextResponse.json({ error: quantityResult.error }, { status: 400 })
      }

      const priceResult = resolveLinePrice(product, variant, unitPrice)
      if ('error' in priceResult) {
        return NextResponse.json({ error: priceResult.error }, { status: 400 })
      }

      // Snapshot the cost of the line as it is right now, so that editing the
      // product cost later never changes the profit of this sale.
      const unitCostPesawas = resolveUnitCostPesawas(
        { source: 'MANUAL' },
        {
          costPriceSnapshot: null,
          variantCostPrice: variant?.costPrice ?? null,
          productCostPrice: product.costPrice ?? null,
        }
      )

      resolvedLines.push({
        productId,
        variantId: variantId || null,
        quantity: quantityResult.quantity,
        unitPricePesewas: priceResult.unitPricePesewas,
        overridden: priceResult.overridden,
        costPriceSnapshot: unitCostPesawas === null ? null : fromPesewas(unitCostPesawas),
      })

      if (priceResult.overridden) {
        overrideLines.push({
          productId,
          variantId: variantId || null,
          unitPricePesewas: priceResult.unitPricePesewas,
          cataloguePricePesewas: priceResult.cataloguePricePesewas,
        })
      }
    }

    const totals = computeOrderTotals(resolvedLines, shippingPesewas)

    // Namespace the idempotency key so it cannot collide with online checkout
    // keys or keys from other vendors: manual:${store.id}:${idempotencyKey}.
    const namespacedIdempotencyKey = `manual:${store.id}:${idempotencyKeyValue}`

    const prisma = getPrisma()
    const now = new Date()
    const receiptToken = generateReceiptToken()

    const result = await prisma.$transaction(async (tx) => {
      // Advisory lock on the namespaced idempotency key, held for the whole transaction.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${namespacedIdempotencyKey})::bigint)`

      const existing = await tx.order.findFirst({
        where: { idempotencyKey: namespacedIdempotencyKey },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, storeId: true } } },
          },
        },
      })

      if (existing) {
        const belongsToThisStore = (existing.items || []).some(
          (item: any) => item.product.storeId === store.id
        )
        if (belongsToThisStore) {
          return { kind: 'replay', order: existing } as TxResult
        }
        return { kind: 'conflict', error: 'Idempotency key is already in use by another store' } as TxResult
      }

      const customerRecord = await tx.vendorCustomer.upsert({
        where: { storeId_phone: { storeId: store.id, phone: normalizedPhone } },
        update: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
        },
        create: {
          storeId: store.id,
          name,
          phone: normalizedPhone,
          email,
          firstChannel: saleChannel,
        },
      })

      const { firstName, lastName } = splitCustomerName(name)

      const order = await tx.order.create({
        data: {
          userId: null,
          source: 'MANUAL',
          channel: saleChannel,
          status: 'PROCESSING',
          fulfillmentStatus: 'PROCESSING',
          paymentStatus: markPaidFlag ? 'PAID' : 'PENDING',
          paymentMethod: paymentMethodValue,
          paymentConfirmedAt: markPaidFlag ? now : null,
          receiptToken,
          vendorCustomerId: customerRecord.id,
          customerFirstName: firstName,
          customerLastName: lastName,
          customerPhone: normalizedPhone,
          customerEmail: email,
          shipping: totals.shipping,
          subtotal: totals.subtotal,
          total: totals.total,
          deliveryCost: deliveryCostValue,
          grossAmount: null,
          processorFee: null,
          netAmount: null,
          platformCommission: null,
          vendorEarnings: null,
          commissionRate: null,
          idempotencyKey: namespacedIdempotencyKey,
          walletAmountApplied: null,
          orderType: 'NORMAL',
          tax: null,
          customerAddress: null,
          customerCity: null,
          customerRegion: null,
          shippingDaysMin: null,
          shippingDaysMax: null,
          shippingZone: null,
        },
      })

      await tx.orderItem.createMany({
        data: resolvedLines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          productVariantId: line.variantId,
          quantity: line.quantity,
          price: line.unitPricePesewas / 100,
          costPriceSnapshot: line.costPriceSnapshot ?? null,
          grossAmount: null,
          processorFee: null,
          netAmount: null,
          platformCommission: null,
          vendorEarnings: null,
          commissionRate: null,
          availabilityType: 'IN_STOCK',
          allocatedQuantity: 0,
          shippedAt: null,
          deliveredAt: null,
        })),
      })

      const consumeResult = await consumeManualSaleStock(
        tx,
        resolvedLines.map((line) => ({
          productId: line.productId,
          productVariantId: line.variantId ?? undefined,
          quantity: line.quantity,
        })),
        order.id
      )

      if (!consumeResult.success) {
        throw new InsufficientStockError(
          resolvedLines.map((line) => ({
            productId: line.productId,
            productName: productMap.get(line.productId)!.name,
          })),
          consumeResult.error
        )
      }

      await createAuditLog({
        userId: payload.userId,
        userRole: payload.role,
        action: 'MANUAL_ORDER_CREATED',
        entityType: 'ORDER',
        entityId: order.id,
        afterData: {
          source: 'MANUAL',
          channel: saleChannel,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          total: totals.total,
          deliveryCost: deliveryCostValue,
          idempotencyKey: idempotencyKeyValue,
          vendorCustomerId: customerRecord.id,
          customer: { name, phone: normalizedPhone, email },
          priceOverridden: overrideLines.length > 0,
        },
      }).catch((err) => console.error('Failed to create manual order audit log:', err))

      if (overrideLines.length > 0) {
        await createAuditLog({
          userId: payload.userId,
          userRole: payload.role,
          action: 'MANUAL_ORDER_PRICE_OVERRIDDEN',
          entityType: 'ORDER',
          entityId: order.id,
          afterData: {
            orderId: order.id,
            overrides: overrideLines,
          },
        }).catch((err) => console.error('Failed to create price override audit log:', err))
      }

      return { kind: 'created', order, lines: resolvedLines } as TxResult
    })

    if (result.kind === 'replay') {
      return NextResponse.json({ order: buildOrderResponse(result.order) }, { status: 200 })
    }

    if (result.kind === 'conflict') {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    // A new sale changes the numbers of the money view, so the cached
    // summaries of this store are dropped instead of waiting out the minute.
    invalidateSalesSummaryCache(store.id)

    return NextResponse.json(
      {
        order: {
          ...buildOrderResponse(result.order),
          items: result.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPrice: line.unitPricePesewas / 100,
            overridden: line.overridden,
          })),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: error.message, products: error.products },
        { status: 409 }
      )
    }
    console.error('Error creating manual order:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
