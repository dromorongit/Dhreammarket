import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const cookiesMock = {
  get: vi.fn(),
}

vi.mock('next/headers', () => ({ cookies: () => cookiesMock }))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/verification-documents', () => ({
  verifyDocumentToken: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/cloudinary', () => ({
  getSignedDocumentDownloadUrl: vi.fn(() => ({
    url:
      'https://api.cloudinary.com/v1_1/test/download?timestamp=1700000000&public_id=doc-1&type=authenticated&resource_type=image&expires_at=1700000900&signature=abcdef12',
    expiresAt: new Date(1700000900000),
  })),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyDocumentToken } from '@/lib/verification-documents'
import { requireAdmin } from '@/lib/adminAuth'
import { verifyToken } from '@/lib/auth-middleware'
import { getSignedDocumentDownloadUrl } from '@/lib/cloudinary'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyDocumentToken = vi.mocked(verifyDocumentToken)
const mockRequireAdmin = vi.mocked(requireAdmin)
const mockVerifyToken = vi.mocked(verifyToken)
const mockGetSignedDocumentDownloadUrl = vi.mocked(getSignedDocumentDownloadUrl)

const mockCookiesGet = vi.mocked(cookiesMock.get)

function buildMockPrisma(overrides: any = {}) {
  const prisma: any = {
    verificationDocument: {
      findUnique: vi.fn(async (args: any) => overrides.document ?? null),
    },
    verificationAuditLog: {
      create: vi.fn(async () => {}),
    },
  }
  return prisma
}

describe('verification document download (short-lived signed URL)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delivers admin access via a short-lived signed URL, never a permanent public URL', async () => {
    const prisma = buildMockPrisma({
      document: {
        id: 'doc-1',
        documentType: 'national_id',
        fileName: 'id.pdf',
        documentPath: 'private/verification/doc-1.jpg',
        resourceType: 'image',
        createdAt: new Date(),
        applicationId: 'app-1',
        application: { vendorId: 'vendor-other', id: 'app-1' },
      },
    })
    mockGetPrisma.mockReturnValue(prisma as any)
    mockVerifyDocumentToken.mockReturnValue({ documentId: 'doc-1' })
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)

    const { GET } = await import('@/app/api/verification-documents/download/route')
    const request = new URL('http://localhost/api/verification-documents/download?token=valid-token')
    const response = await GET({ url: request.toString() } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.document.id).toBe('doc-1')
    // A real short-lived Cloudinary signed URL is issued for the authenticated asset
    expect(data.url).toContain('signature=')
    expect(data.url).toContain('expires_at=')
    expect(data.expiresAt).toBeDefined()
    // No permanent public URL is ever returned
    expect(data.url).not.toMatch(/res\.cloudinary\.com\/.+\/upload\//)
    expect(data.url).not.toContain('/image/upload/')
    expect(mockGetSignedDocumentDownloadUrl).toHaveBeenCalledWith('private/verification/doc-1.jpg', {
      resourceType: 'image',
    })
    expect(prisma.verificationAuditLog.create).toHaveBeenCalledTimes(1)
  })

  it('allows vendor owner access via signed URL', async () => {
    const prisma = buildMockPrisma({
      document: {
        id: 'doc-1',
        documentType: 'national_id',
        fileName: 'id.pdf',
        documentPath: 'private/verification/doc-1.jpg',
        resourceType: 'raw',
        createdAt: new Date(),
        applicationId: 'app-1',
        application: { vendorId: 'vendor-1', id: 'app-1' },
      },
    })
    mockGetPrisma.mockReturnValue(prisma as any)
    mockVerifyDocumentToken.mockReturnValue({ documentId: 'doc-1' })
    mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    mockCookiesGet.mockReturnValue({ value: 'session-token' })
    mockVerifyToken.mockResolvedValue({
      authenticated: true,
      userId: 'vendor-1',
      role: 'VENDOR',
      sessionId: 'session-1',
    } as any)

    const { GET } = await import('@/app/api/verification-documents/download/route')
    const request = new URL('http://localhost/api/verification-documents/download?token=valid-token')
    const response = await GET({ url: request.toString() } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toContain('signature=')
    expect(data.url).not.toMatch(/res\.cloudinary\.com\/.+\/upload\//)
    expect(mockGetSignedDocumentDownloadUrl).toHaveBeenCalledWith('private/verification/doc-1.jpg', {
      resourceType: 'raw',
    })
  })

  it('returns 403 for a different vendor', async () => {
    const prisma = buildMockPrisma({
      document: {
        id: 'doc-1',
        documentType: 'national_id',
        fileName: 'id.pdf',
        createdAt: new Date(),
        applicationId: 'app-1',
        application: { vendorId: 'vendor-1', id: 'app-1' },
      },
    })
    mockGetPrisma.mockReturnValue(prisma as any)
    mockVerifyDocumentToken.mockReturnValue({ documentId: 'doc-1' })
    mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    mockCookiesGet.mockReturnValue({ value: 'session-token' })
    mockVerifyToken.mockResolvedValue({
      authenticated: true,
      userId: 'vendor-2',
      role: 'VENDOR',
      sessionId: 'session-2',
    } as any)

    const { GET } = await import('@/app/api/verification-documents/download/route')
    const request = new URL('http://localhost/api/verification-documents/download?token=valid-token')
    const response = await GET({ url: request.toString() } as any)

    expect(response.status).toBe(403)
    expect(prisma.verificationAuditLog.create).not.toHaveBeenCalled()
  })

  it('returns 403 for a customer', async () => {
    const prisma = buildMockPrisma({
      document: {
        id: 'doc-1',
        documentType: 'national_id',
        fileName: 'id.pdf',
        createdAt: new Date(),
        applicationId: 'app-1',
        application: { vendorId: 'vendor-1', id: 'app-1' },
      },
    })
    mockGetPrisma.mockReturnValue(prisma as any)
    mockVerifyDocumentToken.mockReturnValue({ documentId: 'doc-1' })
    mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    mockCookiesGet.mockReturnValue({ value: 'session-token' })
    mockVerifyToken.mockResolvedValue({
      authenticated: true,
      userId: 'customer-1',
      role: 'CUSTOMER',
      sessionId: 'session-3',
    } as any)

    const { GET } = await import('@/app/api/verification-documents/download/route')
    const request = new URL('http://localhost/api/verification-documents/download?token=valid-token')
    const response = await GET({ url: request.toString() } as any)

    expect(response.status).toBe(403)
    expect(prisma.verificationAuditLog.create).not.toHaveBeenCalled()
  })

  it('returns 403 when no session cookie', async () => {
    const prisma = buildMockPrisma({
      document: {
        id: 'doc-1',
        documentType: 'national_id',
        fileName: 'id.pdf',
        createdAt: new Date(),
        applicationId: 'app-1',
        application: { vendorId: 'vendor-1', id: 'app-1' },
      },
    })
    mockGetPrisma.mockReturnValue(prisma as any)
    mockVerifyDocumentToken.mockReturnValue({ documentId: 'doc-1' })
    mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    mockCookiesGet.mockReturnValue(undefined)

    const { GET } = await import('@/app/api/verification-documents/download/route')
    const request = new URL('http://localhost/api/verification-documents/download?token=valid-token')
    const response = await GET({ url: request.toString() } as any)

    expect(response.status).toBe(403)
  })

  it('returns 401 for invalid token', async () => {
    mockVerifyDocumentToken.mockReturnValue(null)

    const { GET } = await import('@/app/api/verification-documents/download/route')
    const request = new URL('http://localhost/api/verification-documents/download?token=invalid-token')
    const response = await GET({ url: request.toString() } as any)

    expect(response.status).toBe(401)
  })

  it('returns 404 when document not found', async () => {
    const prisma = buildMockPrisma({ document: null })
    mockGetPrisma.mockReturnValue(prisma as any)
    mockVerifyDocumentToken.mockReturnValue({ documentId: 'doc-missing' })
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)

    const { GET } = await import('@/app/api/verification-documents/download/route')
    const request = new URL('http://localhost/api/verification-documents/download?token=valid-token')
    const response = await GET({ url: request.toString() } as any)

    expect(response.status).toBe(404)
  })
})
