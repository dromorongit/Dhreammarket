import { getPrisma } from './prisma'
import { PrismaClient } from '@prisma/client'

export type DateRange = {
  from: Date
  to: Date
}

export type AnalyticsFilter = {
  range: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thismonth' | 'lastmonth' | 'thisyear' | 'custom'
  from?: Date
  to?: Date
}

function getDateRange(filter: AnalyticsFilter): DateRange {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filter.range) {
    case 'today':
      return { from: today, to: now }
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return { from: yesterday, to: today }
    }
    case 'last7days': {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { from: weekAgo, to: now }
    }
    case 'last30days': {
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { from: monthAgo, to: now }
    }
    case 'thismonth': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart, to: now }
    }
    case 'lastmonth': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: lastMonthStart, to: lastMonthEnd }
    }
    case 'thisyear': {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      return { from: yearStart, to: now }
    }
    case 'custom':
      if (!filter.from || !filter.to) {
        return { from: today, to: now }
      }
      return { from: filter.from, to: filter.to }
    default:
      return { from: today, to: now }
  }
}

export async function getSuperAdminAnalytics(filter: AnalyticsFilter) {
  const prisma = getPrisma()
  const { from, to } = getDateRange(filter)

  const [
    totalRevenue,
    todayRevenue,
    weeklyRevenue,
    monthlyRevenue,
    yearlyRevenue,
    totalOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    totalBookings,
    completedBookings,
    pendingBookings,
    vendorGrowth,
    customerGrowth,
    activeUsers,
    dailyActiveUsers,
    monthlyActiveUsers,
    conversionRate,
    averageOrderValue,
    repeatCustomerPercentage,
    productsSold,
    servicesBooked,
    topCategories,
    topProducts,
    topServices,
    topVendors,
    topBrands,
    mostViewedProducts,
    mostViewedServices,
    revenueByCategory,
    revenueByVendor,
    revenueByBrand,
    ordersOverTime,
    bookingsOverTime,
    customerGrowthOverTime,
    marketplaceActivity,
    monthlyComparison,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: { gte: from, lte: to },
        paymentStatus: 'PAID',
        deletedAt: null,
      },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date() },
        paymentStatus: 'PAID',
        deletedAt: null,
      },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), lte: new Date() },
        paymentStatus: 'PAID',
        deletedAt: null,
      },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), lte: new Date() },
        paymentStatus: 'PAID',
        deletedAt: null,
      },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), 0, 1), lte: new Date() },
        paymentStatus: 'PAID',
        deletedAt: null,
      },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: from, lte: to }, deletedAt: null },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: { in: ['COMPLETED', 'DELIVERED'] },
        deletedAt: null,
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'PENDING',
        deletedAt: null,
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'CANCELLED',
        deletedAt: null,
      },
    }),
    prisma.serviceRequest.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
    prisma.serviceRequest.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'COMPLETED',
      },
    }),
    prisma.serviceRequest.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: 'PENDING',
      },
    }),
    prisma.user.count({
      where: {
        role: 'VENDOR',
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.user.count({
      where: {
        role: 'CUSTOMER',
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.session.count({
      where: {
        lastActivity: { gte: from, lte: to },
        isExpired: false,
      },
    }),
    prisma.session.count({
      where: {
        lastActivity: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        isExpired: false,
      },
    }),
    prisma.session.count({
      where: {
        lastActivity: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        isExpired: false,
      },
    }),
    prisma.$queryRaw<Array<{ rate: number | null }>>`
      SELECT
        CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(DISTINCT "id") * 100.0 / NULLIF(COUNT(DISTINCT "userId"), 0), 2) ELSE 0 END as rate
      FROM "orders"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    `,
    prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT ROUND(AVG("total"), 2) as avg FROM "orders"
      WHERE "paymentStatus" = 'PAID' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
    `,
    prisma.$queryRaw<Array<{ pct: number | null }>>`
      SELECT ROUND(COUNT(DISTINCT "userId") * 100.0 / NULLIF((SELECT COUNT(DISTINCT "userId") FROM "orders" WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}), 0), 2) as pct
      FROM "orders"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      AND "userId" IN (
        SELECT "userId" FROM "orders"
        WHERE "createdAt" < ${from} AND "paymentStatus" = 'PAID'
      )
    `,
    prisma.orderItem.aggregate({
      where: {
        order: {
          createdAt: { gte: from, lte: to },
          paymentStatus: 'PAID',
          deletedAt: null,
        },
      },
      _sum: { quantity: true },
    }),
    prisma.serviceRequest.count({
      where: {
        createdAt: { gte: from, lte: to },
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
    }),
    prisma.$queryRaw<Array<{ name: string; revenue: number }>>`
      SELECT pc.name, COALESCE(SUM(oi."quantity" * oi."price"), 0) as revenue
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      JOIN "product_categories" pc ON p."categoryId" = pc."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY pc.name
      ORDER BY revenue DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; salesCount: number }>>`
      SELECT p.name, SUM(oi."quantity") as salesCount
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY p.name
      ORDER BY salesCount DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ title: string; count: number }>>`
      SELECT s.title, COUNT(sr.id) as count
      FROM "service_requests" sr
      JOIN "services" s ON sr."serviceId" = s."id"
      WHERE sr."createdAt" >= ${from} AND sr."createdAt" <= ${to}
      GROUP BY s.title
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; orderCount: number }>>`
      SELECT u.email as name, COUNT(o.id) as orderCount
      FROM "orders" o
      JOIN "users" u ON o."userId" = u."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND u."role" = 'VENDOR'
      GROUP BY u.email
      ORDER BY orderCount DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; revenue: number }>>`
      SELECT b.name, COALESCE(SUM(oi."quantity" * oi."price"), 0) as revenue
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      JOIN "brands" b ON p."brandId" = b."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY b.name
      ORDER BY revenue DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; views: number }>>`
      SELECT p.name, COALESCE(SUM(oi."quantity"), 0) as views
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY p.name
      ORDER BY views DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ title: string; count: number }>>`
      SELECT s.title, COUNT(sr.id) as count
      FROM "service_requests" sr
      JOIN "services" s ON sr."serviceId" = s."id"
      WHERE sr."createdAt" >= ${from} AND sr."createdAt" <= ${to}
      AND sr.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED')
      GROUP BY s.title
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; revenue: number }>>`
      SELECT pc.name, COALESCE(SUM(oi."quantity" * oi."price"), 0) as revenue
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      JOIN "product_categories" pc ON p."categoryId" = pc."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY pc.name
      ORDER BY revenue DESC
    `,
    prisma.$queryRaw<Array<{ email: string; revenue: number }>>`
      SELECT u.email, COALESCE(SUM(oi."quantity" * oi."price"), 0) as revenue
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "users" u ON o."userId" = u."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND u."role" = 'VENDOR'
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY u.email
      ORDER BY revenue DESC
    `,
    prisma.$queryRaw<Array<{ name: string; revenue: number }>>`
      SELECT b.name, COALESCE(SUM(oi."quantity" * oi."price"), 0) as revenue
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      JOIN "brands" b ON p."brandId" = b."id"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY b.name
      ORDER BY revenue DESC
    `,
    prisma.$queryRaw<Array<{ date: string; revenue: number }>>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COALESCE(SUM("total"), 0) as revenue
      FROM "orders"
      WHERE "paymentStatus" = 'PAID' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
      FROM "service_requests"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(DISTINCT "userId") as count
      FROM "orders"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw<Array<{ date: string; orders: number; bookings: number; revenue: number }>>`
      SELECT DATE_TRUNC('day', "createdAt") as date,
        COUNT(DISTINCT "id") as orders,
        0 as bookings,
        COALESCE(SUM("total"), 0) as revenue
      FROM "orders"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw<Array<{ month: string; revenue: number; orders: number; bookings: number }>>`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
        COALESCE(SUM("total"), 0) as revenue,
        COUNT(*) as orders,
        0 as bookings
      FROM "orders"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `,
  ])

  return {
    kpis: {
      totalRevenue: totalRevenue._sum.total || 0,
      todayRevenue: todayRevenue._sum.total || 0,
      weeklyRevenue: weeklyRevenue._sum.total || 0,
      monthlyRevenue: monthlyRevenue._sum.total || 0,
      yearlyRevenue: yearlyRevenue._sum.total || 0,
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      totalBookings,
      completedBookings,
      pendingBookings,
      vendorGrowth,
      customerGrowth,
      activeUsers,
      dailyActiveUsers,
      monthlyActiveUsers,
      conversionRate: conversionRate[0]?.rate || 0,
      averageOrderValue: averageOrderValue[0]?.avg || 0,
      repeatCustomerPercentage: repeatCustomerPercentage[0]?.pct || 0,
      productsSold: productsSold._sum.quantity || 0,
      servicesBooked,
    },
    rankings: {
      topCategories,
      topProducts,
      topServices,
      topVendors,
      topBrands,
      mostViewedProducts,
      mostViewedServices,
    },
    breakdowns: {
      revenueByCategory,
      revenueByVendor,
      revenueByBrand,
    },
    charts: {
      ordersOverTime,
      bookingsOverTime,
      customerGrowthOverTime,
      marketplaceActivity,
      monthlyComparison,
    },
  }
}

export async function getVendorAnalytics(vendorId: string, filter: AnalyticsFilter) {
  const prisma = getPrisma()
  const { from, to } = getDateRange(filter)

  const store = await prisma.store.findUnique({
    where: { userId: vendorId },
    select: { id: true },
  })

  if (!store) {
    throw new Error('Store not found')
  }

  const [
    revenue,
    orders,
    bookings,
    productsSold,
    servicesBooked,
    storeViews,
    productViews,
    serviceViews,
    conversionRate,
    averageRating,
    reviewGrowth,
    followers,
    repeatCustomers,
    returningClients,
    revenueTrend,
    bestSellingProducts,
    bestSellingServices,
    topCustomers,
    topCategories,
    viewsOverTime,
    salesOverTime,
  ] = await Promise.all([
    prisma.orderItem.aggregate({
      where: {
        product: { storeId: store.id },
        order: {
          createdAt: { gte: from, lte: to },
          paymentStatus: 'PAID',
          deletedAt: null,
        },
      },
      _sum: { grossAmount: true, netAmount: true, vendorEarnings: true },
      _count: { id: true },
    }),
    prisma.order.count({
      where: {
        items: { some: { product: { storeId: store.id } } },
        createdAt: { gte: from, lte: to },
        deletedAt: null,
      },
    }),
    prisma.serviceRequest.count({
      where: {
        vendorId: vendorId,
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.orderItem.aggregate({
      where: {
        product: { storeId: store.id },
        order: {
          createdAt: { gte: from, lte: to },
          paymentStatus: 'PAID',
          deletedAt: null,
        },
      },
      _sum: { quantity: true },
    }),
    prisma.serviceRequest.count({
      where: {
        vendorId: vendorId,
        createdAt: { gte: from, lte: to },
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "sessions"
      WHERE "lastActivity" >= ${from} AND "lastActivity" <= ${to}
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "recently_viewed" rv
      JOIN "products" p ON rv."entityId" = p."id"
      WHERE p."storeId" = ${store.id}
      AND rv."viewedAt" >= ${from} AND rv."viewedAt" <= ${to}
      AND rv."entityType" = 'PRODUCT'
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "recently_viewed" rv
      JOIN "services" s ON rv."entityId" = s."id"
      WHERE s."vendorId" = ${vendorId}
      AND rv."viewedAt" >= ${from} AND rv."viewedAt" <= ${to}
      AND rv."entityType" = 'SERVICE'
    `,
    prisma.$queryRaw<Array<{ rate: number | null }>>`
      SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(DISTINCT "orderId") * 100.0 / NULLIF(COUNT(DISTINCT "userId"), 0), 2) ELSE 0 END as rate
      FROM "orders" o
      JOIN "order_items" oi ON o."id" = oi."orderId"
      WHERE oi."productId" IN (SELECT "id" FROM "products" WHERE "storeId" = ${store.id})
      AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
    `,
    prisma.productReview.aggregate({
      where: {
        product: { storeId: store.id },
        createdAt: { gte: from, lte: to },
      },
      _avg: { rating: true },
    }),
    prisma.productReview.count({
      where: {
        product: { storeId: store.id },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.vendorFollow.count({ where: { vendorId: vendorId } }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT "userId") as count FROM "orders" o
      JOIN "order_items" oi ON o."id" = oi."orderId"
      WHERE oi."productId" IN (SELECT "id" FROM "products" WHERE "storeId" = ${store.id})
      AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."userId" IN (
        SELECT "userId" FROM "orders"
        WHERE "createdAt" < ${from}
        AND items @> (SELECT json_agg(json_build_object('productId', p."id")) FROM "order_items" p WHERE p."orderId" = "orders"."id")
      )
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT "userId") as count FROM "orders" o
      JOIN "order_items" oi ON o."id" = oi."orderId"
      WHERE oi."productId" IN (SELECT "id" FROM "products" WHERE "storeId" = ${store.id})
      AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
    `,
    prisma.$queryRaw<Array<{ date: string; revenue: number }>>`
      SELECT DATE_TRUNC('day', o."createdAt") as date, COALESCE(SUM(oi."grossAmount"), 0) as revenue
      FROM "orders" o
      JOIN "order_items" oi ON o."id" = oi."orderId"
      WHERE oi."productId" IN (SELECT "id" FROM "products" WHERE "storeId" = ${store.id})
      AND o."paymentStatus" = 'PAID' AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', o."createdAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw<Array<{ name: string; quantity: number; revenue: number }>>`
      SELECT p.name, SUM(oi."quantity") as quantity, SUM(oi."grossAmount") as revenue
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      WHERE p."storeId" = ${store.id}
      AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY p.name
      ORDER BY quantity DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ title: string; count: number; revenue: number }>>`
      SELECT s.title, COUNT(sr.id) as count, COALESCE(SUM(sr."quotedPrice"), 0) as revenue
      FROM "service_requests" sr
      JOIN "services" s ON sr."serviceId" = s."id"
      WHERE s."vendorId" = ${vendorId}
      AND sr."createdAt" >= ${from} AND sr."createdAt" <= ${to}
      GROUP BY s.title
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ email: string; count: number; revenue: number }>>`
      SELECT u.email, COUNT(DISTINCT o."id") as count, COALESCE(SUM(oi."grossAmount"), 0) as revenue
      FROM "orders" o
      JOIN "order_items" oi ON o."id" = oi."orderId"
      JOIN "users" u ON o."userId" = u."id"
      WHERE oi."productId" IN (SELECT "id" FROM "products" WHERE "storeId" = ${store.id})
      AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY u.email
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ name: string; revenue: number }>>`
      SELECT pc.name, COALESCE(SUM(oi."grossAmount"), 0) as revenue
      FROM "order_items" oi
      JOIN "orders" o ON oi."orderId" = o."id"
      JOIN "products" p ON oi."productId" = p."id"
      JOIN "product_categories" pc ON p."categoryId" = pc."id"
      WHERE p."storeId" = ${store.id}
      AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND o."paymentStatus" = 'PAID' AND o."deletedAt" IS NULL
      GROUP BY pc.name
      ORDER BY revenue DESC
    `,
    prisma.$queryRaw<Array<{ date: string; views: number }>>`
      SELECT DATE_TRUNC('day', "viewedAt") as date, COUNT(*) as views
      FROM "recently_viewed" rv
      JOIN "products" p ON rv."entityId" = p."id"
      WHERE p."storeId" = ${store.id}
      AND "viewedAt" >= ${from} AND "viewedAt" <= ${to}
      AND rv."entityType" = 'PRODUCT'
      GROUP BY DATE_TRUNC('day', "viewedAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw<Array<{ date: string; sales: number }>>`
      SELECT DATE_TRUNC('day', o."createdAt") as date, COUNT(*) as sales
      FROM "orders" o
      JOIN "order_items" oi ON o."id" = oi."orderId"
      WHERE oi."productId" IN (SELECT "id" FROM "products" WHERE "storeId" = ${store.id})
      AND o."paymentStatus" = 'PAID' AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', o."createdAt")
      ORDER BY date ASC
    `,
  ])

  return {
    kpis: {
      revenue: {
        gross: revenue._sum.grossAmount || 0,
        net: revenue._sum.netAmount || 0,
        earnings: revenue._sum.vendorEarnings || 0,
        orderCount: revenue._count.id,
      },
      orders,
      bookings,
      productsSold: productsSold._sum.quantity || 0,
      servicesBooked,
      storeViews: storeViews[0]?.count || 0,
      productViews: productViews[0]?.count || 0,
      serviceViews: serviceViews[0]?.count || 0,
      conversionRate: conversionRate[0]?.rate || 0,
      averageRating: averageRating._avg.rating || 0,
      reviewGrowth: reviewGrowth,
      followers,
      repeatCustomers: repeatCustomers[0]?.count || 0,
      returningClients: returningClients[0]?.count || 0,
    },
    rankings: {
      bestSellingProducts,
      bestSellingServices,
      topCustomers,
      topCategories,
    },
    charts: {
      revenueTrend,
      viewsOverTime,
      salesOverTime,
    },
  }
}

export async function exportAnalyticsData(
  dataType: string,
  filter: AnalyticsFilter,
  vendorId?: string
) {
  const prisma = getPrisma()
  const { from, to } = getDateRange(filter)

  switch (dataType) {
    case 'revenue':
      return prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "createdAt") as date,
          COUNT(*) as orders,
          SUM("total") as revenue,
          SUM("platformCommission") as commission,
          SUM("vendorEarnings") as vendorEarnings
        FROM "orders"
        WHERE "paymentStatus" = 'PAID'
          AND "createdAt" >= ${from} AND "createdAt" <= ${to}
          ${vendorId ? `AND "id" IN (SELECT "orderId" FROM "order_items" oi JOIN "products" p ON oi."productId" = p."id" WHERE p."storeId" IN (SELECT "id" FROM "stores" WHERE "userId" = ${vendorId}))` : ''}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date ASC
      `
    case 'orders':
      return prisma.$queryRaw`
        SELECT o."id", o."total", o."status", o."paymentStatus", o."createdAt",
          u."email" as customerEmail, u."role" as customerRole
        FROM "orders" o
        JOIN "users" u ON o."userId" = u."id"
        WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
          ${vendorId ? `AND o."id" IN (SELECT "orderId" FROM "order_items" oi JOIN "products" p ON oi."productId" = p."id" WHERE p."storeId" IN (SELECT "id" FROM "stores" WHERE "userId" = ${vendorId}))` : ''}
        ORDER BY o."createdAt" DESC
      `
    case 'bookings':
      return prisma.serviceRequest.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(vendorId ? { vendorId } : {}),
        },
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          status: true,
          quotedPrice: true,
          createdAt: true,
          service: { select: { title: true } },
          customer: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    case 'customers':
      return prisma.$queryRaw`
        SELECT DISTINCT u."id", u."email", u."role", u."createdAt",
          COUNT(DISTINCT o."id") as orderCount,
          SUM(o."total") as totalSpent
        FROM "users" u
        LEFT JOIN "orders" o ON u."id" = o."userId" AND o."paymentStatus" = 'PAID'
        WHERE u."createdAt" >= ${from} AND u."createdAt" <= ${to}
        GROUP BY u."id", u."email", u."role", u."createdAt"
        ORDER BY totalSpent DESC NULLS LAST
      `
    case 'vendors':
      return prisma.$queryRaw`
        SELECT u."id", u."email", s."name" as storeName, s."isVerified",
          COUNT(DISTINCT o."id") as orderCount,
          COALESCE(SUM(oi."grossAmount"), 0) as revenue
        FROM "users" u
        JOIN "stores" s ON u."id" = s."userId"
        LEFT JOIN "products" p ON s."id" = p."storeId"
        LEFT JOIN "order_items" oi ON p."id" = oi."productId"
        LEFT JOIN "orders" o ON oi."orderId" = o."id" AND o."paymentStatus" = 'PAID'
        WHERE u."role" = 'VENDOR'
          AND u."createdAt" >= ${from} AND u."createdAt" <= ${to}
        GROUP BY u."id", u."email", s."name", s."isVerified"
        ORDER BY revenue DESC NULLS LAST
      `
    case 'products':
      return prisma.$queryRaw`
        SELECT p."id", p."name", p."price", p."salesCount", p."averageRating",
          c."name" as category, b."name" as brand, s."name" as storeName
        FROM "products" p
        JOIN "product_categories" c ON p."categoryId" = c."id"
        LEFT JOIN "brands" b ON p."brandId" = b."id"
        JOIN "stores" s ON p."storeId" = s."id"
        WHERE p."createdAt" >= ${from} AND p."createdAt" <= ${to}
        ORDER BY p."salesCount" DESC
      `
    case 'services':
      return prisma.$queryRaw`
        SELECT s."id", s."title", s."startingPrice", s."status",
          sc."name" as category, u."email" as vendorEmail
        FROM "services" s
        JOIN "service_categories" sc ON s."categoryId" = sc."id"
        JOIN "users" u ON s."vendorId" = u."id"
        WHERE s."createdAt" >= ${from} AND s."createdAt" <= ${to}
        ORDER BY s."createdAt" DESC
      `
    default:
      return []
  }
}