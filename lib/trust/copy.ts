import type { Signal, SuppressedBand, RateValue, DeliveryValue, RatingValue, SignalState } from './types'

export function signalStateLabel(state: SignalState): string {
  switch (state) {
    case 'OK':
      return 'Available'
    case 'INSUFFICIENT_DATA':
      return 'Not enough data yet'
    case 'NOT_AVAILABLE':
      return 'Not available'
  }
}

export function formatRate(signal: Signal<RateValue>, noun: string): string {
  if (signal.state === 'INSUFFICIENT_DATA') {
    return 'Not enough orders yet'
  }
  if (signal.state !== 'OK' || !signal.value) {
    return 'Not available'
  }
  const { numerator, denominator } = signal.counts
  return `${noun}: ${numerator} of ${denominator} (${signal.value.percentage.toFixed(1)}%)`
}

export function formatDelivery(signal: Signal<DeliveryValue>): string {
  if (signal.state === 'INSUFFICIENT_DATA') {
    return 'Not enough deliveries yet'
  }
  if (signal.state !== 'OK' || !signal.value) {
    return 'Not available'
  }
  const { numerator } = signal.counts
  return `Median delivery time: ${signal.value.medianDays.toFixed(1)} days (${numerator} delivered)`
}

export function formatReturns(signal: Signal<RateValue> | SuppressedBand): string {
  if ('suppressed' in (signal as any) || (signal as SuppressedBand).state === 'SUPPRESSED') {
    return 'Fewer than 5'
  }
  const s = signal as Signal<RateValue>
  if (s.state === 'INSUFFICIENT_DATA') {
    return 'Not enough orders yet'
  }
  if (s.state !== 'OK' || !s.value) {
    return 'Not available'
  }
  const { numerator, denominator } = s.counts
  return `Seller-fault returns: ${numerator} of ${denominator} (${s.value.percentage.toFixed(1)}%)`
}

export function formatRating(signal: Signal<RatingValue>): string {
  if (signal.state === 'INSUFFICIENT_DATA') {
    return 'Not enough reviews yet'
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
