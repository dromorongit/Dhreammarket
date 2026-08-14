import { getPrisma } from '@/lib/prisma'
import type { AIEngine, AIEngineConfig, RecommendationInput, RecommendationResult, TrendingInput, TrendingResult, SimilarInput, SimilarResult, CrossSellInput, CrossSellResult, CustomerInsightsInput, CustomerInsightsResult, VendorInsightsInput, VendorInsightsResult, RecommendationReason } from './types'
import { aiCache } from './cache'

function scoreByRecency(dateStr: string): number {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 1) return 1.0
  if (diffDays < 7) return 0.8
  if (diffDays < 30) return 0.5
  if (diffDays < 90) return 0.3
  return 0.1
}

function scoreByCount(count: number, maxCount: number): number {
  if (maxCount === 0) return 0
  return Math.min(count / maxCount, 1.0)
}

function scoreByRating(rating: number | null | undefined): number {
  if (rating == null) return 0.5
  return Math.min(rating / 5, 1.0)
}

function buildProductResult(p: any, reason: string, score: number): RecommendationResult {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    salesPrice: p.salesPrice,
    dealsPrice: p.dealsPrice,
    image: p.images?.[0]?.url ?? null,
    store: p.store ? { name: p.store.name, slug: p.store.slug } : null,
    category: p.category ? { name: p.category.name } : null,
    reason,
    type: 'PRODUCT',
    score,
    stock: p.stock,
    reservedQuantity: p.reservedQuantity,
  }
}

function buildServiceResult(s: any, reason: string, score: number): RecommendationResult {
  return {
    id: s.id,
    title: s.title,
    slug: s.slug,
    startingPrice: typeof s.startingPrice === 'number' ? s.startingPrice : parseFloat(String(s.startingPrice)),
    thumbnail: s.thumbnail ?? null,
    store: s.store ? { name: s.store.name, slug: s.store.slug } : null,
    category: s.category ? { name: s.category.name } : null,
    reason,
    type: 'SERVICE',
    score,
  }
}

function buildVendorResult(v: any, reason: string, score: number): RecommendationResult {
  return {
    id: v.id,
    name: v.store!.name || v.profile?.firstName + ' ' + v.profile?.lastName || 'Unknown Vendor',
    slug: v.store?.slug ?? v.id,
    image: v.store?.logo ?? null,
    store: v.store ? { name: v.store.name, slug: v.store.slug } : null,
    reason,
    type: 'VENDOR',
    score,
  }
}

export class RuleBasedEngine implements AIEngine {
  private prisma: ReturnType<typeof getPrisma>
  private cache: typeof aiCache

  constructor(config?: AIEngineConfig) {
    this.prisma = getPrisma()
    this.cache = aiCache
  }

  async getRecommendations(input: RecommendationInput): Promise<RecommendationResult[]> {
    const limit = input.limit ?? 10
    const excludeIds = new Set(input.excludeIds ?? [])

    if (input.userId && input.reasons?.includes('RECOMMENDED_FOR_YOU')) {
      return this.getRecommendedForYou(input.userId, limit, excludeIds)
    }

    if (input.entityId && input.entityType && input.reasons?.includes('SIMILAR_ITEMS')) {
      return this.getSimilarItems(input.entityId, input.entityType, limit, excludeIds)
    }

    if (input.entityId && input.entityType && input.reasons?.includes('FREQUENTLY_BOUGHT')) {
      return this.getFrequentlyBoughtHelper(input.entityId, input.entityType, limit, excludeIds)
    }

    if (input.userId) {
      return this.getPersonalizedRecommendations(input.userId, limit, excludeIds)
    }

    return this.getTrendingRecommendations(limit, excludeIds)
  }

  async getTrending(input: TrendingInput): Promise<TrendingResult[]> {
    const limit = input.limit ?? 10
    const timeWindow = input.timeWindow ?? '7D'
    const entityType = input.entityType ?? 'PRODUCT'

    const cacheParams = { entityType, timeWindow, limit }
    const cached = this.cache.get<TrendingResult[]>('trending', cacheParams)
    if (cached) return cached

    const results: TrendingResult[] = []

    if (entityType === 'PRODUCT') {
      const products = await this.prisma.product.findMany({
        where: {
          stock: { gt: 0 },
          OR: [
            { availabilityType: 'IN_STOCK' },
            { availabilityType: 'PREORDER' },
            { availabilityType: 'BACKORDER' },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          salesPrice: true,
          dealsPrice: true,
          stock: true,
          reservedQuantity: true,
          averageRating: true,
          salesCount: true,
          images: { take: 1 },
          category: { select: { name: true } },
          store: { select: { name: true, slug: true } },
          _count: {
            select: {
              orderItems: {
                where: {
                  order: { status: { in: ['COMPLETED', 'DELIVERED'] } },
                },
              },
              productReviews: true,
            },
          },
        },
        orderBy: { salesCount: 'desc' },
        take: 50,
      })

      const scored = products.map((p) => {
        const salesScore = scoreByCount(p._count?.orderItems ?? 0, 100)
        const reviewScore = scoreByRating(p.averageRating)
        const reviewCountScore = scoreByCount(p._count?.productReviews ?? 0, 50) * 0.3
        const trendScore = salesScore * 0.5 + reviewScore * 0.3 + reviewCountScore * 0.2

        let direction: 'rising' | 'falling' | 'stable' = 'stable'
        if (trendScore > 0.7) direction = 'rising'
        else if (trendScore < 0.3) direction = 'falling'

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          salesPrice: p.salesPrice,
          dealsPrice: p.dealsPrice,
          image: p.images?.[0]?.url ?? null,
          store: p.store ? { name: p.store.name, slug: p.store.slug } : null,
          category: p.category ? { name: p.category.name } : null,
          trendScore,
          trendDirection: direction,
          type: 'PRODUCT' as const,
        }
      })

      scored.sort((a, b) => b.trendScore - a.trendScore)
      results.push(...scored.slice(0, limit))
    }

    if (entityType === 'SERVICE') {
      const services = await this.prisma.service.findMany({
        where: {
          status: 'PUBLISHED',
          isActive: true,
          availabilityStatus: 'AVAILABLE',
        },
        include: {
          images: { take: 1 },
          category: { select: { name: true } },
          store: { select: { name: true, slug: true } },
          _count: { select: { serviceRequests: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      const scored = services.map((s) => {
        const requestCount = s._count?.serviceRequests ?? 0
        const trendScore = scoreByCount(requestCount, 50)

        let direction: 'rising' | 'falling' | 'stable' = 'stable'
        if (trendScore > 0.7) direction = 'rising'
        else if (trendScore < 0.3) direction = 'falling'

        return {
          id: s.id,
          title: s.title,
          slug: s.slug,
          startingPrice: typeof s.startingPrice === 'number' ? s.startingPrice : parseFloat(String(s.startingPrice)),
          thumbnail: s.thumbnail ?? null,
          store: s.store ? { name: s.store.name, slug: s.store.slug } : null,
          category: s.category ? { name: s.category.name } : null,
          trendScore,
          trendDirection: direction,
          type: 'SERVICE' as const,
        }
      })

      scored.sort((a, b) => b.trendScore - a.trendScore)
      results.push(...scored.slice(0, limit))
    }

    this.cache.set('trending', cacheParams, results)
    return results
  }

  async getSimilar(input: SimilarInput): Promise<SimilarResult[]> {
    const { entityId, entityType, limit = 10 } = input
    const excludeIds = new Set([entityId])

    const cacheParams = { entityType, entityId, limit }
    const cached = this.cache.get<SimilarResult[]>('similar', cacheParams)
    if (cached) return cached

    const results: SimilarResult[] = []

    if (entityType === 'PRODUCT') {
      const product = await this.prisma.product.findUnique({
        where: { id: entityId },
        select: { categoryId: true, brand: true, storeId: true },
      })

      if (product) {
        const similarByCategory = await this.prisma.product.findMany({
          where: {
            categoryId: product.categoryId,
            id: { notIn: [...Array.from(excludeIds), entityId] },
            stock: { gt: 0 },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            salesPrice: true,
            dealsPrice: true,
            stock: true,
            reservedQuantity: true,
            averageRating: true,
            salesCount: true,
            images: { take: 1 },
            store: { select: { name: true, slug: true } },
            category: { select: { name: true } },
          },
          orderBy: { averageRating: 'desc', salesCount: 'desc' },
          take: limit * 2,
        })

        for (const p of similarByCategory) {
          const score = scoreByRating(p.averageRating) * 0.6 + scoreByCount(p.salesCount ?? 0, 100) * 0.4
          results.push({
            ...buildProductResult(p, 'Similar products', score),
            reason: 'Similar products',
          })
        }
      }
    }

    if (entityType === 'SERVICE') {
      const service = await this.prisma.service.findUnique({
        where: { id: entityId },
        select: { categoryId: true },
      })

      if (service) {
        const similar = await this.prisma.service.findMany({
          where: {
            categoryId: service.categoryId,
            id: { not: entityId },
            status: 'PUBLISHED',
            isActive: true,
            availabilityStatus: 'AVAILABLE',
          },
          include: {
            store: { select: { name: true, slug: true } },
            category: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        for (const s of similar) {
          results.push(buildServiceResult(s, 'Similar services', 0.8))
        }
      }
    }

    if (entityType === 'VENDOR') {
      const vendor = await this.prisma.user.findUnique({
        where: { id: entityId },
        select: { store: { select: { categoryId: true } } },
      })

      if (vendor?.store?.categoryId) {
        const similarVendors = await this.prisma.user.findMany({
          where: {
            role: 'VENDOR',
            id: { not: entityId },
            store: { categoryId: vendor.store.categoryId, isVerified: true },
          },
          include: {
            store: { select: { name: true, slug: true, logo: true } },
            profile: true,
          },
          take: limit,
        })

        for (const v of similarVendors) {
          results.push(buildVendorResult(v, 'Similar vendors', 0.7))
        }
      }
    }

    this.cache.set('similar', cacheParams, results)
    return results.slice(0, limit)
  }

  async getFrequentlyBought(input: CrossSellInput): Promise<CrossSellResult[]> {
    const { entityId, entityType, limit = 10 } = input
    const excludeIds = new Set([entityId])

    const cacheParams = { entityType, entityId, limit }
    const cached = this.cache.get<CrossSellResult[]>('frequentlyBought', cacheParams)
    if (cached) return cached

    const results: CrossSellResult[] = []

    if (entityType === 'PRODUCT') {
      const orderItems = await this.prisma.orderItem.findMany({
        where: { productId: entityId },
        select: { orderId: true },
        distinct: ['orderId'],
      })

      const orderIds = orderItems.map((oi) => oi.orderId)

      if (orderIds.length > 0) {
        const relatedItems = await this.prisma.orderItem.findMany({
          where: {
            orderId: { in: orderIds },
            productId: { notIn: [...Array.from(excludeIds), entityId] },
          },
          select: { productId: true, quantity: true },
        })

        const productCounts = new Map<string, number>()
        relatedItems.forEach((item) => {
          productCounts.set(item.productId, (productCounts.get(item.productId) ?? 0) + item.quantity)
        })

        const topProducts = Array.from(productCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([productId]) => productId)

        const products = await this.prisma.product.findMany({
          where: { id: { in: topProducts } },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            salesPrice: true,
            dealsPrice: true,
            stock: true,
            reservedQuantity: true,
            images: { take: 1 },
            store: { select: { name: true, slug: true } },
            category: { select: { name: true } },
          },
        })

        for (const p of products) {
          const count = productCounts.get(p.id) ?? 0
          const score = scoreByCount(count, 20)
          results.push({
            ...buildProductResult(p, 'Frequently bought together', score),
            reason: 'Frequently bought together',
          })
        }
      }
    }

    if (entityType === 'SERVICE') {
      const serviceRequests = await this.prisma.serviceRequest.findMany({
        where: { serviceId: entityId },
        select: { id: true },
      })

      const requestIds = serviceRequests.map((sr) => sr.id)

      if (requestIds.length > 0) {
        const relatedRequests = await this.prisma.serviceRequest.findMany({
          where: {
            id: { in: requestIds },
            serviceId: { not: entityId },
          },
          select: { serviceId: true },
        })

        const serviceCounts = new Map<string, number>()
        relatedRequests.forEach((req) => {
          serviceCounts.set(req.serviceId, (serviceCounts.get(req.serviceId) ?? 0) + 1)
        })

        const topServices = Array.from(serviceCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([serviceId]) => serviceId)

        const services = await this.prisma.service.findMany({
          where: { id: { in: topServices } },
          include: {
            store: { select: { name: true, slug: true } },
            category: { select: { name: true } },
          },
        })

        for (const s of services) {
          const count = serviceCounts.get(s.id) ?? 0
          const score = scoreByCount(count, 20)
          results.push({
            ...buildServiceResult(s, 'Frequently booked together', score),
            reason: 'Frequently booked together',
          })
        }
      }
    }

    this.cache.set('frequentlyBought', cacheParams, results)
    return results.slice(0, limit)
  }

  async getCustomerInsights(input: CustomerInsightsInput): Promise<CustomerInsightsResult> {
    const { userId, limit = 10 } = input

    const cacheParams = { userId, limit }
    const cached = this.cache.get<CustomerInsightsResult>('customerInsights', cacheParams)
    if (cached) return cached

    const [recentlyViewed, orders, serviceRequests, wishlist, collections, searchHistory, vendorFollows] = await Promise.all([
      this.prisma.recentlyViewed.findMany({
        where: { userId },
        select: { entityType: true, entityId: true, viewedAt: true },
        orderBy: { viewedAt: 'desc' },
        take: 20,
      }),
      this.prisma.order.findMany({
        where: { userId },
        select: { id: true, createdAt: true, items: { select: { productId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.serviceRequest.findMany({
        where: { customerId: userId },
        select: { id: true, serviceId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.wishlist.findUnique({
        where: { userId },
        select: { items: { select: { productId: true, serviceId: true, createdAt: true } } },
      }),
      this.prisma.collection.findMany({
        where: { userId },
        select: { id: true, items: { select: { productId: true, serviceId: true } } },
      }),
      this.prisma.searchHistory.findMany({
        where: { userId },
        select: { query: true, searchedAt: true },
        orderBy: { searchedAt: 'desc' },
        take: 20,
      }),
      this.prisma.vendorFollow.findMany({
        where: { userId },
        select: { vendorId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const productViewCounts = new Map<string, number>()
    const serviceViewCounts = new Map<string, number>()
    const vendorViewCounts = new Map<string, number>()
    const categoryViewCounts = new Map<string, number>()
    const brandViewCounts = new Map<string, number>()

    for (const view of recentlyViewed) {
      if (view.entityType === 'PRODUCT') {
        productViewCounts.set(view.entityId, (productViewCounts.get(view.entityId) ?? 0) + 1)
      } else if (view.entityType === 'SERVICE') {
        serviceViewCounts.set(view.entityId, (serviceViewCounts.get(view.entityId) ?? 0) + 1)
      } else if (view.entityType === 'VENDOR') {
        vendorViewCounts.set(view.entityId, (vendorViewCounts.get(view.entityId) ?? 0) + 1)
      }
    }

    const productPurchaseCounts = new Map<string, number>()
    const serviceBookingCounts = new Map<string, number>()

    for (const order of orders) {
      for (const item of order.items) {
        productPurchaseCounts.set(item.productId, (productPurchaseCounts.get(item.productId) ?? 0) + 1)
      }
    }

    for (const req of serviceRequests) {
      serviceBookingCounts.set(req.serviceId, (serviceBookingCounts.get(req.serviceId) ?? 0) + 1)
    }

    const categoryInterests = new Map<string, number>()
    const brandInterests = new Map<string, number>()
    const vendorInterests = new Map<string, number>()

    for (const view of recentlyViewed) {
      if (view.entityType === 'PRODUCT') {
        const product = await this.prisma.product.findUnique({
          where: { id: view.entityId },
          select: { categoryId: true, brand: true, storeId: true },
        })
        if (product) {
          if (product.categoryId) categoryInterests.set(product.categoryId, (categoryInterests.get(product.categoryId) ?? 0) + 1)
          if (product.brand) brandInterests.set(product.brand, (brandInterests.get(product.brand) ?? 0) + 1)
          if (product.storeId) vendorInterests.set(product.storeId, (vendorInterests.get(product.storeId) ?? 0) + 1)
        }
      }
    }

    const shoppingPreferences: Array<{ category: string; type: 'PRODUCT' | 'SERVICE' | 'VENDOR' | 'BRAND' | 'CATEGORY'; items: Array<{ id: string; name: string; slug: string; count: number; lastInteractedAt: string }>; score: number }> = []
    for (const [productId, count] of Array.from(productViewCounts.entries())) {
      shoppingPreferences.push({
        category: 'PRODUCT',
        type: 'PRODUCT',
        items: [{ id: productId, name: '', slug: '', count, lastInteractedAt: recentlyViewed.find((v) => v.entityType === 'PRODUCT' && v.entityId === productId)?.viewedAt.toISOString() ?? '' }],
        score: scoreByCount(count, 20),
      })
    }

    const servicePreferences: Array<{ category: string; type: 'PRODUCT' | 'SERVICE' | 'VENDOR' | 'BRAND' | 'CATEGORY'; items: Array<{ id: string; name: string; slug: string; count: number; lastInteractedAt: string }>; score: number }> = []
    for (const [serviceId, count] of Array.from(serviceViewCounts.entries())) {
      servicePreferences.push({
        category: 'SERVICE',
        type: 'SERVICE',
        items: [{ id: serviceId, name: '', slug: '', count, lastInteractedAt: recentlyViewed.find((v) => v.entityType === 'SERVICE' && v.entityId === serviceId)?.viewedAt.toISOString() ?? '' }],
        score: scoreByCount(count, 20),
      })
    }

    const sortedCategoryInterests = Array.from(categoryInterests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([catId, count]) => ({
        category: catId,
        type: 'CATEGORY' as const,
        items: [{ id: catId, name: catId, slug: catId, count, lastInteractedAt: '' }],
        score: scoreByCount(count, 20),
      }))

    const sortedBrandInterests = Array.from(brandInterests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([brand, count]) => ({
        category: brand,
        type: 'BRAND' as const,
        items: [{ id: brand, name: brand, slug: brand, count, lastInteractedAt: '' }],
        score: scoreByCount(count, 20),
      }))

    const sortedVendorInterests = Array.from(vendorInterests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([vendorId, count]) => ({
        category: vendorId,
        type: 'VENDOR' as const,
        items: [{ id: vendorId, name: vendorId, slug: vendorId, count, lastInteractedAt: '' }],
        score: scoreByCount(count, 20),
      }))

    const result: CustomerInsightsResult = {
      shoppingPreferences,
      servicePreferences,
      categoryInterests: sortedCategoryInterests,
      brandInterests: sortedBrandInterests,
      vendorInterests: sortedVendorInterests,
      recentlyViewed: recentlyViewed.map((v) => ({ entityType: v.entityType, entityId: v.entityId, viewedAt: v.viewedAt.toISOString() })),
      recentlyPurchased: orders.map((o) => ({
        entityType: 'PRODUCT',
        entityId: o.items[0]?.productId ?? o.id,
        purchasedAt: o.createdAt.toISOString(),
      })),
      recentlyBooked: serviceRequests.map((sr) => ({
        entityType: 'SERVICE',
        entityId: sr.serviceId,
        bookedAt: sr.createdAt.toISOString(),
      })),
      mostClicked: recentlyViewed
        .filter((v) => v.entityType === 'PRODUCT')
        .reduce((acc: Array<{ entityType: string; entityId: string; clickCount: number }>, v) => {
          const existing = acc.find((a) => a.entityId === v.entityId)
          if (existing) existing.clickCount++
          else acc.push({ entityType: v.entityType, entityId: v.entityId, clickCount: 1 })
          return acc
        }, [])
        .sort((a, b) => b.clickCount - a.clickCount)
        .slice(0, limit),
    }

    this.cache.set('customerInsights', cacheParams, result)
    return result
  }

  async getVendorInsights(input: VendorInsightsInput): Promise<VendorInsightsResult> {
    const { vendorId, userId } = input

    const cacheParams = { vendorId, userId }
    const cached = this.cache.get<VendorInsightsResult>('vendorInsights', cacheParams)
    if (cached) return cached

    const result: VendorInsightsResult = {
      suggestedProductsToAdd: [],
      suggestedServicesToOffer: [],
      lowPerformingProducts: [],
      highPerformingProducts: [],
      suggestedPriceImprovements: [],
      suggestedInventoryRestock: [],
    }

    const products = await this.prisma.product.findMany({
      where: { storeId: vendorId },
      include: {
        images: { take: 1 },
        category: { select: { name: true } },
        store: { select: { name: true, slug: true } },
        _count: { select: { orderItems: true, productReviews: true } },
      },
    })

    const services = await this.prisma.service.findMany({
      where: { vendorId },
      include: {
        images: { take: 1 },
        category: { select: { name: true } },
        store: { select: { name: true, slug: true } },
        _count: { select: { serviceRequests: true } },
      },
    })

    const avgSales = products.length > 0 ? products.reduce((sum, p) => sum + (p.salesCount ?? 0), 0) / products.length : 0
    const avgRating = products.length > 0 ? products.reduce((sum, p) => sum + (p.averageRating ?? 0), 0) / products.length : 0

    for (const p of products) {
      const salesScore = scoreByCount(p.salesCount ?? 0, Math.max(avgSales * 2, 1))
      const ratingScore = scoreByRating(p.averageRating)
      const reviewScore = scoreByCount(p._count?.productReviews ?? 0, 10) * 0.2
      const overallScore = salesScore * 0.5 + ratingScore * 0.3 + reviewScore * 0.2

      if (overallScore > 0.7) {
        result.highPerformingProducts.push({
          type: 'HIGH_PERFORMING',
          items: [{
            id: p.id,
            name: p.name,
            slug: p.slug,
            score: overallScore,
            reason: `High performer: ${p.salesCount ?? 0} sales, ${p.averageRating ?? 0} rating`,
          }],
        })
      } else if (overallScore < 0.3 && p.salesCount !== undefined && p.salesCount < (avgSales * 0.2)) {
        result.lowPerformingProducts.push({
          type: 'LOW_PERFORMING',
          items: [{
            id: p.id,
            name: p.name,
            slug: p.slug,
            score: overallScore,
            reason: `Low performer: ${p.salesCount ?? 0} sales`,
          }],
        })
      }

      if (p.price > 0 && p.averageRating != null && p.averageRating > 3.5 && p.salesCount !== undefined && p.salesCount < avgSales * 0.3) {
        result.suggestedPriceImprovements.push({
          type: 'PRICE_IMPROVEMENT',
          items: [{
            id: p.id,
            name: p.name,
            slug: p.slug,
            score: 0.5,
            reason: `Good rating (${p.averageRating}) but low sales - consider pricing adjustment`,
          }],
        })
      }

      if (p.stock < 10 && p.availabilityType === 'IN_STOCK') {
        result.suggestedInventoryRestock.push({
          type: 'INVENTORY_RESTOCK',
          items: [{
            id: p.id,
            name: p.name,
            slug: p.slug,
            score: 0.8,
            reason: `Low stock: ${p.stock} units remaining`,
          }],
        })
      }
    }

    for (const s of services) {
      const requestCount = s._count?.serviceRequests ?? 0
      const serviceScore = scoreByCount(requestCount, 20)

      if (serviceScore > 0.7) {
        result.highPerformingProducts.push({
          type: 'HIGH_PERFORMING',
          items: [{
            id: s.id,
            name: s.title,
            slug: s.slug,
            score: serviceScore,
            reason: `High performer: ${requestCount} bookings`,
          }],
        })
      } else if (serviceScore < 0.2 && requestCount === 0) {
        result.lowPerformingProducts.push({
          type: 'LOW_PERFORMING',
          items: [{
            id: s.id,
            name: s.title,
            slug: s.slug,
            score: serviceScore,
            reason: 'No bookings yet - consider improving description or pricing',
          }],
        })
      }
    }

    const trendingProducts = await this.prisma.product.findMany({
      where: {
        stock: { gt: 0 },
        categoryId: { in: products.map((p) => p.categoryId).filter(Boolean) },
        id: { notIn: products.map((p) => p.id) },
      },
      select: { id: true, name: true, slug: true, categoryId: true },
      take: 10,
    })

    const trendingCategories = new Set(trendingProducts.map((p) => p.categoryId).filter(Boolean))
    for (const catId of Array.from(trendingCategories)) {
      const catProducts = products.filter((p) => p.categoryId === catId)
      if (catProducts.length === 0) {
        result.suggestedProductsToAdd.push({
          type: 'SUGGESTED_PRODUCT',
          items: [{
            id: catId ?? '',
            name: `Products in category ${catId}`,
            slug: catId ?? '',
            score: 0.6,
            reason: `Trending category with no products from your store`,
          }],
        })
      }
    }

    this.cache.set('vendorInsights', cacheParams, result)
    return result
  }

  private async getRecommendedForYou(userId: string, limit: number, excludeIds: Set<string>): Promise<RecommendationResult[]> {
    const results: RecommendationResult[] = []

    const viewed = await this.prisma.recentlyViewed.findMany({
      where: { userId, entityType: 'PRODUCT' },
      select: { entityId: true },
      orderBy: { viewedAt: 'desc' },
      take: 10,
    })

    const viewedProductIds = viewed.map((v) => v.entityId)
    const viewedProductCategoryIds = new Set<string>()

    if (viewedProductIds.length > 0) {
      const viewedProducts = await this.prisma.product.findMany({
        where: { id: { in: viewedProductIds } },
        select: { id: true, categoryId: true },
      })
      for (const p of viewedProducts) {
        if (p.categoryId) viewedProductCategoryIds.add(p.categoryId)
      }
    }

    if (viewedProductCategoryIds.size > 0) {
      const categoryRecs = await this.prisma.product.findMany({
        where: {
          id: { notIn: [...Array.from(excludeIds), ...viewedProductIds] },
          categoryId: { in: [...Array.from(viewedProductCategoryIds)] },
          stock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          salesPrice: true,
          dealsPrice: true,
          stock: true,
          reservedQuantity: true,
          images: { take: 1 },
          store: { select: { name: true, slug: true } },
          category: { select: { name: true } },
        },
        orderBy: { averageRating: 'desc', salesCount: 'desc' },
        take: limit,
      })

      for (const p of categoryRecs) {
        results.push(buildProductResult(p, 'Because you viewed', 0.7))
      }
    }

    const purchasedOrders = await this.prisma.order.findMany({
      where: { userId },
      select: { items: { select: { productId: true } } },
      take: 10,
    })

    const purchasedProductIds = new Set<string>()
    for (const order of purchasedOrders) {
      for (const item of order.items) {
        purchasedProductIds.add(item.productId)
      }
    }

    if (purchasedProductIds.size > 0) {
      const purchasedProducts = await this.prisma.product.findMany({
        where: {
          id: { in: [...Array.from(purchasedProductIds)], notIn: [...Array.from(excludeIds), ...viewedProductIds] },
          categoryId: { in: [...Array.from(viewedProductCategoryIds)] },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          salesPrice: true,
          dealsPrice: true,
          stock: true,
          reservedQuantity: true,
          images: { take: 1 },
          store: { select: { name: true, slug: true } },
          category: { select: { name: true } },
        },
        orderBy: { averageRating: 'desc' },
        take: limit,
      })

      for (const p of purchasedProducts) {
        results.push(buildProductResult(p, 'Because you purchased', 0.8))
      }
    }

    const followedVendors = await this.prisma.vendorFollow.findMany({
      where: { userId },
      select: { vendorId: true },
      take: 5,
    })

    for (const follow of followedVendors) {
      const vendorProducts = await this.prisma.product.findMany({
        where: {
          storeId: follow.vendorId,
          id: { notIn: [...Array.from(excludeIds), ...viewedProductIds] },
          stock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          salesPrice: true,
          dealsPrice: true,
          stock: true,
          reservedQuantity: true,
          images: { take: 1 },
          store: { select: { name: true, slug: true } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })

      for (const p of vendorProducts) {
        results.push(buildProductResult(p, 'From vendors you follow', 0.6))
      }
    }

    return results.slice(0, limit)
  }

  private async getSimilarItems(entityId: string, entityType: string, limit: number, excludeIds: Set<string>): Promise<RecommendationResult[]> {
    return this.getSimilar({ entityId, entityType: entityType as any, limit })
  }

  private async getFrequentlyBoughtHelper(entityId: string, entityType: string, limit: number, excludeIds: Set<string>): Promise<RecommendationResult[]> {
    return this.getFrequentlyBought({ entityId, entityType: entityType as any, limit })
  }

  private async getPersonalizedRecommendations(userId: string, limit: number, excludeIds: Set<string>): Promise<RecommendationResult[]> {
    return this.getRecommendedForYou(userId, limit, excludeIds)
  }

  private async getTrendingRecommendations(limit: number, excludeIds: Set<string>): Promise<RecommendationResult[]> {
    const trending = await this.getTrending({ limit, entityType: 'PRODUCT' })
    return trending.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      price: t.price,
      salesPrice: t.salesPrice,
      dealsPrice: t.dealsPrice,
      image: t.image,
      store: t.store,
      category: t.category,
      reason: 'Trending now',
      type: 'PRODUCT' as const,
      score: t.trendScore,
      stock: t.stock,
      reservedQuantity: t.reservedQuantity,
    }))
  }
}

let globalEngine: RuleBasedEngine | null = null

export function getAIEngine(config?: AIEngineConfig): RuleBasedEngine {
  if (!globalEngine) {
    globalEngine = new RuleBasedEngine(config)
  }
  return globalEngine
}

export function resetAIEngine(): void {
  globalEngine = null
}