export type SignalState = 'OK' | 'INSUFFICIENT_DATA' | 'NOT_AVAILABLE'

export interface Signal<T> {
  state: SignalState
  counts: { numerator: number; denominator: number }
  value?: T
}

export interface SuppressedBand {
  state: 'SUPPRESSED'
  band: 'fewer than 5'
}

export interface RateValue {
  percentage: number
}

export interface DeliveryValue {
  medianDays: number
}

export interface RatingValue {
  average: number
  count: number
}

export type IdentityStatus = 'VERIFIED' | 'UNVERIFIED'

export interface SellerTrustProfile {
  identity: { status: IdentityStatus; verifiedSince?: Date }
  tenure: { daysOnPlatform: number; firstSaleAt?: Date }
  orders: { completed: number; lifetimeCompleted: number }
  fulfilment: Signal<RateValue>
  cancellation: Signal<RateValue>
  delivery: Signal<DeliveryValue>
  sellerFaultReturns: Signal<RateValue> | SuppressedBand
  ratings: Signal<RatingValue>
  computedAt: Date
  window: { rollingDays: number; from: Date; to: Date }
}

export interface TrustProfileInput {
  storeCreatedAt: Date
  firstSaleAt?: Date | null
  verificationStatus: IdentityStatus
  verifiedSince?: Date | null
  now: Date
  windowDays: number
  completedInWindow: number
  completedLifetime: number
  vendorCancelledInWindow: number
  deliveryDays: number[]
  sellerFaultReturnsInWindow: number
  reviewCount: number
  reviewSum: number
}

