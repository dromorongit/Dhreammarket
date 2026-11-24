'use client'

import React from 'react'
import type { TrustTier, TrustTierCriteria } from '@/lib/trust/types'

interface TrustTierBadgeProps {
  tier: TrustTier
  criteria: TrustTierCriteria
  className?: string
}

const tierColors: Record<TrustTier, { bg: string; text: string; border: string }> = {
  New: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  Established: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  Trusted: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
}

const tierLabels: Record<TrustTier, string> = {
  New: 'New',
  Established: 'Established',
  Trusted: 'Trusted',
}

export function TrustTierBadge({ tier, criteria, className = '' }: TrustTierBadgeProps) {
  const colors = tierColors[tier]
  const label = tierLabels[tier]

  const allItems = [
    ...criteria.met.map(item => ({ text: item, met: true })),
    ...criteria.missing.map(item => ({ text: item, met: false })),
  ]

  return (
    <div className="relative inline-flex items-center">
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} ${className}`}
      >
        {label}
      </span>

      {allItems.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 whitespace-normal">
          <div className="font-medium text-slate-200 mb-2">Trust Tier Criteria</div>
          <ul className="space-y-1">
            {allItems.map((item, index) => (
              <li key={index} className="flex items-start gap-1.5">
                <span className={item.met ? 'text-emerald-400 flex-shrink-0 mt-0.5' : 'text-rose-400 flex-shrink-0 mt-0.5'}>
                  {item.met ? '✓' : '✗'}
                </span>
                <span className={item.met ? 'text-slate-100' : 'text-slate-300'}>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default TrustTierBadge