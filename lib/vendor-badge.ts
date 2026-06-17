import { VendorBadgeTier } from '@prisma/client'

export type VendorBadgeInfo = {
  tier: VendorBadgeTier | null
  displayLabel: string
  variant: 'trusted-vendor' | 'premium-vendor' | 'platinum-vendor'
}

export function getVendorBadgeInfo(tier: VendorBadgeTier | null): VendorBadgeInfo | null {
  if (!tier) return null
  
  switch (tier) {
    case 'TRUSTED':
      return {
        tier,
        displayLabel: 'Trusted Vendor',
        variant: 'trusted-vendor',
      }
    case 'PREMIUM':
      return {
        tier,
        displayLabel: 'Premium Vendor',
        variant: 'premium-vendor',
      }
    case 'PLATINUM':
      return {
        tier,
        displayLabel: 'Platinum Vendor',
        variant: 'platinum-vendor',
      }
    default:
      return null
  }
}

export function getBadgeTierEnum(value: string | null): VendorBadgeTier | null {
  if (!value) return null
  
  switch (value.toUpperCase()) {
    case 'TRUSTED':
      return 'TRUSTED'
    case 'PREMIUM':
      return 'PREMIUM'
    case 'PLATINUM':
      return 'PLATINUM'
    default:
      return null
  }
}

export const BADGE_TIERS: { value: VendorBadgeTier; label: string; description: string }[] = [
  { value: 'PLATINUM', label: 'Platinum Vendor', description: 'Highest tier - Grey badge' },
  { value: 'PREMIUM', label: 'Premium Vendor', description: 'Mid tier - Gold badge' },
  { value: 'TRUSTED', label: 'Trusted Vendor', description: 'Entry tier - Blue badge' },
]