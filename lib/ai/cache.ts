import type { AIEngine, AIEngineConfig, RecommendationInput, RecommendationResult, TrendingInput, TrendingResult, SimilarInput, SimilarResult, CrossSellInput, CrossSellResult, CustomerInsightsInput, CustomerInsightsResult, VendorInsightsInput, VendorInsightsResult } from './types'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class AICache {
  private cache: Map<string, CacheEntry<unknown>>
  private ttl: number
  private maxSize: number

  constructor(config: AIEngineConfig = {}) {
    this.cache = new Map()
    this.ttl = config.cacheTTL ?? 5 * 60 * 1000
    this.maxSize = config.maxCacheSize ?? 500
  }

  private makeKey(prefix: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params).sort().map(k => `${k}=${JSON.stringify(params[k])}`).join('&')
    return `${prefix}:${sorted}`
  }

  get<T>(prefix: string, params: Record<string, unknown>): T | null {
    const key = this.makeKey(prefix, params)
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  set<T>(prefix: string, params: Record<string, unknown>, data: T): void {
    const key = this.makeKey(prefix, params)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  invalidate(prefix: string): void {
    const keysToDelete: string[] = []
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(`${prefix}:`)) {
        keysToDelete.push(key)
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key)
    }
  }

  invalidateAll(): void {
    this.cache.clear()
  }
}

let globalCache: AICache | null = null

export function getAICache(config?: AIEngineConfig): AICache {
  if (!globalCache) {
    globalCache = new AICache(config)
  }
  return globalCache
}

export function resetAICache(): void {
  globalCache = null
}

export const aiCache = getAICache()

export async function withCache<T>(
  cache: AICache,
  prefix: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cache.get<T>(prefix, params)
  if (cached !== null) return cached
  const data = await fetcher()
  cache.set(prefix, params, data)
  return data
}