import { unstable_cache } from 'next/cache'
import { getPrisma } from '@/lib/prisma'
import { loadSellerTrustProfile } from '@/lib/trust/load-profile'

class SellerTrustProfileNotFoundError extends Error {}

interface CachedSellerTrustProfileData {
  storeCreatedAt: string
  firstSaleAt: string | null
  verifiedSince: string | null
  now: string
  windowDays: number
  completedInWindow: number
  completedLifetime: number
  vendorCancelledInWindow: number
  deliveryDays: number[]
  sellerFaultReturnsInWindow: number
  reviewCount: number
  reviewSum: number
}

function serialize(data: any): CachedSellerTrustProfileData {
  return {
    storeCreatedAt: data.storeCreatedAt.toISOString(),
    firstSaleAt: data.firstSaleAt ? data.firstSaleAt.toISOString() : null,
    verifiedSince: data.verifiedSince ? data.verifiedSince.toISOString() : null,
    now: data.now.toISOString(),
    windowDays: data.windowDays,
    completedInWindow: data.completedInWindow,
    completedLifetime: data.completedLifetime,
    vendorCancelledInWindow: data.vendorCancelledInWindow,
    deliveryDays: data.deliveryDays,
    sellerFaultReturnsInWindow: data.sellerFaultReturnsInWindow,
    reviewCount: data.reviewCount,
    reviewSum: data.reviewSum,
  }
}

export async function getCachedSellerTrustProfile(storeIdOrSlug: string) {
  const cached = unstable_cache(
    async () => {
      const client = getPrisma()
      const result = await loadSellerTrustProfile(client, { storeId: storeIdOrSlug, now: new Date() })
      if (!result.found) {
        throw new SellerTrustProfileNotFoundError()
      }
      return { found: true as const, data: serialize(result.data) }
    },
    ['seller-trust-profile', storeIdOrSlug],
    { revalidate: 300, tags: [`trust-profile:${storeIdOrSlug}`] }
  )

  try {
    return await cached()
  } catch (error) {
    if (error instanceof SellerTrustProfileNotFoundError) {
      return { found: false as const }
    }
    throw error
  }
}

