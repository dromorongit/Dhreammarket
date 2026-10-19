import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SALES_SUMMARY_CACHE_MAX_ENTRIES,
  SALES_SUMMARY_CACHE_TTL_MS,
  clearSalesSummaryCache,
  getCachedSalesSummary,
  salesSummaryCacheKey,
  salesSummaryCacheSize,
  setCachedSalesSummary,
} from '@/lib/sales-summary-cache'
import type { SalesSummaryResult } from '@/lib/sales-summary'

function fakeSummary(revenue: number): SalesSummaryResult {
  return {
    currency: 'GHS',
    range: { from: '2026-10-01', to: '2026-10-31', days: 31 },
    source: 'ALL',
    profitLabel: 'Profit before other expenses',
    totals: {
      revenue,
      revenuePesawas: revenue * 100,
      cogs: 0,
      cogsPesawas: 0,
      deliveryCost: 0,
      deliveryCostPesawas: 0,
      profit: revenue,
      profitPesawas: revenue * 100,
      profitLabel: 'Profit before other expenses',
      profitIsExact: true,
      estimated: false,
      estimatedReasons: [],
      orders: 1,
      units: 1,
      items: 1,
      itemsWithCost: 1,
      missingCostItems: 0,
      costCoveragePercent: 100,
      averageOrderValue: revenue,
    },
    bySource: [],
    byChannel: [],
    topProductsByUnits: [],
    topProductsByProfit: [],
    daily: [],
    receivables: {
      amount: 0,
      amountPesawas: 0,
      count: 0,
      oldestAgeDays: 0,
      oldestCreatedAt: null,
      orders: [],
    },
    refunds: {
      amount: 0,
      amountPesawas: 0,
      processedAmount: 0,
      processedAmountPesawas: 0,
      pendingAmount: 0,
      pendingAmountPesawas: 0,
      count: 0,
      orders: [],
    },
    coverage: {
      items: 0,
      itemsWithCost: 0,
      missingCostItems: 0,
      costCoveragePercent: 100,
      missingCostProducts: 0,
    },
  }
}

const FROM = new Date('2026-10-01T00:00:00.000Z')
const TO = new Date('2026-10-31T00:00:00.000Z')

beforeEach(() => {
  clearSalesSummaryCache()
  vi.useRealTimers()
})

describe('the sales summary cache', () => {
  it('keeps an entry for a minute', () => {
    const key = salesSummaryCacheKey('store_1', FROM, TO, 'ALL')
    setCachedSalesSummary(key, fakeSummary(10))
    expect(getCachedSalesSummary(key)?.totals.revenue).toBe(10)

    vi.useFakeTimers()
    vi.advanceTimersByTime(SALES_SUMMARY_CACHE_TTL_MS - 1000)
    expect(getCachedSalesSummary(key)?.totals.revenue).toBe(10)

    vi.advanceTimersByTime(2000)
    expect(getCachedSalesSummary(key)).toBeNull()
  })

  it('never mixes two stores', () => {
    const keyA = salesSummaryCacheKey('store_a', FROM, TO, 'ALL')
    const keyB = salesSummaryCacheKey('store_b', FROM, TO, 'ALL')

    setCachedSalesSummary(keyA, fakeSummary(10))

    expect(getCachedSalesSummary(keyB)).toBeNull()
    expect(getCachedSalesSummary(keyA)?.totals.revenue).toBe(10)
  })

  it('keys the entry by the period and the source', () => {
    const base = salesSummaryCacheKey('store_1', FROM, TO, 'ALL')

    expect(salesSummaryCacheKey('store_1', FROM, TO, 'ALL')).toBe(base)
    expect(salesSummaryCacheKey('store_1', FROM, TO, 'MANUAL')).not.toBe(base)
    expect(
      salesSummaryCacheKey('store_1', new Date('2026-10-02T00:00:00.000Z'), TO, 'ALL'),
    ).not.toBe(base)
  })

  it('drops the oldest entry when it is full', () => {
    for (let index = 0; index < SALES_SUMMARY_CACHE_MAX_ENTRIES; index += 1) {
      setCachedSalesSummary(`key_${index}`, fakeSummary(index))
    }
    expect(salesSummaryCacheSize()).toBe(SALES_SUMMARY_CACHE_MAX_ENTRIES)

    setCachedSalesSummary('key_new', fakeSummary(1))
    expect(salesSummaryCacheSize()).toBe(SALES_SUMMARY_CACHE_MAX_ENTRIES)
    expect(getCachedSalesSummary('key_0')).toBeNull()
    expect(getCachedSalesSummary('key_new')).not.toBeNull()
  })
})
