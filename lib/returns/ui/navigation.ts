export type ReturnsNavRole = 'SUPER_ADMIN' | 'ADMIN' | 'INFLUENCER' | 'VENDOR' | 'CUSTOMER'

export interface ReturnsNavItem {
  label: string
  href: string
}

export function getReturnsNavItems(role: string, flagEnabled: boolean): ReturnsNavItem[] {
  if (!flagEnabled) return []
  switch (role) {
    case 'CUSTOMER':
      return [{ label: 'My returns', href: '/dashboard/customer/returns' }]
    case 'VENDOR':
      return [{ label: 'Returns', href: '/dashboard/vendor/returns' }]
    case 'SUPER_ADMIN':
      return [{ label: 'Returns', href: '/dashboard/admin/returns' }]
    default:
      return []
  }
}

export function shouldShowReturnLink({
  flagEnabled,
  orderStatus,
  paymentStatus,
}: {
  flagEnabled: boolean
  orderStatus: string
  paymentStatus: string
}): boolean {
  if (!flagEnabled) return false
  if (paymentStatus !== 'PAID') return false
  return orderStatus === 'DELIVERED' || orderStatus === 'COMPLETED'
}

const SAFE_ID = /^[A-Za-z0-9_-]+$/

export function buildReturnLinkHref(orderItemId: string): string | null {
  if (typeof orderItemId !== 'string') return null
  const trimmed = orderItemId.trim()
  if (trimmed === '' || !SAFE_ID.test(trimmed)) return null
  return `/dashboard/customer/returns/new?orderItemId=${encodeURIComponent(trimmed)}`
}
