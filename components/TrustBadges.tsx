'use client'

import { Card } from './Card'
import { Badge } from './Badge'

interface TrustBadgeProps {
  badgeType: string
}

export function TrustBadge({ badgeType }: TrustBadgeProps) {
  const badgeConfig: Record<string, { label: string; variant: string; color: string }> = {
    TOP_SELLER: { label: 'Top Seller', variant: 'secondary', color: 'bg-yellow-100 text-yellow-800' },
    TOP_SERVICE_PROVIDER: { label: 'Top Service', variant: 'secondary', color: 'bg-blue-100 text-blue-800' },
    FAST_RESPONDER: { label: 'Fast Responder', variant: 'secondary', color: 'bg-green-100 text-green-800' },
    TRUSTED_VENDOR: { label: 'Trusted Vendor', variant: 'secondary', color: 'bg-blue-100 text-blue-800' },
    PREMIUM_VENDOR: { label: 'Premium Vendor', variant: 'secondary', color: 'bg-purple-100 text-purple-800' },
    PLATINUM_VENDOR: { label: 'Platinum Vendor', variant: 'secondary', color: 'bg-yellow-100 text-yellow-800' },
    HIGHLY_RATED: { label: 'Highly Rated', variant: 'secondary', color: 'bg-green-100 text-green-800' },
    VERIFIED_BUSINESS: { label: 'Verified Business', variant: 'secondary', color: 'bg-indigo-100 text-indigo-800' },
  }

  const config = badgeConfig[badgeType] || { label: badgeType, variant: 'secondary', color: 'bg-gray-100 text-gray-800' }

  return (
    <Badge variant={config.variant as any} className={config.color}>
      {config.label}
    </Badge>
  )
}