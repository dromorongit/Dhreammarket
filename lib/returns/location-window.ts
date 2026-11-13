export const DEFAULT_RETURN_WINDOW_DAYS = 3

export const GREATER_ACCRA_RETURN_WINDOW_DAYS = 1

export const LOCATION_WINDOW_RULE_VERSION = 'location-window-v1'

export type LocationOrderLike = {
  customerRegion?: string | null
  createdAt?: Date | string | null
  completedAt?: Date | string | null
}

export function normalizeRegion(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\bregion\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isGreaterAccra(order: LocationOrderLike): boolean {
  return normalizeRegion(order.customerRegion) === 'greater accra'
}

export function windowDaysForRegion(order: LocationOrderLike): number {
  return isGreaterAccra(order) ? GREATER_ACCRA_RETURN_WINDOW_DAYS : DEFAULT_RETURN_WINDOW_DAYS
}

export function isPostCutover(orderCreatedAt: Date | string | null, systemCutoverTimestamp: Date | string | null): boolean {
  if (!orderCreatedAt || !systemCutoverTimestamp) return false
  return new Date(orderCreatedAt).getTime() >= new Date(systemCutoverTimestamp).getTime()
}
