'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import type { SellerTrustProfile } from '@/lib/trust/types'

export type CompactTrustVariant = 'compact' | 'line'

export interface CompactSellerTrustSummaryProps {
  storeId?: string
  profile?: SellerTrustProfile | null
  loading?: boolean
  error?: boolean | string | null
  storeName?: string
  className?: string
  variant?: CompactTrustVariant
}

function isInsufficient(profile: SellerTrustProfile | null): boolean {
  if (!profile) return true
  return profile.fulfilment?.state === 'INSUFFICIENT_DATA' || (profile.orders?.lifetimeCompleted ?? 0) < 10
}

export function CompactSellerTrustSummary({
  storeId,
  profile,
  loading,
  error,
  storeName,
  className,
  variant = 'compact',
}: CompactSellerTrustSummaryProps) {
  const [data, setData] = useState<SellerTrustProfile | null>(profile ?? null)
  const [isLoading, setIsLoading] = useState<boolean>(!profile && !!storeId)
  const [isError, setIsError] = useState<boolean>(false)

  useEffect(() => {
    if (profile !== undefined) {
      setData(profile ?? null)
      setIsLoading(false)
      setIsError(false)
      return
    }
    if (!storeId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setIsError(false)
    fetch(`/api/trust/sellers/${encodeURIComponent(storeId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setData(json as SellerTrustProfile)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setIsError(true)
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [storeId, profile])

  const loadingState = loading ?? isLoading
  const errorState = Boolean(error ?? isError)
  const errorMessage = typeof error === 'string' ? error : null

  const verified = data?.identity?.status === 'VERIFIED'
  const identityLabel = verified ? 'Verified seller' : 'Unverified seller'
  const insufficient = isInsufficient(data)

  const fulfilmentPct =
    data?.fulfilment?.state === 'OK' && data.fulfilment.value
      ? data.fulfilment.value.percentage
      : null
  const onTimePct =
    data?.delivery?.state === 'OK' && data.delivery.value
      ? data.delivery.value.onTimePercentage
      : null
  const responsePct =
    data?.responseRate?.state === 'OK' && data.responseRate.value
      ? data.responseRate.value.percentage
      : null
  const rating =
    data?.ratings?.state === 'OK' && data.ratings.value
      ? data.ratings.value
      : null
  const daysOnPlatform = data?.tenure?.daysOnPlatform

  const baseClass = className ?? ''

  if (loadingState) {
    return React.createElement(
      'div',
      {
        className: `animate-pulse rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 ${baseClass}`,
        'data-testid': 'compact-trust-loading',
        role: 'status',
        'aria-label': 'Loading trust summary',
      },
      'Loading trust...'
    )
  }

  if (errorState) {
    return React.createElement(
      'div',
      {
        className: `rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 ${baseClass}`,
        'data-testid': 'compact-trust-error',
        role: 'alert',
      },
      errorMessage ?? 'Trust info unavailable'
    )
  }

  if (!data) {
    return React.createElement(
      'div',
      {
        className: `rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 ${baseClass}`,
        'data-testid': 'compact-trust-empty',
      },
      'Trust info unavailable'
    )
  }

  if (variant === 'line') {
    return React.createElement(
      'p',
      {
        className: `text-xs text-slate-600 ${baseClass}`,
        'data-testid': 'compact-trust-line',
      },
      React.createElement(
        'span',
        { className: verified ? 'text-emerald-700 font-medium' : 'text-slate-600' },
        identityLabel
      ),
      ' ... ',
      insufficient
        ? 'New seller'
        : fulfilmentPct != null
          ? `Fulfilment ${fulfilmentPct.toFixed(0)}%`
          : 'New seller'
    )
  }

  const children: any[] = []
  children.push(
    React.createElement(
      'span',
      { className: verified ? 'font-medium text-emerald-700' : 'font-medium text-slate-600' },
      identityLabel
    )
  )
  if (storeName) {
    children.push(React.createElement('span', { className: 'text-slate-500', key: 'store' }, storeName))
  }
  if (insufficient) {
    children.push(React.createElement('span', { className: 'font-medium text-amber-700', key: 'new' }, 'New seller'))
  } else {
    if (fulfilmentPct != null) children.push(React.createElement('span', { className: 'text-slate-700', key: 'f' }, `Fulfilment ${fulfilmentPct.toFixed(0)}%`))
    if (onTimePct != null) children.push(React.createElement('span', { className: 'text-slate-700', key: 'o' }, `On-time ${onTimePct.toFixed(0)}%`))
    if (responsePct != null) children.push(React.createElement('span', { className: 'text-slate-700', key: 'r' }, `Response ${responsePct.toFixed(0)}%`))
    if (rating) {
      children.push(React.createElement('span', { className: 'text-slate-700', key: 'rt' }, `Rating ${rating.average.toFixed(1)} (${rating.count} verified purchases)`))
    } else {
      children.push(React.createElement('span', { className: 'text-slate-500', key: 'nr' }, 'Not enough reviews'))
    }
  }
  if (daysOnPlatform != null) {
    children.push(React.createElement('span', { className: 'text-slate-500', key: 'd' }, `${daysOnPlatform} days on platform`))
  }

  return React.createElement(
    'div',
    {
      className: `rounded-lg border border-slate-200 bg-white px-3 py-2 ${baseClass}`,
      'data-testid': 'compact-trust-summary',
    },
    React.createElement('div', { className: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs' }, ...children)
  )
}

const CompactTrustSummary = CompactSellerTrustSummary
const CompactSellerTrust = CompactSellerTrustSummary
const SellerTrustCompact = CompactSellerTrustSummary
const CompactTrust = CompactSellerTrustSummary
const TrustSummaryCompact = CompactSellerTrustSummary
const BuyerTrustSummary = CompactSellerTrustSummary
const SellerTrustSummary = CompactSellerTrustSummary

export default CompactSellerTrustSummary
export {
  CompactSellerTrustSummary as CompactTrustSummary,
  CompactSellerTrustSummary as CompactSellerTrust,
  CompactSellerTrustSummary as SellerTrustCompact,
  CompactSellerTrustSummary as CompactTrust,
  CompactSellerTrustSummary as TrustSummaryCompact,
  CompactSellerTrustSummary as BuyerTrustSummary,
  CompactSellerTrustSummary as SellerTrustSummary,
}
