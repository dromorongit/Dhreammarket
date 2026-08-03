'use client'

import React from 'react'

interface SponsoredPlacementProps {
  campaignId: string
  campaignTitle: string
  entityId: string
  entityType: 'PRODUCT' | 'SERVICE'
  badge: 'Sponsored' | 'Promoted'
  displayOrder: number
}

export function SponsoredBadge({ badge }: { badge: 'Sponsored' | 'Promoted' }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      {badge}
    </span>
  )
}

export function SponsoredPlacement({
  campaignId,
  campaignTitle,
  entityId,
  entityType,
  badge,
  displayOrder,
}: SponsoredPlacementProps) {
  return (
    <div
      className="relative border rounded-lg p-3 bg-gradient-to-br from-primary/5 to-transparent"
      style={{ order: displayOrder }}
    >
      <div className="absolute top-2 right-2">
        <SponsoredBadge badge={badge} />
      </div>
      <div className="pt-6">
        <p className="text-xs text-muted-foreground mb-1">Sponsored by {campaignTitle}</p>
        <p className="text-sm font-medium">{entityType} #{entityId.slice(0, 8)}</p>
      </div>
    </div>
  )
}