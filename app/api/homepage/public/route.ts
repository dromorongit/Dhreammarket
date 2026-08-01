import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { ensureDefaultHomepageSections } from '@/lib/homepage-default-sections'
import { checkAndUpdateExpiredPreOrders } from '@/lib/product-availability'
import { PerformanceLogger } from '@/lib/performance'
import type { ContentSource } from '@/lib/homepage-constants'

export const revalidate = 60

interface TrendingWeights {
  recentSales: number
  productViews: number
  wishlistAdds: number
  cartAdds: number
  recentReviews: number
  averageRating: number
}

const DEFAULT_WEIGHTS: TrendingWeights = {
  recentSales: 40,
  productViews: 20,
  wishlistAdds: 15,
  cartAdds: 15,
  recentReviews: 5,
  averageRating: 5,
}

interface AutoRankSettings {
  mode: 'MANUAL' | 'AUTOMATIC' | 'HYBRID'
  maxProducts?: number
  maxServices?: number
  maxVendors?: number
  weights?: TrendingWeights
  timeWindow?: '24H' | '7D' | '30D'
  excludeOutOfStock?: boolean
  excludeHiddenProducts?: boolean
  excludeArchivedProducts?: boolean
  serviceIds?: string[]
}

const DEFAULT_AUTO_RANK_SETTINGS: AutoRankSettings = {
  mode: 'MANUAL',
  maxProducts: 20,
  maxServices: 20,
  maxVendors: 10,
  weights: { ...DEFAULT_WEIGHTS },
  timeWindow: '7D',
  excludeOutOfStock: true,
  excludeHiddenProducts: true,
  excludeArchivedProducts: true,
}

async function getAutoRankedProducts(prisma: ReturnType<typeof getPrisma>, settings: AutoRankSettings): Promise<any[]> {
  const now = new Date()
  const timeWindowMap: Record<string, number> = {
    '24H': 24 * 60 * 60 * 1000,
    '7D': 7 * 24 * 60 * 60 * 1000,
    '30D': 30 * 24 * 60 * 60 * 1000,
  }
  const cutoffDate = new Date(now.getTime() - (timeWindowMap[settings.timeWindow || '7D'] || timeWindowMap['7D']))

  const products = await prisma.product.findMany({
    where: {
      stock: { gt: 0 },
      OR: [
        { availabilityType: 'IN_STOCK' },
        { availabilityType: 'PREORDER' },
        { availabilityType: 'BACKORDER' },
      ],
    },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true } },
      _count: {
        select: {
          productReviews: true,
          orderItems: {
            where: {
              order: {
                createdAt: { gte: cutoffDate },
                status: { in: ['COMPLETED', 'DELIVERED'] },
              },
            },
          },
        },
      },
    },
    take: 100,
  })

  const expiredIds = new Set(
    products
      .filter((p) => p.availabilityType === 'PREORDER' && p.expectedArrivalDate && new Date(p.expectedArrivalDate) < now)
      .map((p) => p.id)
  )

  if (expiredIds.size > 0) {
    void checkAndUpdateExpiredPreOrders(Array.from(expiredIds))
  }

  return products
    .map((product) => {
      const salesScore = (product._count?.orderItems ?? 0) * (settings.weights?.recentSales || DEFAULT_WEIGHTS.recentSales)
      const reviewScore = (product.averageRating ?? 0) * (settings.weights?.averageRating || DEFAULT_WEIGHTS.averageRating)
      const reviewCountScore = (product._count?.productReviews ?? 0) * (settings.weights?.recentReviews || DEFAULT_WEIGHTS.recentReviews) * 0.1

      if (expiredIds.has(product.id) && product.availabilityType === 'PREORDER') {
        return {
          ...product,
          trendingScore: salesScore + reviewScore + reviewCountScore,
          availabilityType: 'IN_STOCK',
          expectedArrivalDate: null,
        }
      }

      return {
        ...product,
        trendingScore: salesScore + reviewScore + reviewCountScore,
      }
    })
    .sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0))
    .slice(0, settings.maxProducts || 20)
}

async function getAutoRankedServices(prisma: ReturnType<typeof getPrisma>, maxServices: number): Promise<any[]> {
  const services = await prisma.service.findMany({
    where: {
      status: 'PUBLISHED',
      isActive: true,
      availabilityStatus: 'AVAILABLE',
    },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true, logo: true, averageRating: true, reviewCount: true } },
      _count: { select: { serviceRequests: true } },
    },
    orderBy: [{ serviceRequests: { _count: 'desc' } }, { createdAt: 'desc' }],
    take: maxServices || 20,
  })

  return services.map((service) => ({
    id: service.id,
    slug: service.slug,
    title: service.title,
    shortDescription: service.shortDescription,
    startingPrice: service.startingPrice,
    pricingType: service.pricingType,
    deliveryType: service.deliveryType,
    availabilityStatus: service.availabilityStatus,
    status: service.status,
    thumbnail: service.thumbnail,
    gallery: service.gallery,
    category: service.category,
    store: service.store,
    images: service.images,
    tags: service.tags,
    estimatedDeliveryTime: service.estimatedDeliveryTime,
    requirementsFromCustomer: service.requirementsFromCustomer,
    serviceRequestCount: service._count?.serviceRequests ?? 0,
  }))
}

async function getAutoRankedNewServices(prisma: ReturnType<typeof getPrisma>, maxServices: number): Promise<any[]> {
  const services = await prisma.service.findMany({
    where: {
      status: 'PUBLISHED',
      isActive: true,
      availabilityStatus: 'AVAILABLE',
    },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true, logo: true, averageRating: true, reviewCount: true } },
      _count: { select: { serviceRequests: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: maxServices || 20,
  })

  return services.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    shortDescription: s.shortDescription,
    startingPrice: s.startingPrice,
    pricingType: s.pricingType,
    deliveryType: s.deliveryType,
    availabilityStatus: s.availabilityStatus,
    status: s.status,
    thumbnail: s.thumbnail,
    gallery: s.gallery,
    category: s.category,
    store: s.store,
    images: s.images,
    tags: s.tags,
    estimatedDeliveryTime: s.estimatedDeliveryTime,
    requirementsFromCustomer: s.requirementsFromCustomer,
    serviceRequestCount: s._count?.serviceRequests ?? 0,
  }))
}

async function getRankedServicesByPerformance(prisma: ReturnType<typeof getPrisma>, maxServices: number): Promise<any[]> {
  const now = new Date()
  const services = await prisma.service.findMany({
    where: {
      status: 'PUBLISHED',
      isActive: true,
      availabilityStatus: 'AVAILABLE',
    },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true, logo: true, averageRating: true, reviewCount: true } },
      serviceRequests: {
        select: { id: true, status: true },
      },
      _count: { select: { serviceRequests: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: maxServices || 50,
  })

  const servicesWithScores = services.map((s) => {
    const completedBookings = s.serviceRequests.filter((r) => r.status === 'COMPLETED').length
    const totalRequests = s._count?.serviceRequests ?? 0
    const score = completedBookings * 100 + totalRequests
    return { service: s, score, completedBookings, totalRequests }
  })

  servicesWithScores.sort((a, b) => b.score - a.score)

  return servicesWithScores.slice(0, maxServices).map(({ service }) => ({
    id: service.id,
    slug: service.slug,
    title: service.title,
    shortDescription: service.shortDescription,
    startingPrice: service.startingPrice,
    pricingType: service.pricingType,
    deliveryType: service.deliveryType,
    availabilityStatus: service.availabilityStatus,
    status: service.status,
    thumbnail: service.thumbnail,
    gallery: service.gallery,
    category: service.category,
    store: service.store,
    images: service.images,
    tags: service.tags,
    estimatedDeliveryTime: service.estimatedDeliveryTime,
    requirementsFromCustomer: service.requirementsFromCustomer,
    serviceRequestCount: service._count?.serviceRequests ?? 0,
  }))
}

async function getAutoRankedVendors(prisma: ReturnType<typeof getPrisma>): Promise<any[]> {
  const vendors = await prisma.user.findMany({
    where: {
      role: 'VENDOR',
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          isVerified: true,
          isFeatured: true,
          badgeTier: true,
          _count: { select: { products: true } },
        },
      },
      profile: true,
    },
    take: 50,
  })

  const tierOrder: Record<string, number> = {
    PLATINUM: 3,
    PREMIUM: 2,
    TRUSTED: 1,
  }

  return vendors
    .filter((vendor) => vendor.store?.isVerified && (vendor.store?.badgeTier === 'PLATINUM' || vendor.store?.badgeTier === 'PREMIUM' || vendor.store?.badgeTier === 'TRUSTED'))
    .sort((a, b) => {
      const tierDiff = (tierOrder[b.store?.badgeTier || 'TRUSTED'] || 0) - (tierOrder[a.store?.badgeTier || 'TRUSTED'] || 0)
      if (tierDiff !== 0) return tierDiff
      return (b.store?._count?.products || 0) - (a.store?._count?.products || 0)
    })
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.store?.name || vendor.profile?.firstName + ' ' + vendor.profile?.lastName || 'Unknown Vendor',
      slug: vendor.store?.slug,
      logo: vendor.store?.logo,
      isVerified: vendor.store?.isVerified ?? true,
      badgeTier: vendor.store?.badgeTier,
      isFeatured: vendor.store?.isFeatured,
      productCount: vendor.store?._count?.products ?? 0,
      rating: 0,
      category: null,
      description: vendor.profile?.firstName || vendor.profile?.lastName || null,
    }))
}

async function getNewArrivalProducts(prisma: ReturnType<typeof getPrisma>, maxProducts: number): Promise<any[]> {
  const products = await prisma.product.findMany({
    where: {
      stock: { gt: 0 },
      OR: [
        { availabilityType: 'IN_STOCK' },
        { availabilityType: 'PREORDER' },
        { availabilityType: 'BACKORDER' },
      ],
    },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: maxProducts || 20,
  })

  return products.map((p) => p)
}

async function getNewArrivalServices(prisma: ReturnType<typeof getPrisma>, maxServices: number): Promise<any[]> {
  const services = await prisma.service.findMany({
    where: {
      status: 'PUBLISHED',
      isActive: true,
      availabilityStatus: 'AVAILABLE',
    },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true, logo: true, averageRating: true, reviewCount: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: maxServices || 20,
  })

  return services.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    shortDescription: s.shortDescription,
    startingPrice: s.startingPrice,
    pricingType: s.pricingType,
    deliveryType: s.deliveryType,
    availabilityStatus: s.availabilityStatus,
    status: s.status,
    thumbnail: s.thumbnail,
    gallery: s.gallery,
    category: s.category,
    store: s.store,
    images: s.images,
    tags: s.tags,
    estimatedDeliveryTime: s.estimatedDeliveryTime,
    requirementsFromCustomer: s.requirementsFromCustomer,
    serviceRequestCount: 0,
  }))
}

const productSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  flashSalePrice: true,
  flashSaleStart: true,
  flashSaleEnd: true,
  salesPrice: true,
  dealsPrice: true,
  stock: true,
  salesCount: true,
  isSponsored: true,
  brand: true,
  availabilityType: true,
  expectedArrivalDate: true,
  estimatedFulfillmentDays: true,
  preOrderNotes: true,
  expectedRestockDate: true,
  backOrderNotes: true,
  images: { select: { id: true, url: true, alt: true } },
  category: { select: { id: true, name: true, slug: true } },
  store: {
    select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true },
  },
} as const

function resolveContentSource(settings: any): ContentSource {
  const source = settings?.contentSource
  if (source === 'AUTOMATIC' || source === 'MANUAL' || source === 'HYBRID') return source
  return 'MANUAL'
}

async function safeResolve<T>(
  resolver: () => Promise<T>,
  fallback: T,
  sectionSlug: string,
  resolverName: string
): Promise<T> {
  try {
    return await resolver()
  } catch (e) {
    console.error(`[homepage/public] Section "${sectionSlug}" resolver "${resolverName}" failed:`, e)
    return fallback
  }
}

export async function GET(_request: NextRequest) {
  const perf = new PerformanceLogger('GET', _request.url)
  try {
    const prismaStartTime = perf.markPrismaStart()
    const prisma = getPrisma()
    let sections: any[] = []
    let brands: any[] = []
    let prismaInstance: ReturnType<typeof getPrisma> | null = null

    try {
      await ensureDefaultHomepageSections(prisma)
    } catch (e) {
      console.error('[homepage/public] ensureDefaultHomepageSections failed:', e)
    }

    try {
      sections = await prisma.homepageSection.findMany({
        where: { isEnabled: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          products: {
            orderBy: { displayOrder: 'asc' },
            select: {
              product: {
                select: productSelect,
              },
              displayOrder: true,
            },
          },
          vendors: {
            include: {
              vendor: {
                include: {
                  profile: true,
                  store: {
                    select: {
                      id: true,
                      name: true,
                      isVerified: true,
                      isFeatured: true,
                      logo: true,
                      badgeTier: true,
                      _count: { select: { products: true } },
                    },
                  },
                },
              },
            },
            take: 10,
          },
          brands: {
            orderBy: { brand: { displayOrder: 'asc' } },
            include: {
              brand: {
                include: {
                  _count: {
                    select: { products: true },
                  },
                },
              },
            },
          },
        },
      })
    } catch (e) {
      console.error('[homepage/public] homepageSection.findMany FAILED:', e)
      sections = []
    }

    try {
      brands = await prisma.brand.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              products: {
                where: {
                  OR: [
                    { stock: { gt: 0 } },
                    { availabilityType: 'PREORDER' },
                    { availabilityType: 'BACKORDER' },
                  ],
                },
              },
            },
          },
        },
      })
    } catch (e) {
      console.error('[homepage/public] brand.findMany FAILED:', e)
      brands = []
    }

    perf.markPrismaEnd(prismaStartTime)
    prismaInstance = prisma

    const formatted = (await Promise.allSettled((sections || []).map(async (section) => {
      const settings = (section.settings || {}) as AutoRankSettings
      const contentSource = resolveContentSource(settings)
      const maxProducts = settings.maxProducts || 20
      const maxServices = settings.maxServices || 20
      const maxVendors = settings.maxVendors || 10
      const sectionSlug = section.slug || 'unknown'

      let sortedProducts: any[] = []
      let sortedServices: any[] = []
      let sortedVendors: any[] = []
      let sortedBrands: any[] = []

      const now = new Date()

      if (contentSource === 'AUTOMATIC') {
        sortedProducts = await safeResolve(
          () => resolveAutomaticProducts(prismaInstance, section, settings, maxProducts),
          [],
          sectionSlug,
          'resolveAutomaticProducts'
        )
        sortedServices = await safeResolve(
          () => resolveAutomaticServices(prismaInstance, section, settings, maxServices),
          [],
          sectionSlug,
          'resolveAutomaticServices'
        )
        sortedVendors = await safeResolve(
          () => resolveAutomaticVendors(prismaInstance, section, maxVendors),
          [],
          sectionSlug,
          'resolveAutomaticVendors'
        )
        sortedBrands = await safeResolve(
          () => resolveAutomaticBrands(prismaInstance, section, settings),
          [],
          sectionSlug,
          'resolveAutomaticBrands'
        )
      } else if (contentSource === 'MANUAL') {
        sortedProducts = (section.products || [])
          .map((sp: any) => sp.product)
          .filter((p: any) => p && (!settings.excludeOutOfStock || p.stock > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER'))
        sortedServices = await safeResolve(
          () => resolveManualServices(settings, maxServices),
          [],
          sectionSlug,
          'resolveManualServices'
        )
        sortedVendors = (section.vendors || [])
          .map((sv: any) => ({
            ...sv.vendor,
            slug: sv.vendor.store?.slug ?? null,
            badgeTier: sv.vendor.store?.badgeTier ?? null,
            storeName: sv.vendor.store?.name ?? sv.vendor.name,
            productCount: sv.vendor.store?._count?.products ?? 0,
          }))
          .filter(Boolean)
        sortedBrands = resolveManualBrands(section)
      } else {
        sortedProducts = await safeResolve(
          () => resolveHybridProducts(prismaInstance, section, settings, maxProducts),
          [],
          sectionSlug,
          'resolveHybridProducts'
        )
        sortedServices = await safeResolve(
          () => resolveHybridServices(prismaInstance, section, settings, maxServices),
          [],
          sectionSlug,
          'resolveHybridServices'
        )
        sortedVendors = await safeResolve(
          () => resolveHybridVendors(prismaInstance, section, settings, maxVendors),
          [],
          sectionSlug,
          'resolveHybridVendors'
        )
        sortedBrands = resolveHybridBrands(section)
      }

      const expiredIds = new Set(
        sortedProducts
          .filter((p: any) => p && p.availabilityType === 'PREORDER' && p.expectedArrivalDate && new Date(p.expectedArrivalDate) < now)
          .map((p: any) => p.id)
      )

      if (expiredIds.size > 0) {
        void checkAndUpdateExpiredPreOrders(Array.from(expiredIds))
      }

      sortedProducts = sortedProducts.map((p: any) =>
        p && expiredIds.has(p.id) ? { ...p, availabilityType: 'IN_STOCK', expectedArrivalDate: null } : p
      )

      return {
        id: section.id,
        name: section.name,
        slug: section.slug,
        type: section.type,
        subtitle: section.subtitle,
        displayOrder: section.displayOrder,
        contentSource,
        products: sortedProducts,
        services: sortedServices,
        vendors: sortedVendors,
        brands: sortedBrands,
      }
    }))).map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      const failedSection = (sections || [])[index]
      const failedSlug = failedSection?.slug || 'unknown'
      console.error(`[homepage/public] Section "${failedSlug}" failed:`, result.reason)
      return {
        id: failedSection?.id,
        name: failedSection?.name,
        slug: failedSlug,
        type: failedSection?.type,
        subtitle: failedSection?.subtitle,
        displayOrder: failedSection?.displayOrder,
        contentSource: resolveContentSource(failedSection?.settings || {}),
        products: [],
        services: [],
        vendors: [],
        brands: [],
      }
    })

    const formattedBrands = (brands || []).map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo,
      description: brand.description,
      productCount: brand._count?.products ?? 0,
    }))

    const response = NextResponse.json({
      sections: formatted,
      brands: formattedBrands,
    })
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300, max-age=30')
    perf.log()
    return response
  } catch (error) {
    perf.log()
    console.error('Error fetching public homepage sections (outer):', error)
    return NextResponse.json({ sections: [], brands: [] }, { status: 200 })
  }
}

async function resolveAutomaticProducts(prisma: ReturnType<typeof getPrisma> | null, section: any, settings: AutoRankSettings, maxProducts: number): Promise<any[]> {
  const sectionType = section.type
  const sectionSlug = section.slug
  if (!prisma) return []

  switch (sectionType) {
    case 'TRENDING_NOW': {
      const autoSettings = { ...DEFAULT_AUTO_RANK_SETTINGS, ...settings, maxProducts }
      return getAutoRankedProducts(prisma, autoSettings)
    }
    case 'NEW_ARRIVALS': {
      return getNewArrivalProducts(prisma, maxProducts)
    }
    case 'TRENDING_SERVICES':
    case 'TOP_SERVICES':
    case 'SERVICE_GRID':
    case 'NEW_SERVICES':
      return []
    default: {
      return getAutoRankedProducts(prisma, { ...DEFAULT_AUTO_RANK_SETTINGS, ...settings, maxProducts })
    }
  }
}

async function resolveAutomaticServices(prisma: ReturnType<typeof getPrisma> | null, section: any, settings: AutoRankSettings, maxServices: number): Promise<any[]> {
  if (!prisma) return []

  switch (section.type) {
    case 'TRENDING_SERVICES':
      return getAutoRankedServices(prisma, maxServices)
    case 'TOP_SERVICES':
    case 'SERVICE_GRID': {
      const sectionSlug = section.slug
      if (sectionSlug === 'new-services') {
        return getAutoRankedNewServices(prisma, maxServices)
      }
      return getRankedServicesByPerformance(prisma, maxServices)
    }
    case 'NEW_SERVICES':
      return getAutoRankedNewServices(prisma, maxServices)
    default:
      return []
  }
}

async function resolveAutomaticVendors(prisma: ReturnType<typeof getPrisma> | null, section: any, maxVendors: number): Promise<any[]> {
  if (!prisma) return []
  return getAutoRankedVendors(prisma)
}

async function resolveManualServices(settings: AutoRankSettings, maxServices: number): Promise<any[]> {
  const serviceIds = settings.serviceIds || []
  if (serviceIds.length === 0) return []

  const prisma = getPrisma()
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, status: 'PUBLISHED', isActive: true },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true, logo: true, averageRating: true, reviewCount: true } },
    },
  })

  return services.map((s) => ({
    id: s.id, slug: s.slug, title: s.title, shortDescription: s.shortDescription,
    startingPrice: s.startingPrice, pricingType: s.pricingType, deliveryType: s.deliveryType,
    availabilityStatus: s.availabilityStatus, status: s.status, thumbnail: s.thumbnail,
    gallery: s.gallery, category: s.category, store: s.store, images: s.images,
    tags: s.tags, estimatedDeliveryTime: s.estimatedDeliveryTime,
    requirementsFromCustomer: s.requirementsFromCustomer,
  }))
}

async function resolveHybridProducts(prisma: ReturnType<typeof getPrisma> | null, section: any, settings: AutoRankSettings, maxProducts: number): Promise<any[]> {
  const joinTableProducts = (section.products || [])
    .map((sp: any) => sp.product)
    .filter((p: any) => p && p.id)
  const joinTableProductIds = joinTableProducts.map((p: any) => p.id)
  const autoProducts = await resolveAutomaticProducts(prisma, section, settings, maxProducts)

  if (joinTableProductIds.length === 0) return autoProducts

  if (!prisma) return autoProducts

  const pinnedProducts = await prisma.product.findMany({
    where: { id: { in: joinTableProductIds } },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true } },
    },
  })

  const autoIds = new Set(autoProducts.map((p: any) => p.id))
  const newAutoProducts = autoProducts.filter((p: any) => !joinTableProductIds.includes(p.id))

  return [...pinnedProducts, ...newAutoProducts].slice(0, maxProducts)
}

async function resolveHybridServices(prisma: ReturnType<typeof getPrisma> | null, section: any, settings: AutoRankSettings, maxServices: number): Promise<any[]> {
  const serviceIds = settings.serviceIds || []
  const autoServices = await resolveAutomaticServices(prisma, section, settings, maxServices)

  if (serviceIds.length === 0) return autoServices

  if (!prisma) return autoServices

  const pinnedServices = await prisma.service.findMany({
    where: { id: { in: serviceIds }, status: 'PUBLISHED', isActive: true },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true, logo: true, averageRating: true, reviewCount: true } },
    },
  })

  const newAutoServices = autoServices.filter((s: any) => !serviceIds.includes(s.id))

  return [...pinnedServices, ...newAutoServices].slice(0, maxServices)
}

async function resolveHybridVendors(prisma: ReturnType<typeof getPrisma> | null, section: any, settings: AutoRankSettings, maxVendors: number): Promise<any[]> {
  const joinTableVendors = (section.vendors || [])
    .map((sv: any) => sv.vendor)
    .filter((v: any) => v && v.id)
  const joinTableVendorIds = joinTableVendors.map((v: any) => v.id)
  const autoVendors = await resolveAutomaticVendors(prisma, section, maxVendors)

  if (joinTableVendorIds.length === 0) return autoVendors

  if (!prisma) return autoVendors

  const pinnedVendors = await prisma.user.findMany({
    where: { id: { in: joinTableVendorIds }, role: 'VENDOR' },
    include: {
      store: {
        select: {
          id: true, name: true, slug: true, logo: true, isVerified: true, isFeatured: true, badgeTier: true, _count: { select: { products: true } },
        },
      },
      profile: true,
    },
  })

  const formattedPinned = pinnedVendors
    .filter((v) => v.store?.isVerified)
    .map((v) => ({
      id: v.id, name: v.store?.name || v.profile?.firstName + ' ' + v.profile?.lastName || 'Unknown Vendor',
      slug: v.store?.slug, logo: v.store?.logo, isVerified: v.store?.isVerified ?? true,
      badgeTier: v.store?.badgeTier, isFeatured: v.store?.isFeatured,
      productCount: v.store?._count?.products ?? 0, rating: 0, category: null,
      description: v.profile?.firstName || v.profile?.lastName || null,
    }))

  const newAutoVendors = autoVendors.filter((v: any) => !joinTableVendorIds.includes(v.id))

  return [...formattedPinned, ...newAutoVendors].slice(0, maxVendors)
}

function resolveManualBrands(section: any): any[] {
  return (section.brands || [])
    .map((sb: any) => {
      const brand = sb.brand
      if (!brand) return null
      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo,
        description: brand.description,
        productCount: brand._count?.products ?? 0,
      }
    })
    .filter((b: any) => b && b.isActive !== false)
}

function resolveHybridBrands(section: any): any[] {
  return (section.brands || [])
    .map((sb: any) => {
      const brand = sb.brand
      if (!brand) return null
      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo,
        description: brand.description,
        productCount: brand._count?.products ?? 0,
      }
    })
    .filter((b: any) => b && b.isActive !== false)
}

async function resolveAutomaticBrands(prisma: ReturnType<typeof getPrisma> | null, section: any, settings: AutoRankSettings): Promise<any[]> {
  if (!prisma) return []
  const allBrands = await prisma.brand.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          products: {
            where: {
              OR: [
                { stock: { gt: 0 } },
                { availabilityType: 'PREORDER' },
                { availabilityType: 'BACKORDER' },
              ],
            },
          },
        },
      },
    },
  })
  return allBrands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo,
    description: brand.description,
    productCount: brand._count?.products ?? 0,
  }))
}