import { describe, it, expect } from 'vitest'
import React from 'react'
import { CompactSellerTrustSummary } from './CompactSellerTrustSummary'
import type { SellerTrustProfile } from '@/lib/trust/types'

const reactDomServer = require('react-dom/server')

function makeProfile(overrides?: Partial<SellerTrustProfile>): SellerTrustProfile {
  const base: SellerTrustProfile = {
    identity: { status: 'VERIFIED' },
    tenure: { daysOnPlatform: 42 },
    orders: { completed: 10, lifetimeCompleted: 20 },
    fulfilment: { state: 'OK', counts: { numerator: 9, denominator: 10 }, value: { percentage: 90 } },
    cancellation: { state: 'OK', counts: { numerator: 1, denominator: 10 }, value: { percentage: 10 } },
    delivery: { state: 'OK', counts: { numerator: 8, denominator: 10 }, value: { onTimePercentage: 80, medianDays: 2 } },
    responseRate: { state: 'OK', counts: { numerator: 9, denominator: 10 }, value: { percentage: 90 } },
    sellerFaultReturns: { state: 'SUPPRESSED', band: 'fewer than 5' } as any,
    ratings: { state: 'OK', counts: { numerator: 5, denominator: 5 }, value: { average: 4.5, count: 5 } },
    computedAt: new Date('2025-01-01T00:00:00Z'),
    window: { rollingDays: 90, from: new Date('2024-10-03T00:00:00Z'), to: new Date('2025-01-01T00:00:00Z') },
  }
  return { ...base, ...(overrides ?? {}) }
}

describe('CompactSellerTrustSummary', () => {
  it('shows loading state', () => {
    const html = reactDomServer.renderToString(React.createElement(CompactSellerTrustSummary, { loading: true }))
    expect(html).toContain('Loading trust')
  })

  it('shows error state', () => {
    const html = reactDomServer.renderToString(React.createElement(CompactSellerTrustSummary, { error: true }))
    expect(html).toContain('Trust info unavailable')
  })

  it('renders a custom error message from a failed trust fetch without crashing', () => {
    const html = reactDomServer.renderToString(React.createElement(CompactSellerTrustSummary, { error: 'Trust service unavailable' }))
    expect(html).toContain('Trust service unavailable')
    expect(html).toContain('data-testid="compact-trust-error"')
  })

  it('handles insufficient data as New seller', () => {
    const profile = makeProfile({
      fulfilment: { state: 'INSUFFICIENT_DATA', counts: { numerator: 0, denominator: 2 } },
      orders: { completed: 2, lifetimeCompleted: 2 },
    })
    const html = reactDomServer.renderToString(React.createElement(CompactSellerTrustSummary, { profile }))
    expect(html).toContain('New seller')
    expect(html).not.toContain('Fulfilment 0%')
  })

  it('renders metrics when data sufficient', () => {
    const html = reactDomServer.renderToString(React.createElement(CompactSellerTrustSummary, { profile: makeProfile() }))
    expect(html).toContain('Verified seller')
    expect(html).toContain('Fulfilment 90%')
    expect(html).toContain('On-time 80%')
    expect(html).toContain('Response 90%')
    expect(html).toContain('Rating 4.5 (5 verified purchases)')
    expect(html).toContain('42 days on platform')
  })

  it('renders unverified label', () => {
    const profile = makeProfile({ identity: { status: 'UNVERIFIED' } })
    const html = reactDomServer.renderToString(React.createElement(CompactSellerTrustSummary, { profile }))
    expect(html).toContain('Unverified seller')
  })

  it('renders short line variant', () => {
    const html = reactDomServer.renderToString(React.createElement(CompactSellerTrustSummary, { profile: makeProfile(), variant: 'line' }))
    expect(html).toContain('Verified seller')
    expect(html).toContain('Fulfilment 90%')
  })
})
