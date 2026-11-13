import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('jsonwebtoken', () => {
  const sign = vi.fn((payload: any, secret: string) => `signed-token-${payload.documentId}`)
  const verify = vi.fn((token: string, secret: string) => {
    if (token === 'expired-token') throw new Error('TokenExpiredError')
    if (token === 'invalid-token') throw new Error('JsonWebTokenError')
    return { documentId: 'doc-1', exp: Math.floor(Date.now() / 1000) + 900 }
  })
  return { default: { sign, verify }, sign, verify }
})

import { generateSignedDocumentUrl, verifyDocumentToken } from '@/lib/verification-documents'

const ORIGINAL_SECRET = process.env.JWT_SECRET

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret'
  vi.clearAllMocks()
})

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_SECRET
  vi.restoreAllMocks()
})

describe('generateSignedDocumentUrl', () => {
  it('returns a short-lived signed URL containing the document id', () => {
    const nowBefore = Date.now()
    const { url, expiresAt, token } = generateSignedDocumentUrl('doc-1')
    const nowAfter = Date.now()

    expect(token).toBe('signed-token-doc-1')
    expect(url).toContain('/api/verification-documents/download')
    expect(url).toContain('token=signed-token-doc-1')
    expect(expiresAt instanceof Date).toBe(true)
    const diff = expiresAt.getTime() - nowAfter
    expect(diff).toBeGreaterThan(14 * 60 * 1000)
    expect(diff).toBeLessThan(16 * 60 * 1000)
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(nowBefore)
  })

  it('throws when JWT_SECRET is not set', () => {
    const previous = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    expect(() => generateSignedDocumentUrl('doc-1')).toThrow('JWT_SECRET')
    process.env.JWT_SECRET = previous
  })
})

describe('verifyDocumentToken', () => {
  it('returns the document id for a valid token', () => {
    expect(verifyDocumentToken('signed-token-doc-1')).toEqual({ documentId: 'doc-1' })
  })

  it('returns null for an expired token', () => {
    expect(verifyDocumentToken('expired-token')).toBeNull()
  })

  it('returns null for an invalid token', () => {
    expect(verifyDocumentToken('invalid-token')).toBeNull()
  })

  it('returns null when JWT_SECRET is not set', () => {
    const previous = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    expect(verifyDocumentToken('any-token')).toBeNull()
    process.env.JWT_SECRET = previous
  })
})
