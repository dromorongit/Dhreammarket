export const CANCELLATION_FEE_GHS = 5
export const FREE_WINDOW_MINUTES = 60
export const BLOCK_THRESHOLD = 4
export const BLOCK_WINDOW_DAYS = 30
export const BLOCK_MONTHS = 3

// The 16 regions of Ghana, canonical names (no "Region" suffix).
export const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
] as const

export type GhanaRegion = (typeof GHANA_REGIONS)[number]

export function isValidGhanaRegion(region: string | null | undefined): region is GhanaRegion {
  return typeof region === 'string' && GHANA_REGIONS.includes(region as GhanaRegion)
}

// Exact wording shown on the checkout page when the cancellation policy flag
// is on. Kept in one shared constant so checkout and any other surface render
// identical notice text.
export const CANCELLATION_POLICY_CHECKOUT_NOTICE =
  'Free cancellation within 1 hour of ordering if the order has not shipped. After that, a GHS 5 cancellation fee applies. Paystack\'s processing fee is not refunded. Cancelling 4 orders within 30 days blocks all cancellations for 3 months.'

export function toPesewas(amountGhs: number): number {
  return Math.round(amountGhs * 100)
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / 100
}

export function isBlocked(blockedUntil: Date | null, now: Date): boolean {
  return blockedUntil != null && blockedUntil.getTime() > now.getTime()
}

export function isWithinFreeWindow(orderCreatedAt: Date, now: Date): boolean {
  return now.getTime() <= orderCreatedAt.getTime() + FREE_WINDOW_MINUTES * 60 * 1000
}
