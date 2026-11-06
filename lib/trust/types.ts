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
  onTimePercentage: number
  medianDays?: number
}

export interface DeliverySample {
  deliveredAt: Date
  // Promised/expected delivery date (e.g. orderItem.expectedArrivalDate). When
  // null, the signal falls back to the PlatformPolicy dispatch target plus the
  // delivery window, counted from the payment date.
  expectedAt: Date | null
  // Payment date that starts the delivery clock (paymentConfirmedAt). Samples
  // without a payment date are excluded.
  orderDate: Date
}

export interface ResponseSample {
  // Payment date that starts the response clock (paymentConfirmedAt). Samples
  // without a payment date are excluded.
  orderDate: Date
  // First vendor (userRole === 'VENDOR') reply on the order, if any. System or
  // automated messages (userRole 'SYSTEM') are excluded upstream.
  firstVendorReplyAt: Date | null
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
  responseRate: Signal<RateValue>
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
  // Delivered order items in window, each with deliveredAt and the
  // promised/expected date (expectedAt). Used for on-time delivery %.
  deliveries: DeliverySample[]
  // Paid orders in window with their first vendor reply time. Used for
  // response_rate_after_payment.
  responseSamples: ResponseSample[]
  // PlatformPolicy.dispatchTargetDaysAfterPayment, used when expectedAt is absent.
  deliveryPolicyDays: number
  sellerFaultReturnsInWindow: number
  reviewCount: number
  reviewSum: number
}

