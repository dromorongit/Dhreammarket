import { NextRequest, NextResponse } from 'next/server'

const MAX_RATE_LIMIT_ENTRIES = 10000

// In-memory rate limit store (production should use Redis)
// Key: IP + endpoint, Value: { count, resetTime }
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

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
  checkout: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  'payment-verification': { windowMs: 60 * 60 * 1000, maxRequests: 20 },
  search: { windowMs: 60 * 1000, maxRequests: 60 },
  'change-password': { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  upload: { windowMs: 60 * 60 * 1000, maxRequests: 30 },
  'admin-upload': { windowMs: 60 * 60 * 1000, maxRequests: 50 },
  'verification-payment-verify': { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  'vendor-verification-apply': { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  'admin-users': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-products': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-orders': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-service-categories': { windowMs: 60 * 1000, maxRequests: 100 },
  'admin-services': { windowMs: 60 * 1000, maxRequests: 100 },
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

  if (!record || now > record.resetTime) {
    enforceRateLimitCap()
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    return { success: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs, limit: config.maxRequests }
  }

  if (record.count >= config.maxRequests) {
    return { success: false, remaining: 0, resetTime: record.resetTime, limit: config.maxRequests }
  }

  record.count++
  return { success: true, remaining: config.maxRequests - record.count, resetTime: record.resetTime, limit: config.maxRequests }
}

export function rateLimit(endpoint: keyof typeof RATE_LIMIT_CONFIGS) {
  return function rateLimitMiddleware(request: NextRequest):
    { success: true } | { success: false; response: NextResponse } {
    const clientIP = getClientIP(request)
    const config = RATE_LIMIT_CONFIGS[endpoint]
    const key = `${clientIP}:${endpoint}`

    const result = checkRateLimit(key, config)

    if (!result.success) {
      const response = NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          resetTime: new Date(result.resetTime!).toISOString(),
        },
        { status: 429 }
      )
      response.headers.set('X-RateLimit-Limit', String(result.limit))
      response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', String(result.resetTime))
      response.headers.set('Retry-After', String(Math.ceil((result.resetTime! - Date.now()) / 1000)))
      return { success: false, response }
    }

    return { success: true }
  }
}

let cleanupInterval: NodeJS.Timeout | null = null
if (typeof setInterval !== 'undefined' && !cleanupInterval) {
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    const entries = Array.from(rateLimitStore.entries())
    for (const [key, value] of entries) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key)
      }
    }
    enforceRateLimitCap()
  }, 60 * 1000)
}
