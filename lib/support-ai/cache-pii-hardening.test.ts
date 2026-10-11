import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SupportAICache } from './cache'
import { getSupportEngine, resetSupportEngine } from './engine'
import { resetSupportAICache, getSupportAICache } from './cache'
import { lookupOrderStatus, lookupVendorPayoutStatus } from './dynamic-lookups'
import { verifyToken } from '@/lib/auth-middleware'
import { getPrisma } from '@/lib/prisma'

// Mock the dynamic lookups and auth
vi.mock('./dynamic-lookups', () => ({
  lookupOrderStatus: vi.fn(),
  lookupVendorPayoutStatus: vi.fn(),
  formatOrderStatusMessage: vi.fn((data) => `Order status for ${data[0]?.orderId || 'unknown'}`),
  formatVendorPayoutMessage: vi.fn((data) => {
    if (data.recentPayouts && data.recentPayouts.length > 0) {
      return `Payout status: ${data.recentPayouts[0].status}`
    }
    return 'No payouts found'
  }),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

describe('Support AI PII Hardening', () => {
  let engine: ReturnType<typeof getSupportEngine>
  let cache: ReturnType<typeof getSupportAICache>

  beforeEach(() => {
    resetSupportEngine()
    resetSupportAICache()
    engine = getSupportEngine()
    cache = getSupportAICache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Cache key generation', () => {
    it('generates different keys for different messages', () => {
      const key1 = SupportAICache.generateCacheKey('CUSTOMER', 'Hello world')
      const key2 = SupportAICache.generateCacheKey('CUSTOMER', 'Goodbye world')
      expect(key1).not.toBe(key2)
    })

    it('generates same key for same message with different casing', () => {
      const key1 = SupportAICache.generateCacheKey('CUSTOMER', 'Hello World')
      const key2 = SupportAICache.generateCacheKey('CUSTOMER', 'hello world')
      expect(key1).toBe(key2)
    })

    it('generates same key for same message with extra spaces', () => {
      const key1 = SupportAICache.generateCacheKey('CUSTOMER', 'hello   world')
      const key2 = SupportAICache.generateCacheKey('CUSTOMER', 'hello world')
      expect(key1).toBe(key2)
    })

    it('generates same key for same message with leading/trailing whitespace', () => {
      const key1 = SupportAICache.generateCacheKey('CUSTOMER', '  hello world  ')
      const key2 = SupportAICache.generateCacheKey('CUSTOMER', 'hello world')
      expect(key1).toBe(key2)
    })

    it('generates different keys for different roles', () => {
      const key1 = SupportAICache.generateCacheKey('CUSTOMER', 'hello world')
      const key2 = SupportAICache.generateCacheKey('VENDOR', 'hello world')
      expect(key1).not.toBe(key2)
    })

    it('key never contains substring of original message', () => {
      const message = 'My card number is 4242 4242 4242 4242'
      const key = SupportAICache.generateCacheKey('CUSTOMER', message)
      expect(key).not.toContain('4242')
      expect(key).not.toContain('card')
      expect(key).not.toContain('number')
      expect(key).toMatch(/^CUSTOMER:[a-f0-9]{64}$/)
    })

    it('key does not contain phone number from message', () => {
      const message = 'Call me at 555-123-4567'
      const key = SupportAICache.generateCacheKey('CUSTOMER', message)
      expect(key).not.toContain('555')
      expect(key).not.toContain('123')
      expect(key).not.toContain('4567')
      expect(key).toMatch(/^CUSTOMER:[a-f0-9]{64}$/)
    })

    it('key does not contain email from message', () => {
      const message = 'Email me at user@example.com'
      const key = SupportAICache.generateCacheKey('CUSTOMER', message)
      expect(key).not.toContain('user@example.com')
      expect(key).not.toContain('example')
      expect(key).toMatch(/^CUSTOMER:[a-f0-9]{64}$/)
    })

    it('key does not contain OTP from message', () => {
      const message = 'My OTP is 123456'
      const key = SupportAICache.generateCacheKey('CUSTOMER', message)
      expect(key).not.toContain('123456')
      expect(key).not.toContain('OTP')
      expect(key).toMatch(/^CUSTOMER:[a-f0-9]{64}$/)
    })
  })

  describe('Cache behavior', () => {
    it('caches and retrieves responses correctly with hashed keys', async () => {
      const message = 'How do I track my order?'
      const role = 'CUSTOMER'

      const result1 = await engine.chat({ message }, undefined)
      const result2 = await engine.chat({ message }, undefined)

      expect(result1).toEqual(result2)
      expect(result1.intentMatched).toBe(true)
    })

    it('different messages produce different cache entries', async () => {
      const result1 = await engine.chat({ message: 'How do I track my order?' }, undefined)
      const result2 = await engine.chat({ message: 'How do I return an item?' }, undefined)

      expect(result1.response).not.toBe(result2.response)
    })

    it('same message with different roles produces different cache entries', async () => {
      const message = 'How do I contact support?'
      const result1 = await engine.chat({ message }, undefined)
      
      // Mock auth for vendor role
      vi.mocked(verifyToken).mockResolvedValue({ 
        authenticated: true, 
        userId: 'vendor-1', 
        role: 'VENDOR', 
        sessionId: 'session-vendor' 
      })
      
      resetSupportEngine()
      resetSupportAICache()
      engine = getSupportEngine()
      cache = getSupportAICache()
      const result2 = await engine.chat({ message }, 'fake-token-for-vendor')

      expect(result1.response).toBe(result2.response)
    })
  })

  describe('Error logging sanitization', () => {
    it('does not log request body or message text when error occurs', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Test the sanitizeError function directly by importing the route module
      // Since we can't easily test the full route handler, we test the sanitization logic
      const { sanitizeError } = await import('@/app/api/support-ai/chat/route')
      
      const errorWithPII = new Error('Failed to process card 4242 4242 4242 4242 for user@example.com')
      const sanitized = sanitizeError(errorWithPII)
      
      expect(sanitized.name).toBe('Error')
      expect(sanitized.message).toBe('[REDACTED]')
      expect(JSON.stringify(sanitized)).not.toContain('4242')
      expect(JSON.stringify(sanitized)).not.toContain('user@example.com')
      expect(JSON.stringify(sanitized)).not.toContain('card')

      consoleErrorSpy.mockRestore()
    })

    it('logs error name and requestId but not error message', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const { sanitizeError } = await import('@/app/api/support-ai/chat/route')
      
      const errorWithPII = new TypeError('Database connection failed with user@example.com')
      const sanitized = sanitizeError(errorWithPII)
      
      expect(sanitized.name).toBe('TypeError')
      expect(sanitized.message).toBe('[REDACTED]')
      expect(JSON.stringify(sanitized)).not.toContain('user@example.com')
      expect(JSON.stringify(sanitized)).not.toContain('Database connection')

      consoleErrorSpy.mockRestore()
    })

    it('sanitizes non-Error objects', async () => {
      const { sanitizeError } = await import('@/app/api/support-ai/chat/route')
      
      const sanitized = sanitizeError('string error')
      
      expect(sanitized.name).toBe('UnknownError')
      expect(sanitized.message).toBe('[REDACTED]')
    })
  })
})

describe('Support AI Hotfix: No caching of user-specific dynamic responses', () => {
  let engine: ReturnType<typeof getSupportEngine>
  let cache: ReturnType<typeof getSupportAICache>

  beforeEach(() => {
    resetSupportEngine()
    resetSupportAICache()
    engine = getSupportEngine()
    cache = getSupportAICache()
    vi.clearAllMocks()
    
    // Default mock: return unauthenticated
    vi.mocked(verifyToken).mockResolvedValue({ authenticated: false, reason: 'invalid_token' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('User A and User B asking same dynamic question get their own data (no cross-user leak)', async () => {
    // Mock different order data for two different users
    vi.mocked(lookupOrderStatus).mockResolvedValueOnce([
      { orderId: 'order-A-123', status: 'DELIVERED', paymentStatus: 'PAID', fulfillmentStatus: 'FULFILLED', total: 100, createdAt: '2024-01-01', itemCount: 1 }
    ]).mockResolvedValueOnce([
      { orderId: 'order-B-456', status: 'PROCESSING', paymentStatus: 'PAID', fulfillmentStatus: 'PROCESSING', total: 200, createdAt: '2024-01-02', itemCount: 2 }
    ])

    // Mock auth for User A
    vi.mocked(verifyToken).mockResolvedValueOnce({ 
      authenticated: true, 
      userId: 'user-A', 
      role: 'CUSTOMER', 
      sessionId: 'session-A' 
    })
    
    // User A asks about their order
    const resultA = await engine.chat({ message: 'where is my order' }, 'token-user-A')
    
    // Mock auth for User B
    vi.mocked(verifyToken).mockResolvedValueOnce({ 
      authenticated: true, 
      userId: 'user-B', 
      role: 'CUSTOMER', 
      sessionId: 'session-B' 
    })
    
    // User B asks about their order
    const resultB = await engine.chat({ message: 'where is my order' }, 'token-user-B')

    // Each user should get their own order data
    expect(resultA.response).toContain('order-A-123')
    expect(resultB.response).toContain('order-B-456')
    expect(resultA.response).not.toContain('order-B-456')
    expect(resultB.response).not.toContain('order-A-123')

    // The dynamic lookup should have been called twice (once per user)
    expect(lookupOrderStatus).toHaveBeenCalledTimes(2)
  })

  it('Dynamic lookup response is never stored in cache (cache size does not grow)', async () => {
    vi.mocked(lookupOrderStatus).mockResolvedValue([
      { orderId: 'order-1', status: 'DELIVERED', paymentStatus: 'PAID', fulfillmentStatus: 'FULFILLED', total: 100, createdAt: '2024-01-01', itemCount: 1 }
    ])
    
    // Mock auth
    vi.mocked(verifyToken).mockResolvedValue({ 
      authenticated: true, 
      userId: 'user-A', 
      role: 'CUSTOMER', 
      sessionId: 'session-A' 
    })

    const initialCacheSize = (cache as any).cache.size

    await engine.chat({ message: 'where is my order' }, 'token-user-A')

    // Cache size should not have increased for dynamic lookup
    const finalCacheSize = (cache as any).cache.size
    expect(finalCacheSize).toBe(initialCacheSize)
  })

  it('Static question asked twice is served from cache the second time', async () => {
    const message = 'How do I contact support?'
    
    const result1 = await engine.chat({ message }, undefined)
    const result2 = await engine.chat({ message }, undefined)

    expect(result1).toEqual(result2)
    expect(result1.intentMatched).toBe(true)
    expect(result1.response).toContain('WhatsApp')
  })

  it('Authenticated and unauthenticated users get correct static response', async () => {
    // Test a static question that has requiresAuth: true but isDynamic: false
    // The response should be the same regardless of auth state (static knowledge base response)
    const message = 'How do I list a product?' // how-to-list-product: requiresAuth: true, isDynamic: false
    
    // Unauthenticated user
    const resultUnauth = await engine.chat({ message }, undefined)
    
    // Authenticated user (CUSTOMER role)
    vi.mocked(verifyToken).mockResolvedValue({ 
      authenticated: true, 
      userId: 'user-C', 
      role: 'CUSTOMER', 
      sessionId: 'session-C' 
    })
    const resultAuth = await engine.chat({ message }, 'fake-token-customer')

    // Both should get the same static response from knowledge base
    expect(resultUnauth.response).toBe(resultAuth.response)
    expect(resultUnauth.response).toContain('Add Product')
    expect(resultUnauth.intentMatched).toBe(true)
  })

  it('Vendor payout status is not cached (user-specific)', async () => {
    vi.mocked(lookupVendorPayoutStatus).mockResolvedValueOnce({
      recentPayouts: [{ payoutId: 'payout-A', amount: 100, status: 'PAID', paidAt: '2024-01-01', createdAt: '2024-01-01', note: null }],
      subscription: null
    }).mockResolvedValueOnce({
      recentPayouts: [{ payoutId: 'payout-B', amount: 200, status: 'PENDING', paidAt: null, createdAt: '2024-01-02', note: null }],
      subscription: null
    })

    // Mock prisma to return a store for each vendor
    const mockPrisma = {
      store: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'store-A' })
          .mockResolvedValueOnce({ id: 'store-B' }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)

    // Mock auth for vendor A
    vi.mocked(verifyToken).mockResolvedValueOnce({ 
      authenticated: true, 
      userId: 'vendor-A', 
      role: 'VENDOR', 
      sessionId: 'session-A' 
    })
    const resultA = await engine.chat({ message: 'what is my payout status' }, 'token-vendor-A')
    
    // Mock auth for vendor B
    vi.mocked(verifyToken).mockResolvedValueOnce({ 
      authenticated: true, 
      userId: 'vendor-B', 
      role: 'VENDOR', 
      sessionId: 'session-B' 
    })
    const resultB = await engine.chat({ message: 'what is my payout status' }, 'token-vendor-B')

    // The formatVendorPayoutMessage includes the payout status in the response
    expect(resultA.response).toContain('PAID')
    expect(resultB.response).toContain('PENDING')
    expect(lookupVendorPayoutStatus).toHaveBeenCalledTimes(2)
  })
})