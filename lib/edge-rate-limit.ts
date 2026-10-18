type RateLimitRecord = {
  count: number
  resetTime: number
}

const MAX_ENTRIES = 10000
const SWEEP_THRESHOLD = 5000

const store = new Map<string, RateLimitRecord>()

export function checkEdgeRateLimit(
  key: string,
  config: { windowMs: number; maxRequests: number },
  now: number = Date.now()
): {
  success: boolean
  remaining?: number
  resetTime?: number
  limit?: number
} {
  const record = store.get(key)

  if (!record || now > record.resetTime) {
    if (store.size > SWEEP_THRESHOLD) {
      for (const entryKey of Array.from(store.keys())) {
        const entryValue = store.get(entryKey)
        if (entryValue && now > entryValue.resetTime) {
          store.delete(entryKey)
        }
      }
    }

    if (!store.has(key) && store.size >= MAX_ENTRIES) {
      const oldestKey = store.keys().next().value
      if (oldestKey !== undefined) {
        store.delete(oldestKey)
      }
    }

    const resetTime = now + config.windowMs
    store.set(key, { count: 1, resetTime })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime,
      limit: config.maxRequests,
    }
  }

  if (record.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      limit: config.maxRequests,
    }
  }

  record.count += 1
  return {
    success: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
    limit: config.maxRequests,
  }
}

export function getEdgeClientIP(headers: Headers): string {
  const cfIP = headers.get('cf-connecting-ip')
  if (cfIP) return cfIP

  const realIP = headers.get('x-real-ip')
  if (realIP) return realIP

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const firstEntry = forwarded.split(',')[0].trim()
    if (firstEntry) return firstEntry
  }

  return 'unknown'
}
