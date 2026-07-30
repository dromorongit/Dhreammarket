import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const payload = token ? await verifyToken(token) : null

    const type = request.nextUrl.searchParams.get('type') || 'PRODUCTS_ALSO_BOUGHT'
    const entityId = request.nextUrl.searchParams.get('entityId')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')

    const recommendations: any[] = []

    if (type === 'PRODUCTS_ALSO_BOUGHT' && entityId) {
      const orderItems = await getPrisma().orderItem.findMany({
        where: { productId: entityId },
        select: { orderId: true },
        distinct: ['orderId'],
      })

      const orderIds = orderItems.map((oi) => oi.orderId)

      if (orderIds.length > 0) {
        const relatedItems = await getPrisma().orderItem.findMany({
          where: {
            orderId: { in: orderIds },
            productId: { not: entityId },
          },
          select: { productId: true },
        })

        const productCounts = new Map<string, number>()
        relatedItems.forEach((item) => {
          productCounts.set(item.productId, (productCounts.get(item.productId) || 0) + 1)
        })

        const topProducts = Array.from(productCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([productId]) => productId)

        const products = await getPrisma().product.findMany({
          where: { id: { in: topProducts } },
          include: {
            images: { take: 1 },
            store: { select: { name: true, slug: true } },
            category: { select: { name: true } },
          },
        })

        recommendations.push(...products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          salesPrice: p.salesPrice,
          dealsPrice: p.dealsPrice,
          image: p.images?.[0]?.url || null,
          store: p.store,
          category: p.category,
          reason: 'Frequently bought together',
          type: 'PRODUCT',
        })))
      }
    }

    if (type === 'SERVICES_ALSO_BOOKED' && entityId) {
      const serviceRequests = await getPrisma().serviceRequest.findMany({
        where: { serviceId: entityId },
        select: { id: true },
      })

      const requestIds = serviceRequests.map((sr) => sr.id)

      if (requestIds.length > 0) {
        const relatedRequests = await getPrisma().serviceRequest.findMany({
          where: {
            id: { in: requestIds },
            serviceId: { not: entityId },
          },
          select: { serviceId: true },
        })

        const serviceCounts = new Map<string, number>()
        relatedRequests.forEach((req) => {
          serviceCounts.set(req.serviceId, (serviceCounts.get(req.serviceId) || 0) + 1)
        })

        const topServices = Array.from(serviceCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([serviceId]) => serviceId)

        const services = await getPrisma().service.findMany({
          where: { id: { in: topServices } },
          include: {
            store: { select: { name: true, slug: true } },
            category: { select: { name: true } },
          },
        })

        recommendations.push(...services.map((s) => ({
          id: s.id,
          title: s.title,
          slug: s.slug,
          startingPrice: s.startingPrice,
          thumbnail: s.thumbnail,
          store: s.store,
          category: s.category,
          reason: 'Frequently booked together',
          type: 'SERVICE',
        })))
      }
    }

    if (type === 'RECOMMENDED_FOR_YOU' && payload) {
      const viewed = await getPrisma().recentlyViewed.findMany({
        where: { userId: payload.userId, entityType: 'PRODUCT' },
        select: { entityId: true },
        orderBy: { viewedAt: 'desc' },
        take: 10,
      })

      const viewedProductIds = viewed.map((v) => v.entityId)

      if (viewedProductIds.length > 0) {
        const products = await getPrisma().product.findMany({
          where: {
            id: { notIn: viewedProductIds },
            categoryId: {
              in: (await getPrisma().product.findMany({
                where: { id: { in: viewedProductIds } },
                select: { categoryId: true },
              })).map((p) => p.categoryId),
            },
          },
          include: {
            images: { take: 1 },
            store: { select: { name: true, slug: true } },
          },
          orderBy: { averageRating: 'desc' },
          take: limit,
        })

        recommendations.push(...products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          salesPrice: p.salesPrice,
          dealsPrice: p.dealsPrice,
          image: p.images?.[0]?.url || null,
          store: p.store,
          reason: 'Because you viewed',
          type: 'PRODUCT',
        })))
      }
    }

    if (type === 'SIMILAR_SERVICES' && entityId) {
      const service = await getPrisma().service.findUnique({
        where: { id: entityId },
        select: { categoryId: true },
      })

      if (service) {
        const similar = await getPrisma().service.findMany({
          where: {
            categoryId: service.categoryId,
            id: { not: entityId },
            status: 'PUBLISHED',
            isActive: true,
          },
          include: {
            store: { select: { name: true, slug: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        recommendations.push(...similar.map((s) => ({
          id: s.id,
          title: s.title,
          slug: s.slug,
          startingPrice: s.startingPrice,
          thumbnail: s.thumbnail,
          store: s.store,
          reason: 'Similar services',
          type: 'SERVICE',
        })))
      }
    }

    if (type === 'TRENDING' && payload) {
      const recent = await getPrisma().recentlyViewed.findMany({
        where: { userId: payload.userId },
        select: { entityType: true, entityId: true },
        orderBy: { viewedAt: 'desc' },
        take: 20,
      })

      const productViews = recent.filter((r) => r.entityType === 'PRODUCT').map((r) => r.entityId)
      const serviceViews = recent.filter((r) => r.entityType === 'SERVICE').map((r) => r.entityId)

      if (productViews.length > 0) {
        const trendingProducts = await getPrisma().product.findMany({
          where: { id: { in: productViews } },
          select: {
            id: true, name: true, slug: true, price: true,
            salesPrice: true, dealsPrice: true, averageRating: true,
            images: { take: 1 }, store: { select: { name: true } },
          },
          orderBy: { salesCount: 'desc' },
          take: Math.min(limit, 5),
        })

        recommendations.push(...trendingProducts.map((p) => ({
          ...p,
          reason: 'Trending in your views',
          type: 'PRODUCT',
        })))
      }

      if (serviceViews.length > 0) {
        const trendingServices = await getPrisma().service.findMany({
          where: { id: { in: serviceViews } },
          select: {
            id: true, title: true, slug: true, startingPrice: true,
            thumbnail: true, store: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 5),
        })

        recommendations.push(...trendingServices.map((s) => ({
          ...s,
          reason: 'Trending in your views',
          type: 'SERVICE',
        })))
      }
    }

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Error fetching recommendations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}