import {
  MIN_ORDERS_FOR_RATES,
  MIN_REVIEWS_FOR_RATING,
  SUPPRESSION_THRESHOLD,
  ROLLING_WINDOW_DAYS,
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
  deliveryDays: number[],
  minSample: number
): Signal<DeliveryValue> {
  const samples = (deliveryDays ?? []).filter((n) => Number.isFinite(n) && n >= 0)
  const count = samples.length
  if (count < minSample) {
    return { state: 'INSUFFICIENT_DATA', counts: { numerator: count, denominator: count } }
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  return {
    state: 'OK',
    counts: { numerator: count, denominator: count },
    value: { medianDays: round1(median) },
  }
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
  return {
    identity: {
      status: verificationStatus,
      verifiedSince: input.verifiedSince ?? undefined,
    },
    tenure: {
      daysOnPlatform: tenure.daysOnPlatform,
      firstSaleAt: tenure.firstSaleAt,
    },
    orders: {
      completed: input.completedInWindow,
      lifetimeCompleted: input.completedLifetime,
    },
    fulfilment: computeFulfilmentSignal(
      input.completedInWindow,
      input.vendorCancelledInWindow,
      MIN_ORDERS_FOR_RATES
    ),
    cancellation: computeCancellationSignal(
      input.vendorCancelledInWindow,
      input.completedInWindow,
      MIN_ORDERS_FOR_RATES
    ),
    delivery: computeDeliverySignal(input.deliveryDays, MIN_ORDERS_FOR_RATES),
    sellerFaultReturns: computeReturnSignal(
      input.sellerFaultReturnsInWindow,
      input.completedInWindow,
      MIN_ORDERS_FOR_RATES
    ),
    ratings: computeRatingSignal(input.reviewCount, input.reviewSum, MIN_REVIEWS_FOR_RATING),
    computedAt: input.now,
    window: { rollingDays: input.windowDays, from: windowStart, to: input.now },
  }
}

export { ROLLING_WINDOW_DAYS }
