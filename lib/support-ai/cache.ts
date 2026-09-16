import type { SupportEngineConfig } from './types'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class SupportAICache {
  private cache: Map<string, CacheEntry<unknown>>
  private ttl: number
  private maxSize: number

  constructor(config: Partial<SupportEngineConfig> = {}) {
    this.cache = new Map()
    this.ttl = config.cacheTTL ?? 5 * 60 * 1000
    this.maxSize = config.maxCacheSize ?? 200
  }

  private makeKey(prefix: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join('&')
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

let globalCache: SupportAICache | null = null

export function getSupportAICache(config?: SupportEngineConfig): SupportAICache {
  if (!globalCache) {
    globalCache = new SupportAICache(config)
  }
  return globalCache
}

export function resetSupportAICache(): void {
  globalCache = null
}

export const supportAICache = getSupportAICache()
