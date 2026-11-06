import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/verification-documents', () => ({
  generateSignedDocumentUrl: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { generateSignedDocumentUrl } from '@/lib/verification-documents'

const mockGetPrisma = vi.mocked(getPrisma)
const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGenerateSignedDocumentUrl = vi.mocked(generateSignedDocumentUrl)

function buildMockPrisma() {
  const documents: any[] = []
  const mockPrisma = {
    verificationDocument: {
      findUnique: vi.fn(async ({ where }: any) => documents.find((d) => d.id === where.id) || null),
    },
  }
  return { mockPrisma, documents }
}

describe('GET /api/admin/verification-documents/[documentId]/url', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ctx.documents.push({
      id: 'doc-1',
      documentType: 'ghana_card_front',
      fileName: 'card.jpg',
      applicationId: 'app-1',
    })
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    mockGenerateSignedDocumentUrl.mockReturnValue({
      url: 'https://example.com/signed',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
      token: 'abc',
    })
  })

  it('returns 401 when not an admin', async () => {
    mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
    const { GET } = await import('@/app/api/admin/verification-documents/[documentId]/url/route')
    const request = { url: 'http://localhost/api/admin/verification-documents/doc-1/url' } as any

    const response = await GET(request, { params: { documentId: 'doc-1' } })
    expect(response.status).toBe(403)
    expect(mockGetPrisma).not.toHaveBeenCalled()
  })

  it('returns 404 when document does not exist', async () => {
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)
    const { GET } = await import('@/app/api/admin/verification-documents/[documentId]/url/route')
    const request = { url: 'http://localhost/api/admin/verification-documents/missing/url' } as any

    const response = await GET(request, { params: { documentId: 'missing' } })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Document not found')
    expect(mockGenerateSignedDocumentUrl).not.toHaveBeenCalled()
  })

  it('returns a short-lived signed URL for an admin', async () => {
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)

    const { GET } = await import('@/app/api/admin/verification-documents/[documentId]/url/route')
    const request = { url: 'http://localhost/api/admin/verification-documents/doc-1/url' } as any

    const response = await GET(request, { params: { documentId: 'doc-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockGenerateSignedDocumentUrl).toHaveBeenCalledWith('doc-1')
    expect(data.url).toBe('https://example.com/signed')
    expect(data.document.id).toBe('doc-1')
    expect(data.expiresAt).toBe('2026-01-01T00:15:00.000Z')
  })
})
