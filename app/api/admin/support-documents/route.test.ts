import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { GET, POST } from './route'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }))

const mockGetPrisma = getPrisma as any
const mockRequireAdmin = requireAdmin as any

function buildPrisma(over: Record<string, any> = {}) {
  const prisma: any = {
    supportDocument: {
      findMany: vi.fn(async () => over.docs ?? []),
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.slug) return over.existing ?? null
        return over.doc ?? null
      }),
      create: vi.fn(async (args: any) => ({
        id: 'doc-new',
        status: 'DRAFT',
        version: 1,
        ...args.data,
      })),
    },
    auditLog: { create: vi.fn(async () => {}) },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return prisma
}

function session(userId: string, role: string) {
  return { userId, role }
}

describe('app/api/admin/support-documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unauthenticated requests are rejected with 401', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    )
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await GET(new Request('http://localhost/api/admin/support-documents'))
    expect(res.status).toBe(401)
  })

  it('non-admin users are rejected with 403', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    )
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents', {
        method: 'POST',
        body: JSON.stringify({ slug: 'x', title: 'x', content: 'x', intent: 'x' }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it('GET lists support documents for admins', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const docs = [
      { id: 'd1', slug: 'delivery-info', title: 'Delivery', status: 'APPROVED', version: 1, intent: 'buyer.delivery_info', authorId: 'a', reviewerId: null, approvedAt: null, createdAt: new Date() },
    ]
    mockGetPrisma.mockReturnValue(buildPrisma({ docs }))

    const res = await GET(new Request('http://localhost/api/admin/support-documents'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.documents).toHaveLength(1)
    expect(body.documents[0]).toMatchObject({
      id: 'd1', slug: 'delivery-info', title: 'Delivery', status: 'APPROVED', version: 1, intent: 'buyer.delivery_info',
    })
    expect(typeof body.documents[0].createdAt).toBe('string')
  })

  it('POST creates a DRAFT document and writes an audit row', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const prisma = buildPrisma()
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'payment-methods-info',
          title: 'Payment methods',
          content: 'We accept cards and mobile money.',
          intent: 'buyer.payment_methods_info',
        }),
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.document.status).toBe('DRAFT')
    expect(body.document.version).toBe(1)
    expect(body.document.authorId).toBe('admin-1')
    expect(prisma.supportDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'payment-methods-info',
        title: 'Payment methods',
        content: 'We accept cards and mobile money.',
        status: 'DRAFT',
        version: 1,
        intent: 'buyer.payment_methods_info',
        authorId: 'admin-1',
      }),
    })
    const actions = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)
    expect(actions).toContain('SUPPORT_DOCUMENT_CREATED')
    expect(prisma.auditLog.create.mock.calls[0][0].data.entityType).toBe('SUPPORT_DOCUMENT')
  })

  it('POST rejects missing fields with 400', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents', {
        method: 'POST',
        body: JSON.stringify({ slug: 'x' }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('POST rejects a duplicate slug with 409', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const prisma = buildPrisma({ existing: { id: 'd1', slug: 'delivery-info' } })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents', {
        method: 'POST',
        body: JSON.stringify({ slug: 'delivery-info', title: 'x', content: 'x', intent: 'x' }),
      }),
    )
    expect(res.status).toBe(409)
    expect(prisma.supportDocument.create).not.toHaveBeenCalled()
  })
})
