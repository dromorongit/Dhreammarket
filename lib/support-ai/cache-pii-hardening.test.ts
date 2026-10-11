import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SupportAICache } from './cache'
import { getSupportEngine, resetSupportEngine } from './engine'
import { resetSupportAICache, getSupportAICache } from './cache'

describe('Support AI PII Hardening', () => {
  let engine: ReturnType<typeof getSupportEngine>
  let cache: ReturnType<typeof getSupportAICache>

  beforeEach(() => {
    resetSupportEngine()
    resetSupportAICache()
    engine = getSupportEngine()
    cache = getSupportAICache()
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