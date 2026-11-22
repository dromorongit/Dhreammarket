import type { Signal, SuppressedBand, RateValue, DeliveryValue, RatingValue, SignalState } from './types'
import { MIN_ORDERS_FOR_RATES, MIN_REVIEWS_FOR_RATING, SUPPRESSION_THRESHOLD, RESPONSE_WINDOW_DAYS, TIER_TRUSTED_MAX_SELLER_FAULT_RETURN_PCT, TIER_TRUSTED_RETURN_RATE_MIN_RETURNS } from './constants'

export function signalStateLabel(state: SignalState): string {
  switch (state) {
    case 'OK':
      return 'Available'
    case 'INSUFFICIENT_DATA':
      return 'Not enough data'
    case 'NOT_AVAILABLE':
      return 'Not available'
  }
}

export function formatRate(signal: Signal<RateValue>, noun: string): string {
  if (signal.state === 'INSUFFICIENT_DATA') {
    return `Not enough ${noun.toLowerCase()} yet (minimum ${MIN_ORDERS_FOR_RATES})`
  }
  if (signal.state !== 'OK' || !signal.value) {
    return 'Not available'
  }
  const { numerator, denominator } = signal.counts
  return `${noun}: ${numerator} of ${denominator} (${signal.value.percentage.toFixed(1)}%)`
}

export function formatDelivery(signal: Signal<DeliveryValue>): string {
  if (signal.state === 'INSUFFICIENT_DATA') {
    return `Not enough deliveries yet (minimum ${MIN_ORDERS_FOR_RATES})`
  }
  if (signal.state !== 'OK' || !signal.value) {
    return 'Not available'
  }
  const { numerator, denominator } = signal.counts
  const median = signal.value.medianDays != null ? `, median ${signal.value.medianDays.toFixed(1)} days` : ''
  return `On-time delivery: ${numerator} of ${denominator} (${signal.value.onTimePercentage.toFixed(1)}%)${median}`
}

export function formatResponseRate(signal: Signal<RateValue>): string {
  if (signal.state === 'INSUFFICIENT_DATA') {
    return `Not enough orders yet (minimum ${MIN_ORDERS_FOR_RATES})`
  }
  if (signal.state !== 'OK' || !signal.value) {
    return 'Not available'
  }
  const { numerator, denominator } = signal.counts
  return `First reply within ${RESPONSE_WINDOW_DAYS} days: ${numerator} of ${denominator} (${signal.value.percentage.toFixed(1)}%)`
}

export function formatReturns(signal: Signal<RateValue> | SuppressedBand): string {
  if ('state' in signal && signal.state === 'SUPPRESSED') {
    return `Fewer than ${SUPPRESSION_THRESHOLD} seller-fault returns`
  }
  const s = signal as Signal<RateValue>
  if (s.state === 'INSUFFICIENT_DATA') {
    return `Not enough orders yet (minimum ${MIN_ORDERS_FOR_RATES})`
  }
  if (s.state !== 'OK' || !s.value) {
    return 'Not available'
  }
  const { numerator, denominator } = s.counts
  return `Seller-fault returns: ${numerator} of ${denominator} (${s.value.percentage.toFixed(1)}%) (Trusted requires <= ${TIER_TRUSTED_MAX_SELLER_FAULT_RETURN_PCT}% with ${TIER_TRUSTED_RETURN_RATE_MIN_RETURNS}+ returns)`
}

export function formatRating(signal: Signal<RatingValue>): string {
  if (signal.state === 'INSUFFICIENT_DATA') {
    return `Not enough reviews yet (minimum ${MIN_REVIEWS_FOR_RATING})`
  }
  if (signal.state !== 'OK' || !signal.value) {
    return 'Not available'
  }
  return `${signal.value.average.toFixed(1)} from ${signal.value.count} verified purchases`
}

export function isSuppressedBand(value: unknown): value is SuppressedBand {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).state === 'SUPPRESSED' &&
    (value as any).band === 'fewer than 5'
  )
}
