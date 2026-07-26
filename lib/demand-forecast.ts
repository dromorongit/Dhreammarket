import { getPrisma } from '@/lib/prisma'
import { ProductAvailabilityType } from '@prisma/client'

export interface DemandMetrics {
  productId: string
  productName: string
  currentStock: number
  reservedQuantity: number
  availableStock: number
  lowStockThreshold: number
  isLowStock: boolean
  isOutOfStock: boolean
  preorderDemand: number
  backorderDemand: number
  orderCount: number
  salesVelocity: number
  avgDailySales: number
  stockoutDate: Date | null
  recommendedRestock: number
  daysUntilStockout: number | null
}

export interface VendorDemandAnalytics {
  mostRequested: Array<{ productId: string; productName: string; totalDemand: number }>
  lowStockProducts: Array<{ productId: string; productName: string; availableStock: number; threshold: number }>
  outOfStockProducts: Array<{ productId: string; productName: string; availableStock: number }>
  recommendedRestocks: Array<{ productId: string; productName: string; recommendedQuantity: number; daysUntilStockout: number | null }>
  demandRankings: Array<{ productId: string; productName: string; totalDemand: number; avgDailySales: number }>
}

export interface AdminDemandAnalytics {
  mostPreorderedProducts: Array<{ productId: string; productName: string; preorderCount: number }>
  mostBackorderedProducts: Array<{ productId: string; productName: string; backorderCount: number }>
  topDemandCategories: Array<{ categoryId: string; categoryName: string; demandCount: number }>
  topDemandVendors: Array<{ vendorId: string; vendorName: string; demandCount: number }>
  stockoutFrequency: Array<{ productId: string; productName: string; stockoutCount: number }>
}

export async function getAvailableStock(productId: string): Promise<{
  availableStock: number
  reservedQuantity: number
  stock: number
}> {
  const prisma = getPrisma()
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, reservedQuantity: true },
  })

  if (!product) {
    return { availableStock: 0, reservedQuantity: 0, stock: 0 }
  }

  return {
    stock: product.stock,
    reservedQuantity: product.reservedQuantity,
    availableStock: product.stock - product.reservedQuantity,
  }
}

export async function getProductDemandMetrics(productId: string): Promise<DemandMetrics | null> {
  const prisma = getPrisma()

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      stock: true,
      reservedQuantity: true,
      lowStockThreshold: true,
    },
  })

  if (!product) {
    return null
  }

  const availableStock = product.stock - product.reservedQuantity
  const threshold = product.lowStockThreshold ?? 5

  const [preorderOrders, backorderOrders, recentOrders] = await Promise.all([
    prisma.order.count({
      where: {
        orderType: 'PREORDER',
        paymentStatus: 'PAID',
        items: { some: { productId } },
      },
    }),
    prisma.order.count({
      where: {
        orderType: 'BACKORDER',
        paymentStatus: 'PAID',
        items: { some: { productId } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          paymentStatus: 'PAID',
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      select: { quantity: true, createdAt: true },
    }),
  ])

  const orderCount = recentOrders.reduce((sum, item) => sum + item.quantity, 0)

  const totalDays = 30
  const avgDailySales = orderCount / totalDays

  const isLowStock = availableStock <= threshold
  const isOutOfStock = availableStock === 0

  let stockoutDate: Date | null = null
  let daysUntilStockout: number | null = null
  let recommendedRestock = 0

  if (avgDailySales > 0 && availableStock > 0) {
    daysUntilStockout = Math.floor(availableStock / avgDailySales)
    stockoutDate = new Date()
    stockoutDate.setDate(stockoutDate.getDate() + daysUntilStockout)

    recommendedRestock = Math.ceil(avgDailySales * 30)
  }

  return {
    productId: product.id,
    productName: product.name,
    currentStock: product.stock,
    reservedQuantity: product.reservedQuantity,
    availableStock,
    lowStockThreshold: threshold,
    isLowStock,
    isOutOfStock,
    preorderDemand: preorderOrders,
    backorderDemand: backorderOrders,
    orderCount,
    salesVelocity: orderCount,
    avgDailySales,
    stockoutDate,
    recommendedRestock,
    daysUntilStockout,
  }
}

export async function getVendorDemandAnalytics(vendorId: string): Promise<VendorDemandAnalytics> {
  const prisma = getPrisma()

  const store = await prisma.store.findUnique({
    where: { userId: vendorId },
    include: {
      products: {
        select: { id: true, name: true, stock: true, reservedQuantity: true, lowStockThreshold: true },
      },
    },
  })

  if (!store || store.products.length === 0) {
    return {
      mostRequested: [],
      lowStockProducts: [],
      outOfStockProducts: [],
      recommendedRestocks: [],
      demandRankings: [],
    }
  }

  const productIds = store.products.map((p) => p.id)

  const [preorderCounts, backorderCounts, completedOrderCounts, recentSales] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: { orderType: 'PREORDER', paymentStatus: 'PAID' },
      },
      _sum: { quantity: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: { orderType: 'BACKORDER', paymentStatus: 'PAID' },
      },
      _sum: { quantity: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: { paymentStatus: 'PAID', status: { in: ['COMPLETED', 'DELIVERED'] } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
    prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: {
          paymentStatus: 'PAID',
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      select: { productId: true, quantity: true },
    }),
  ])

  const productMap = new Map(store.products.map((p) => [p.id, p]))

  const demandByProduct = new Map<string, { preorder: number; backorder: number; sales: number }>()
  for (const p of store.products) {
    demandByProduct.set(p.id, { preorder: 0, backorder: 0, sales: 0 })
  }

  for (const item of preorderCounts) {
    const existing = demandByProduct.get(item.productId)
    if (existing) existing.preorder = item._sum.quantity || 0
  }

  for (const item of backorderCounts) {
    const existing = demandByProduct.get(item.productId)
    if (existing) existing.backorder = item._sum.quantity || 0
  }

  for (const item of recentSales) {
    const existing = demandByProduct.get(item.productId)
    if (existing) existing.sales = (existing.sales || 0) + item.quantity
  }

  const mostRequested = Array.from(demandByProduct.entries())
    .map(([productId, demand]) => ({
      productId,
      productName: productMap.get(productId)?.name || 'Unknown',
      totalDemand: (demand.preorder || 0) + (demand.backorder || 0),
    }))
    .sort((a, b) => b.totalDemand - a.totalDemand)
    .slice(0, 10)

  const lowStockProducts = store.products
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      availableStock: p.stock - p.reservedQuantity,
      threshold: p.lowStockThreshold ?? 5,
    }))
    .filter((p) => p.availableStock <= p.threshold && p.availableStock > 0)
    .sort((a, b) => a.availableStock - b.availableStock)

  const outOfStockProducts = store.products
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      availableStock: p.stock - p.reservedQuantity,
    }))
    .filter((p) => p.availableStock === 0)

  const lowStockProductIds = lowStockProducts.map((p) => p.productId)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const lowStockSales = lowStockProductIds.length > 0
    ? await prisma.orderItem.findMany({
        where: {
          productId: { in: lowStockProductIds },
          order: {
            paymentStatus: 'PAID',
            createdAt: { gte: thirtyDaysAgo },
          },
        },
        select: { productId: true, quantity: true },
      })
    : []

  const salesByProduct = new Map<string, number>()
  for (const item of lowStockSales) {
    salesByProduct.set(item.productId, (salesByProduct.get(item.productId) || 0) + item.quantity)
  }

  const recommendedRestocks = lowStockProducts.map((p) => {
    const availableStock = p.availableStock
    const threshold = p.threshold
    const orderCount = salesByProduct.get(p.productId) || 0
    const avgDailySales = orderCount / 30

    let recommendedQuantity = 0
    let daysUntilStockout: number | null = null

    if (avgDailySales > 0 && availableStock > 0) {
      daysUntilStockout = Math.floor(availableStock / avgDailySales)
      recommendedQuantity = Math.ceil(avgDailySales * 30)
    }

    return {
      productId: p.productId,
      productName: p.productName,
      recommendedQuantity,
      daysUntilStockout,
    }
  })

  const demandRankings = Array.from(demandByProduct.entries())
    .map(([productId, demand]) => ({
      productId,
      productName: productMap.get(productId)?.name || 'Unknown',
      totalDemand: (demand.preorder || 0) + (demand.backorder || 0),
      avgDailySales: demand.sales / 30,
    }))
    .sort((a, b) => b.totalDemand - a.totalDemand)
    .slice(0, 10)

  return {
    mostRequested,
    lowStockProducts,
    outOfStockProducts,
    recommendedRestocks,
    demandRankings,
  }
}

export async function getAdminDemandAnalytics(): Promise<AdminDemandAnalytics> {
  const prisma = getPrisma()

  const [mostPreordered, mostBackordered, categoryDemand] = (await Promise.all([
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { orderType: 'PREORDER', paymentStatus: 'PAID' },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { orderType: 'BACKORDER', paymentStatus: 'PAID' },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { paymentStatus: 'PAID' },
      },
      _sum: { quantity: true },
    }),
  ])) as any[]

  const productIds = Array.from(new Set([
    ...mostPreordered.map((p: any) => p.productId),
    ...mostBackordered.map((p: any) => p.productId),
    ...categoryDemand.map((c: any) => c.productId),
  ]))

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, categoryId: true, storeId: true },
  })

  const storeIds = Array.from(new Set(products.map((p) => p.storeId).filter(Boolean))) as string[]
  const stores = await prisma.store.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, name: true },
  })

  const productMap = new Map(products.map((p) => [p.id, p]))
  const storeMap = new Map(stores.map((s) => [s.id, s.name]))

  const mostPreorderedProducts = mostPreordered.map((item: any) => ({
    productId: item.productId,
    productName: productMap.get(item.productId)?.name || 'Unknown',
    preorderCount: item._sum.quantity || 0,
  }))

  const mostBackorderedProducts = mostBackordered.map((item: any) => ({
    productId: item.productId,
    productName: productMap.get(item.productId)?.name || 'Unknown',
    backorderCount: item._sum.quantity || 0,
  }))

  const categoryMap = new Map<string, number>()
  const vendorDemandMap = new Map<string, number>()
  for (const item of categoryDemand) {
    const product = productMap.get(item.productId)
    const qty = item._sum.quantity || 0
    if (product?.categoryId) {
      categoryMap.set(product.categoryId, (categoryMap.get(product.categoryId) || 0) + qty)
    }
    if (product?.storeId) {
      const vendorName = storeMap.get(product.storeId)
      if (vendorName) {
        vendorDemandMap.set(vendorName, (vendorDemandMap.get(vendorName) || 0) + qty)
      }
    }
  }

  const categories = await prisma.productCategory.findMany({
    where: { id: { in: Array.from(categoryMap.keys()) } },
    select: { id: true, name: true },
  })

  const topDemandCategories = categories.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    demandCount: categoryMap.get(cat.id) || 0,
  }))

  const topDemandVendors = Array.from(vendorDemandMap.entries())
    .map(([vendorName, demandCount]) => ({ vendorId: vendorName.toLowerCase().replace(/\s+/g, '-'), vendorName, demandCount }))
    .sort((a, b) => b.demandCount - a.demandCount)
    .slice(0, 10)

  const stockoutFrequencyResult = await prisma.$queryRaw<Array<{
    product_id: string
    product_name: string
  }>>`
    SELECT p.id as product_id, p.name as product_name
    FROM "products" p
    WHERE p."stock" - p."reservedQuantity" <= 0
  `

  return {
    mostPreorderedProducts,
    mostBackorderedProducts,
    topDemandCategories,
    topDemandVendors,
    stockoutFrequency: stockoutFrequencyResult.map((p) => ({
      productId: p.product_id,
      productName: p.product_name,
      stockoutCount: 1,
    })),
  }
}

export async function getWaitingCustomerCount(
  productId: string,
  availabilityType: ProductAvailabilityType
): Promise<number> {
  const prisma = getPrisma()

  if (availabilityType === 'PREORDER') {
    return await prisma.order.count({
      where: {
        orderType: 'PREORDER',
        paymentStatus: 'PAID',
        status: { in: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        items: { some: { productId } },
      },
    })
  }

  if (availabilityType === 'BACKORDER') {
    return await prisma.order.count({
      where: {
        orderType: 'BACKORDER',
        paymentStatus: 'PAID',
        status: { in: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        items: { some: { productId } },
      },
    })
  }

  return 0
}

export async function trackProductView(productId: string): Promise<void> {
  const prisma = getPrisma()

  await prisma.product.update({
    where: { id: productId },
    data: { updatedAt: new Date() },
  }).catch((err) => {
    console.error('trackProductView error:', err)
  })
}

export function getStockStatus(stock: number, threshold: number): {
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  label: string
  variant: 'success' | 'warning' | 'danger'
} {
  const availableStock = stock

  if (availableStock === 0) {
    return { status: 'out_of_stock', label: 'Out of Stock', variant: 'danger' }
  }

  if (availableStock <= threshold) {
    return { status: 'low_stock', label: 'Low Stock', variant: 'warning' }
  }

  return { status: 'in_stock', label: 'In Stock', variant: 'success' }
}