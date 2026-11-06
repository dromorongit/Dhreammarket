import type { CachedSellerTrustProfileData } from './cached-profile'
import type {
  DeliverySample,
  ResponseSample,
  TrustProfileInput,
} from './types'

export function rehydrateProfileInput(cached: CachedSellerTrustProfileData): TrustProfileInput {
  return {
    storeCreatedAt: new Date(cached.storeCreatedAt),
    firstSaleAt: cached.firstSaleAt ? new Date(cached.firstSaleAt) : null,
    verificationStatus: cached.verificationStatus,
    verifiedSince: cached.verifiedSince ? new Date(cached.verifiedSince) : null,
    now: new Date(cached.now),
    windowDays: cached.windowDays,
    completedInWindow: cached.completedInWindow,
    completedLifetime: cached.completedLifetime,
    vendorCancelledInWindow: cached.vendorCancelledInWindow,
    deliveries: (cached.deliveries ?? []).map(
      (d: { deliveredAt: string; expectedAt: string | null; orderDate: string }): DeliverySample => ({
        deliveredAt: new Date(d.deliveredAt),
        expectedAt: d.expectedAt ? new Date(d.expectedAt) : null,
        orderDate: new Date(d.orderDate),
      })
    ),
    responseSamples: (cached.responseSamples ?? []).map(
      (r: { orderDate: string; firstVendorReplyAt: string | null }): ResponseSample => ({
        orderDate: new Date(r.orderDate),
        firstVendorReplyAt: r.firstVendorReplyAt ? new Date(r.firstVendorReplyAt) : null,
      })
    ),
    deliveryPolicyDays: cached.deliveryPolicyDays,
    sellerFaultReturnsInWindow: cached.sellerFaultReturnsInWindow,
    reviewCount: cached.reviewCount,
    reviewSum: cached.reviewSum,
  }
}
