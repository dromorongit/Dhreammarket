// A small in-memory cache for the vendor sales summary.
//
// The dashboard card, the sales page and the export all read the same
// numbers, and the vendor clicks around a lot. Without a cache every click
// walks the whole period again.
//
// Three rules make the cache safe:
//
//  1. The key holds the STORE, not the user. Two vendors never share an
//     entry, and one vendor with two stores never sees the other store's
//     numbers.
//  2. The entry is dropped after 60 seconds, so the numbers are never more
//     than a minute old.
//  3. Every write that changes the numbers drops the entries of that store
//     right away, so a vendor never sees a number that is already wrong.
//
// The 60 seconds are a floor for how long an entry may LIVE, not how long it
// may be WRONG: a mutation invalidates the store's entries at once, and the
// next read recomputes them.

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
 * What separates the parts of a key.
 *
 * The store id is escaped before it joins the key, so a store id can never
 * contain the separator and two different stores can never build the same
 * key.
 */
const KEY_SEPARATOR = '|'

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
  return [
    encodeURIComponent(storeId),
    accraDayKey(from),
    accraDayKey(to),
    source,
  ].join(KEY_SEPARATOR)
}

/**
 * The prefix every entry of one store starts with.
 *
 * Because the store id is escaped, the prefix of one store can never be the
 * prefix of another one: invalidating "store_a" never touches "store_ab".
 */
function storeKeyPrefix(storeId: string): string {
  return `${encodeURIComponent(storeId)}${KEY_SEPARATOR}`
}

/**
 * Drop every cached summary of one store.
 *
 * Called by every write that changes the numbers the summary reports: a
 * manual sale, a payment confirmation, a status change, a delivery cost
 * edit, a product cost edit and an online order that the vendor marks
 * delivered, cancelled or rejected.
 *
 * Only the entries of THAT store are dropped. Another vendor's numbers are
 * untouched, so one busy shop never throws away another shop's cache.
 *
 * Returns how many entries were dropped.
 */
export function invalidateSalesSummaryCache(storeId: string): number {
  if (!storeId) return 0

  const prefix = storeKeyPrefix(storeId)
  let dropped = 0

  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
      dropped += 1
    }
  }

  return dropped
}

/**
 * Drop the cached summaries of several stores.
 *
 * An order can hold the lines of more than one vendor, so a change to that
 * order touches the cache of every store that sold into it.
 *
 * Returns how many entries were dropped.
 */
export function invalidateSalesSummaryCaches(storeIds: Iterable<string>): number {
  const unique = Array.from(new Set(Array.from(storeIds).filter(Boolean)))

  let dropped = 0
  for (const storeId of unique) {
    dropped += invalidateSalesSummaryCache(storeId)
  }

  return dropped
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
