import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))
vi.mock('@/lib/cloudinary', () => ({
  uploadKycDocument: vi.fn(),
  isPublicUrl: vi.fn((value: string) => /^https?:\/\//i.test(value ?? '')),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => () => ({ success: true })),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { uploadKycDocument, isPublicUrl } from '@/lib/cloudinary'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockUploadKycDocument = vi.mocked(uploadKycDocument)
const mockIsPublicUrl = vi.mocked(isPublicUrl)

function buildMockPrisma(application: any) {
  const prisma: any = {
    vendorVerificationApplication: {
      findUnique: vi.fn(async () => application),
    },
  }
  return prisma
}

function buildRequest(cookies: Record<string, { value: string }>, formDataEntries: [string, string | File][]) {
  const formData = new FormData()
  for (const [key, value] of formDataEntries) {
    formData.append(key, value)
  }
  return {
    url: 'http://localhost/api/vendor/kyc-upload',
    method: 'POST',
    cookies: { get: (name: string) => cookies[name] },
    formData: async () => formData,
  } as any
}

describe('POST /api/vendor/kyc-upload (private KYC upload)', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 's-1' } as any)
    mockPrisma = buildMockPrisma({ id: 'app-1', vendorId: 'vendor-1' })
    mockGetPrisma.mockReturnValue(mockPrisma as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockVerifyToken.mockResolvedValue({ authenticated: false, reason: 'invalid_token' } as any)
    const { POST } = await import('@/app/api/vendor/kyc-upload/route')
    const response = await POST(buildRequest({ token: { value: '' } }, [['applicationId', 'app-1']]))
    expect(response.status).toBe(401)
  })

  it('returns 403 when the user does not own the application', async () => {
    mockPrisma = buildMockPrisma({ id: 'app-1', vendorId: 'vendor-other' })
    mockGetPrisma.mockReturnValue(mockPrisma as any)
    const { POST } = await import('@/app/api/vendor/kyc-upload/route')
    const response = await POST(buildRequest({ token: { value: 'token' } }, [['applicationId', 'app-1'], ['files', new File([], 'card.jpg', { type: 'image/jpeg' })]]))
    expect(response.status).toBe(403)
  })

  it('uploads KYC documents as private authenticated assets and never returns a public URL', async () => {
    mockUploadKycDocument.mockResolvedValue({
      url: 'kyc/1700000000000-ghana_card_front.jpg',
      publicId: 'kyc/1700000000000-ghana_card_front.jpg',
      resourceType: 'image',
      size: 12345,
    })

    const { POST } = await import('@/app/api/vendor/kyc-upload/route')
    const file = new File([new ArrayBuffer(8)], 'ghana_card_front.jpg', { type: 'image/jpeg' })
    const response = await POST(
      buildRequest({ token: { value: 'token' } }, [
        ['applicationId', 'app-1'],
        ['files', file],
        ['files', new File([new ArrayBuffer(4)], 'certificate.pdf', { type: 'application/pdf' })],
      ])
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.urls).toHaveLength(2)
    for (const doc of data.urls) {
      // The uploaded path must never be a public URL
      expect(isPublicUrl(doc.url)).toBe(false)
      expect(doc.url).not.toMatch(/^https?:\/\//)
      expect(['image', 'raw']).toContain(doc.resourceType)
      expect(doc.publicId).toBe(doc.url)
    }
    expect(mockUploadKycDocument).toHaveBeenCalledTimes(2)
    // type 'authenticated' is exercised by uploadKycDocument; folder points at the KYC folder
    expect(mockUploadKycDocument.mock.calls[0][1]).toBe('dhream-market/verification-documents')
  })

  it('fails and returns no public URL when the upload yields a public URL', async () => {
    mockUploadKycDocument.mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/ghana_card_front.jpg',
      publicId: 'ghana_card_front',
      resourceType: 'image',
      size: 12345,
    })

    const { POST } = await import('@/app/api/vendor/kyc-upload/route')
    const response = await POST(
      buildRequest({ token: { value: 'token' } }, [
        ['applicationId', 'app-1'],
        ['files', new File([new ArrayBuffer(8)], 'card.jpg', { type: 'image/jpeg' })],
      ])
    )
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('public URL')
    expect(JSON.stringify(data)).not.toContain('res.cloudinary.com')
  })

  it('rejects non-KYC file types', async () => {
    const { POST } = await import('@/app/api/vendor/kyc-upload/route')
    const response = await POST(
      buildRequest({ token: { value: 'token' } }, [
        ['applicationId', 'app-1'],
        ['files', new File([new ArrayBuffer(8)], 'script.exe', { type: 'application/octet-stream' })],
      ])
    )
    expect(response.status).toBe(400)
  })
})
