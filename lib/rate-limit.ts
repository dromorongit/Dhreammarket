import { NextRequest, NextResponse } from 'next/server'
import { logInfo } from './logger'

const MAX_RATE_LIMIT_ENTRIES = 10000

const globalForRateLimit = globalThis as unknown as {
  cleanupInterval: NodeJS.Timeout | null
  cleanupHandlersRegistered: boolean
}

// In-memory rate limit store (production should use Redis)
// Key: IP + endpoint, Value: { count, resetTime }
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

type RateLimitStoreName = 'memory' | 'redis'

function getRateLimitStore(): RateLimitStoreName {
  const value = process.env.RATE_LIMIT_STORE
  if (value === 'redis') return value
  return 'memory'
}

type RedisClient = { incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<number> } | null

let redisClientPromise: Promise<RedisClient> | null = null

async function getRedisClient(): Promise<RedisClient> {
  if (redisClientPromise) return redisClientPromise
  redisClientPromise = (async (): Promise<RedisClient> => {
    const store = getRateLimitStore()
    if (store === 'memory') return null
    try {
      if (store === 'redis') {
        const url = process.env.REDIS_URL
        if (!url) return null
        const m = await import('ioredis')
        const client = new m.default(url)
        return {
          incr: (key: string) => client.incr(key),
          expire: (key: string, seconds: number) => client.expire(key, seconds),
        }
      }
    } catch (error) {
      console.warn(`Rate limit store "${store}" unavailable; falling back to in-memory`, error)
    }
    return null
  })()
  return redisClientPromise
}

async function reconcileRateLimitToRedis(
  key: string,
  config: RateLimitConfig,
): Promise<void> {
  const client = await getRedisClient()
  if (!client) return
  const redisKey = `ratelimit:${key}`
  const count = await client.incr(redisKey)
  if (count === 1) {
    await client.expire(redisKey, Math.ceil(config.windowMs / 1000))
  }
}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  register: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  'forgot-password': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  'email-verification': { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  'otp-resend': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  'password-reset-new': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  'reset-password': { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  'support-ticket': { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  'support-message': { windowMs: 5 * 60 * 1000, maxRequests: 30 },
  'admin-support-message': { windowMs: 5 * 60 * 1000, maxRequests: 100 },
  'contact-form': { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  'waitlist': { windowMs: 60 * 1000, maxRequests: 5 },
  checkout: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  'payment-verification': { windowMs: 60 * 60 * 1000, maxRequests: 20 },
  search: { windowMs: 60 * 1000, maxRequests: 60 },
  'change-password': { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  'admin-reset-password': { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  upload: { windowMs: 60 * 60 * 1000, maxRequests: 30 },
  'admin-upload': { windowMs: 60 * 60 * 1000, maxRequests: 50 },
  'verification-payment-verify': { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  'vendor-verification-apply': { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  'vendor-customers': { windowMs: 60 * 1000, maxRequests: 60 },
  'manual-orders': { windowMs: 60 * 1000, maxRequests: 30 },
  'receipt-page': { windowMs: 60 * 1000, maxRequests: 60 },
  'admin-users': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-products': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-orders': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-service-categories': { windowMs: 60 * 1000, maxRequests: 100 },
  review: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
  'admin-services': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-advertisements': { windowMs: 60 * 1000, maxRequests: 100 },
  'support-ai-chat': { windowMs: 60 * 1000, maxRequests: 20 },
  'support-stream': { windowMs: 60 * 1000, maxRequests: 5 },
  'admin-support-stream': { windowMs: 60 * 1000, maxRequests: 10 },
  'vendor-sales-summary': { windowMs: 60 * 1000, maxRequests: 30 },
  'vendor-sales-export': { windowMs: 60 * 1000, maxRequests: 5 },
}

function enforceRateLimitCap(): void {
  if (rateLimitStore.size <= MAX_RATE_LIMIT_ENTRIES) return

  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())

  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }

  if (rateLimitStore.size > MAX_RATE_LIMIT_ENTRIES) {
    const remaining = rateLimitStore.size - MAX_RATE_LIMIT_ENTRIES
    const keys = Array.from(rateLimitStore.keys())
    for (let i = 0; i < remaining && i < keys.length; i++) {
      rateLimitStore.delete(keys[i])
    }
  }
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfIP = request.headers.get('cf-connecting-ip')

  if (cfIP) return cfIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0].trim()

  return request.headers.get('host') || 'unknown'
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; remaining?: number; resetTime?: number; limit?: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  let result: { success: boolean; remaining?: number; resetTime?: number; limit?: number }
  if (!record || now > record.resetTime) {
    enforceRateLimitCap()
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    result = { success: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs, limit: config.maxRequests }
  } else if (record.count >= config.maxRequests) {
    result = { success: false, remaining: 0, resetTime: record.resetTime, limit: config.maxRequests }
  } else {
    record.count++
    result = { success: true, remaining: config.maxRequests - record.count, resetTime: record.resetTime, limit: config.maxRequests }
  }

  // Reconcile to the Redis-backed store without blocking the response; the
  // in-memory result is authoritative for this request so call sites are
  // unchanged regardless of the configured store.
  ;(async () => {
    try {
      await reconcileRateLimitToRedis(key, config)
    } catch {
      // best-effort; fall back to in-memory
    }
  })()

  return result
}

function rateLimitResponse(
  result: { success: false; remaining?: number; resetTime?: number; limit?: number }
): { success: false; response: NextResponse } {
  const response = NextResponse.json(
    {
      error: 'Too many requests. Please try again later.',
      resetTime: new Date(result.resetTime!).toISOString(),
    },
    { status: 429 }
  )
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', String(result.resetTime!))
      response.headers.set('Retry-After', String(Math.ceil((result.resetTime! - Date.now()) / 1000)))
  return { success: false, response }
}

export function rateLimitByKey(
  key: string,
  config: RateLimitConfig
): { success: true } | { success: false; response: NextResponse } {
  const result = checkRateLimit(key, config)
    if (!result.success) {
      return rateLimitResponse(result as { success: false; remaining: 0; resetTime: number; limit: number })
    }
  return { success: true }
}

export function rateLimit(endpoint: keyof typeof RATE_LIMIT_CONFIGS, userId?: string) {
  return function rateLimitMiddleware(request: NextRequest):
    { success: true } | { success: false; response: NextResponse } {
    const config = RATE_LIMIT_CONFIGS[endpoint]
    // Authenticated requests are limited per user so a shared IP (NAT, office,
    // Wi-Fi) cannot throttle one customer because of another's traffic.
    // Unauthenticated routes keep the IP based key below.
    const key = userId ? `${userId}:${endpoint}` : `${getClientIP(request)}:${endpoint}`

    return rateLimitByKey(key, config)
  }
}

function cleanupExpiredEntries(): void {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
  enforceRateLimitCap()
}

function registerCleanupInterval(): void {
  if (process.env.NODE_ENV === 'test') return
  if (globalForRateLimit.cleanupHandlersRegistered) {
    globalForRateLimit.cleanupInterval ??= setInterval(cleanupExpiredEntries, 60 * 1000)
    return
  }

  if (typeof setInterval !== 'undefined') {
    globalForRateLimit.cleanupInterval = setInterval(cleanupExpiredEntries, 60 * 1000).unref()
  }

  const gracefulShutdown = () => {
    if (globalForRateLimit.cleanupInterval) {
      clearInterval(globalForRateLimit.cleanupInterval)
      globalForRateLimit.cleanupInterval = null
    }
  }

  if (typeof process !== 'undefined') {
    process.on('SIGTERM', gracefulShutdown)
    process.on('SIGINT', gracefulShutdown)
    globalForRateLimit.cleanupHandlersRegistered = true
    logInfo('Graceful shutdown handlers registered for rate-limit cleanup')
  }
}

export function rateLimitStoreNeedsWarning(nodeEnv: string | undefined, store: RateLimitStoreName): boolean {
  return nodeEnv === 'production' && store === 'memory'
}

export function logRateLimitStoreWarning(nodeEnv?: string): void {
  const env = nodeEnv ?? process.env.NODE_ENV
  if (rateLimitStoreNeedsWarning(env, getRateLimitStore())) {
    console.warn(
      'RATE_LIMIT_STORE is unset or "memory" in production; rate limits are kept in memory and will not be shared across instances',
    )
  }
}

logRateLimitStoreWarning()

if (typeof globalThis !== 'undefined') {
  registerCleanupInterval()
}
