import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from './route'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }))

const mockGetPrisma = getPrisma as any
const mockRequireAdmin = requireAdmin as any

function buildPrisma(over: Record<string, any> = {}) {
  const doc = over.doc === undefined ? {
    id: 'doc-1', slug: 'delivery-info', title: 'Delivery times', content: 'Delivery content.',
    status: 'APPROVED', version: 1, intent: 'buyer.delivery_info', authorId: 'admin-1',
    reviewerId: 'admin-2', approvedAt: new Date(), updatedAt: new Date(),
  } : over.doc
  const prisma: any = {
    supportDocument: {
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.slug) return over.existing ?? null
        return doc
      }),
      create: vi.fn(async (args: any) => ({ id: 'doc-new', status: 'DRAFT', version: doc.version + 1, ...args.data })),
    },
    auditLog: { create: vi.fn(async () => {}) },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return prisma
}

function session(userId: string, role: string) {
  return { userId, role }
}

describe('app/api/admin/support-documents/[id]/new-version', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unauthenticated requests are rejected with 401', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    )
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/new-version', { method: 'POST' }),
      { params: { id: 'doc-1' } },
    )
    expect(res.status).toBe(401)
  })

  it('only active documents can be versioned', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const prisma = buildPrisma()
    prisma.supportDocument.findUnique.mockResolvedValue({ id: 'doc-1', status: 'DRAFT', version: 1, intent: 'x' })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/new-version', { method: 'POST' }),
      { params: { id: 'doc-1' } },
    )
    expect(res.status).toBe(409)
    expect(prisma.supportDocument.create).not.toHaveBeenCalled()
  })

  it('new version copies a published document into a new DRAFT with version+1 and audits it', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const doc = { id: 'doc-1', slug: 'delivery-info', title: 'Delivery times', content: 'Delivery content.', status: 'PUBLISHED', version: 2, intent: 'buyer.delivery_info', authorId: 'admin-1', reviewerId: 'admin-2', approvedAt: new Date(), updatedAt: new Date() }
    const prisma = buildPrisma({ doc })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/new-version', { method: 'POST' }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(201)
    expect(prisma.supportDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'delivery-info-v3',
        title: 'Delivery times',
        content: 'Delivery content.',
        status: 'DRAFT',
        version: 3,
        intent: 'buyer.delivery_info',
        authorId: 'admin-1',
      }),
    })
    const actions = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)
    expect(actions).toContain('SUPPORT_DOCUMENT_CREATED')
    expect(prisma.auditLog.create.mock.calls[0][0].data.afterData.basedOnDocumentId).toBe('doc-1')
    expect(prisma.auditLog.create.mock.calls[0][0].data.afterData.basedOnVersion).toBe(2)
  })
})
