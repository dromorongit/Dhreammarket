import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limit store (production should use Redis)
// Key: IP + endpoint, Value: { count, resetTime }
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes
  register: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 registrations per hour
  'forgot-password': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 requests per hour
  'email-verification': { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes
  'otp-resend': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 requests per hour
  'password-reset-new': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 requests per hour
  'reset-password': { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes
  'support-ticket': { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 tickets per hour
  'support-message': { windowMs: 5 * 60 * 1000, maxRequests: 30 }, // 30 messages per 5 minutes
  'admin-support-message': { windowMs: 5 * 60 * 1000, maxRequests: 100 }, // 100 messages per 5 minutes
  'contact-form': { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 contacts per hour
  checkout: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 checkouts per hour
  'payment-verification': { windowMs: 60 * 60 * 1000, maxRequests: 20 }, // 20 verifications per hour
  search: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 searches per minute
  'change-password': { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 minutes
  upload: { windowMs: 60 * 60 * 1000, maxRequests: 30 }, // 30 uploads per hour
  'admin-upload': { windowMs: 60 * 60 * 1000, maxRequests: 50 }, // 50 uploads per hour
  'verification-payment-verify': { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 verifications per hour
  'vendor-verification-apply': { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 applications per hour
  'admin-users': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  'admin-products': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  'admin-orders': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  'admin-service-categories': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  'admin-services': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
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

// Cleanup old entries periodically (production optimization)
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
  }, 60 * 1000)
}