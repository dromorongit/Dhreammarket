import {
  MIN_ORDERS_FOR_RATES,
  MIN_REVIEWS_FOR_RATING,
  SUPPRESSION_THRESHOLD,
  ROLLING_WINDOW_DAYS,
  RESPONSE_WINDOW_DAYS,
  DELIVERY_WINDOW_DAYS,
  TIER_ESTABLISHED_MIN_ORDERS,
  TIER_ESTABLISHED_MIN_FULFILMENT_PCT,
  TIER_ESTABLISHED_MIN_ONTIME_PCT,
  TIER_TRUSTED_MIN_FULFILMENT_PCT,
  TIER_TRUSTED_MIN_ONTIME_PCT,
  TIER_TRUSTED_MIN_RESPONSE_PCT,
  TIER_TRUSTED_MIN_REVIEWS,
  TIER_TRUSTED_MAX_SELLER_FAULT_RETURN_PCT,
  TIER_TRUSTED_RETURN_RATE_MIN_RETURNS,
} from './constants'
import type {
  TrustProfileInput,
  SellerTrustProfile,
  Signal,
  SuppressedBand,
  RateValue,
  DeliveryValue,
  RatingValue,
  IdentityStatus,
  DeliverySample,
  ResponseSample,
  TrustTier,
} from './types'

function trunc(n: number): number {
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function computeRate(
  numerator: number,
  denominator: number,
  minSample: number
): Signal<RateValue> {
  const n = Math.max(0, trunc(numerator))
  const d = Math.max(0, trunc(denominator))
  if (d === 0 || d < minSample) {
    return { state: 'INSUFFICIENT_DATA', counts: { numerator: n, denominator: d } }
  }
  const percentage = Math.round((n * 1000) / d) / 10
  return { state: 'OK', counts: { numerator: n, denominator: d }, value: { percentage } }
}

export function computeFulfilmentSignal(
  completed: number,
  vendorCancelled: number,
  minSample: number
): Signal<RateValue> {
  return computeRate(completed, completed + vendorCancelled, minSample)
}

export function computeCancellationSignal(
  vendorCancelled: number,
  completed: number,
  minSample: number
): Signal<RateValue> {
  return computeRate(vendorCancelled, completed + vendorCancelled, minSample)
}

export function computeDeliverySignal(
  samples: DeliverySample[],
  minSample: number,
  policyDispatchDays: number
): Signal<DeliveryValue> {
  const valid = (samples ?? [])
    .filter((s) => s.deliveredAt && s.orderDate && Number.isFinite(s.deliveredAt.getTime()) && Number.isFinite(s.orderDate.getTime()))
  const count = valid.length
  if (count < minSample) {
    return { state: 'INSUFFICIENT_DATA', counts: { numerator: 0, denominator: count } }
  }
  const policyDays = Number.isFinite(policyDispatchDays) && policyDispatchDays >= 0 ? trunc(policyDispatchDays) : 0
  const fallbackDays = policyDays + trunc(DELIVERY_WINDOW_DAYS)
  let onTime = 0
  const deliveryDays: number[] = []
  for (const s of valid) {
    const promised = s.expectedAt ?? new Date(s.orderDate.getTime() + fallbackDays * 86400000)
    const ms = s.deliveredAt.getTime() - promised.getTime()
    if (ms <= 0) onTime++
    deliveryDays.push(Math.max(0, (s.deliveredAt.getTime() - s.orderDate.getTime()) / 86400000))
  }
  const sorted = [...deliveryDays].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  return {
    state: 'OK',
    counts: { numerator: onTime, denominator: count },
    value: { onTimePercentage: Math.round((onTime * 1000) / count) / 10, medianDays: round1(median) },
  }
}

export function computeResponseRateSignal(
  samples: ResponseSample[],
  minSample: number,
  windowDays: number
): Signal<RateValue> {
  const valid = (samples ?? []).filter((s) => s.orderDate && Number.isFinite(s.orderDate.getTime()))
  const count = valid.length
  const windowMs = Number.isFinite(windowDays) && windowDays >= 0 ? trunc(windowDays) * 86400000 : 0
  let responsive = 0
  for (const s of valid) {
    if (!s.firstVendorReplyAt || !Number.isFinite(s.firstVendorReplyAt.getTime())) continue
    const ms = s.firstVendorReplyAt.getTime() - s.orderDate.getTime()
    if (ms >= 0 && ms <= windowMs) responsive++
  }
  return computeRate(responsive, count, minSample)
}

export function computeReturnSignal(
  sellerFaultCount: number,
  denominatorCount: number,
  minSample: number
): Signal<RateValue> | SuppressedBand {
  const n = Math.max(0, trunc(sellerFaultCount))
  if (n < SUPPRESSION_THRESHOLD) {
    return { state: 'SUPPRESSED', band: 'fewer than 5' }
  }
  return computeRate(n, denominatorCount, minSample)
}

export function computeRatingSignal(
  count: number,
  sum: number,
  minSample: number
): Signal<RatingValue> {
  const c = Math.max(0, trunc(count))
  if (c < minSample) {
    return { state: 'INSUFFICIENT_DATA', counts: { numerator: c, denominator: c } }
  }
  const average = Math.round((sum * 10) / c) / 10
  return {
    state: 'OK',
    counts: { numerator: c, denominator: c },
    value: { average, count: c },
  }
}

export function computeTenure(
  storeCreatedAt: Date,
  firstSaleAt: Date | null | undefined,
  now: Date
): { daysOnPlatform: number; firstSaleAt?: Date } {
  const ms = now.getTime() - storeCreatedAt.getTime()
  const days = ms < 0 ? 0 : Math.floor(ms / 86400000)
  return { daysOnPlatform: days, firstSaleAt: firstSaleAt ?? undefined }
}

export function composeProfile(input: TrustProfileInput): SellerTrustProfile {
  const verificationStatus: IdentityStatus =
    input.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED'
  const tenure = computeTenure(input.storeCreatedAt, input.firstSaleAt, input.now)
  const windowStart = new Date(input.now.getTime() - input.windowDays * 86400000)

  const fulfilment = computeFulfilmentSignal(
    input.completedInWindow,
    input.vendorCancelledInWindow,
    MIN_ORDERS_FOR_RATES
  )
  const cancellation = computeCancellationSignal(
    input.vendorCancelledInWindow,
    input.completedInWindow,
    MIN_ORDERS_FOR_RATES
  )
  const delivery = computeDeliverySignal(input.deliveries, MIN_ORDERS_FOR_RATES, input.deliveryPolicyDays)
  const responseRate = computeResponseRateSignal(
    input.responseSamples,
    MIN_ORDERS_FOR_RATES,
    RESPONSE_WINDOW_DAYS
  )
  const sellerFaultReturns = computeReturnSignal(
    input.sellerFaultReturnsInWindow,
    input.completedInWindow,
    MIN_ORDERS_FOR_RATES
  )
  const ratings = computeRatingSignal(input.reviewCount, input.reviewSum, MIN_REVIEWS_FOR_RATING)

  const profile: SellerTrustProfile = {
    identity: {
      status: verificationStatus,
      verifiedSince: input.verifiedSince ?? undefined,
      verificationMethod: input.verificationMethod,
    },
    tenure: {
      daysOnPlatform: tenure.daysOnPlatform,
      firstSaleAt: tenure.firstSaleAt,
    },
    orders: {
      completed: input.completedInWindow,
      lifetimeCompleted: input.completedLifetime,
    },
    fulfilment,
    cancellation,
    delivery,
    responseRate,
    sellerFaultReturns,
    openEscalatedReturns: input.openEscalatedReturnsInWindow ?? 0,
    ratings,
    computedAt: input.now,
    window: { rollingDays: input.windowDays, from: windowStart, to: input.now },
    trustTier: 'New',
    trustTierCriteria: { met: [], missing: [] },
  }

  // Compute trust tier and criteria
  const { trustTier, trustTierCriteria } = computeTrustTier(profile)
  profile.trustTier = trustTier
  profile.trustTierCriteria = trustTierCriteria

  return profile
}

function computeTrustTier(profile: SellerTrustProfile): { trustTier: TrustTier; trustTierCriteria: TrustTierCriteria } {
  const met: string[] = []
  const missing: string[] = []

  const completedLifetime = profile.orders?.lifetimeCompleted ?? 0
  const fulfilmentPct = profile.fulfilment?.state === 'OK' ? (profile.fulfilment.value?.percentage ?? 0) : 0
  const onTimePct = profile.delivery?.state === 'OK' ? (profile.delivery.value?.onTimePercentage ?? 0) : 0
  const responsePct = profile.responseRate?.state === 'OK' ? (profile.responseRate.value?.percentage ?? 0) : 0
  const reviewCount = profile.ratings?.state === 'OK' ? (profile.ratings.value?.count ?? 0) : 0
  const returnsCount = profile.sellerFaultReturns?.counts?.numerator ?? 0
  const returnsState = profile.sellerFaultReturns?.state
  const openEscalatedCount = profile.openEscalatedReturns ?? 0
  const hasOpenEscalatedReturns = openEscalatedCount > 0
  const noOpenEscalatedReturns = openEscalatedCount === 0

  const hasMinOrders = completedLifetime >= TIER_ESTABLISHED_MIN_ORDERS
  const fulfilmentEstablished = fulfilmentPct >= TIER_ESTABLISHED_MIN_FULFILMENT_PCT
  const onTimeEstablished = onTimePct >= TIER_ESTABLISHED_MIN_ONTIME_PCT

  if (hasMinOrders) met.push(`${TIER_ESTABLISHED_MIN_ORDERS}+ lifetime orders`)
  else missing.push(`${TIER_ESTABLISHED_MIN_ORDERS}+ lifetime orders`)
  if (fulfilmentEstablished) met.push('Fulfilment rate >= threshold')
  else missing.push('Fulfilment rate >= threshold')
  if (onTimeEstablished) met.push('On-time rate >= threshold')
  else missing.push('On-time rate >= threshold')

  const isEstablished = hasMinOrders && fulfilmentEstablished && onTimeEstablished

  // Trusted requires KYC only
  const isKyc = profile.identity?.verificationMethod === 'KYC'
  const isAdminVerified = profile.identity?.verificationMethod === 'ADMIN_FLAG'
  const fulfilmentTrusted = fulfilmentPct >= TIER_TRUSTED_MIN_FULFILMENT_PCT
  const onTimeTrusted = onTimePct >= TIER_TRUSTED_MIN_ONTIME_PCT
  const responseTrusted = responsePct >= TIER_TRUSTED_MIN_RESPONSE_PCT
  const enoughReviews = reviewCount >= TIER_TRUSTED_MIN_REVIEWS

  // Seller-fault return ceiling: rate = sellerFaultReturns / completedInWindow
  // (completed orders in the rolling window). Only enforced once there are
  // at least TIER_TRUSTED_RETURN_RATE_MIN_RETURNS seller-fault returns; below
  // that floor the rate is not counted against the seller.
  const completedForReturns = profile.orders?.completed ?? 0
  const hasEnoughReturnData = returnsCount >= TIER_TRUSTED_RETURN_RATE_MIN_RETURNS
  const returnRatePct =
    completedForReturns > 0 ? (returnsCount / completedForReturns) * 100 : 0
  const returnRateOk = !hasEnoughReturnData || returnRatePct <= TIER_TRUSTED_MAX_SELLER_FAULT_RETURN_PCT

  if (isKyc) met.push('Verified identity (KYC)')
  else missing.push('Verified identity (KYC)')
  if (fulfilmentTrusted) met.push('Fulfilment rate >= 80%')
  else missing.push('Fulfilment rate >= 80%')
  if (onTimeTrusted) met.push('On-time rate >= 80%')
  else missing.push('On-time rate >= 80%')
  if (responseTrusted) met.push('Response rate >= 80%')
  else missing.push('Response rate >= 80%')
  if (enoughReviews) met.push(`Ratings available (${TIER_TRUSTED_MIN_REVIEWS}+ reviews)`)
  else missing.push(`Ratings available (${TIER_TRUSTED_MIN_REVIEWS}+ reviews)`)
  if (noOpenEscalatedReturns) met.push('No open escalated returns')
  else missing.push('No open escalated returns')
  if (returnRateOk) {
    met.push(
      hasEnoughReturnData
        ? 'Seller-fault return rate 10% or less'
        : 'Seller-fault return rate 10% or less (fewer than 5 returns - not counted)'
    )
  } else {
    missing.push('Seller-fault return rate 10% or less')
  }

  const isTrusted = isEstablished && isKyc && fulfilmentTrusted && onTimeTrusted && responseTrusted && enoughReviews && noOpenEscalatedReturns && returnRateOk

  // Admin-verified badge separate; tracked via identity.verificationMethod but no tier credit.
  void isAdminVerified

  let trustTier: TrustTier = 'New'
  if (isTrusted) trustTier = 'Trusted'
  else if (isEstablished) trustTier = 'Established'

  return { trustTier, trustTierCriteria: { met, missing } }
}

export { ROLLING_WINDOW_DAYS, MIN_ORDERS_FOR_RATES }
