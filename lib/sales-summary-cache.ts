// A small in-memory cache for the vendor sales summary.
//
// The dashboard card, the sales page and the export all read the same
// numbers, and the vendor clicks around a lot. Without a cache every click
// walks the whole period again.
//
// Two rules make the cache safe:
//
//  1. The key holds the STORE, not the user. Two vendors never share an
//     entry, and one vendor with two stores never sees the other store's
//     numbers.
//  2. The entry is dropped after 60 seconds, so the numbers are never more
//     than a minute old.

import { accraDayKey, type SalesSummaryResult, type SalesSourceFilter } from '@/lib/sales-summary'

/** How long an entry stays fresh. */
export const SALES_SUMMARY_CACHE_TTL_MS = 60 * 1000

/** How many entries the cache holds before the oldest are dropped. */
export const SALES_SUMMARY_CACHE_MAX_ENTRIES = 200

interface CacheEntry {
  value: SalesSummaryResult
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * The cache key of one summary.
 *
 * The store is the first part of the key, so the cache is scoped per vendor.
 */
export function salesSummaryCacheKey(
  storeId: string,
  from: Date,
  to: Date,
  source: SalesSourceFilter,
): string {
  return `${storeId}|${accraDayKey(from)}|${accraDayKey(to)}|${source}`
}

/**
 * The cached summary, or null when there is none (or it went stale).
 */
export function getCachedSalesSummary(key: string): SalesSummaryResult | null {
  const entry = cache.get(key)
  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }

  // Keep the map in least-recently-used order.
  cache.delete(key)
  cache.set(key, entry)

  return entry.value
}

/**
 * Remember a summary for a minute.
 */
export function setCachedSalesSummary(key: string, value: SalesSummaryResult): void {
  const now = Date.now()

  cache.forEach((entry, entryKey) => {
    if (entry.expiresAt <= now) cache.delete(entryKey)
  })

  cache.delete(key)
  cache.set(key, { value, expiresAt: now + SALES_SUMMARY_CACHE_TTL_MS })

  while (cache.size > SALES_SUMMARY_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/**
 * Drop every entry. Used by the tests.
 */
export function clearSalesSummaryCache(): void {
  cache.clear()
}

/**
 * How many entries the cache holds. Used by the tests.
 */
export function salesSummaryCacheSize(): number {
  return cache.size
}
