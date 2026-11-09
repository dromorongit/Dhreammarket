import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { PATCH } from './route'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }))

const mockGetPrisma = getPrisma as any
const mockRequireAdmin = requireAdmin as any

function buildPrisma(over: Record<string, any> = {}) {
  const doc = over.doc === undefined ? {
    id: 'doc-1', slug: 'delivery-info', title: 'Delivery times', content: 'Old content.',
    status: 'DRAFT', version: 1, intent: 'buyer.delivery_info', authorId: 'admin-1',
    reviewerId: null, approvedAt: null, updatedAt: new Date(),
  } : over.doc
  const prisma: any = {
    supportDocument: {
      findUnique: vi.fn(async () => doc),
      update: vi.fn(async (args: any) => ({ ...doc, ...args.data })),
    },
    auditLog: { create: vi.fn(async () => {}) },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return prisma
}

function session(userId: string, role: string) {
  return { userId, role }
}

describe('app/api/admin/support-documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unauthenticated requests are rejected with 401', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    )
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await PATCH(
      new Request('http://localhost/api/admin/support-documents/doc-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title' }),
      }),
      { params: { id: 'doc-1' } },
    )
    expect(res.status).toBe(401)
  })

  it('non-admin users are rejected with 403', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    )
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await PATCH(
      new Request('http://localhost/api/admin/support-documents/doc-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title' }),
      }),
      { params: { id: 'doc-1' } },
    )
    expect(res.status).toBe(403)
  })

  it('editing a DRAFT document applies changes and writes an audit row', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const prisma = buildPrisma({ doc: { id: 'doc-1', slug: 'delivery-info', title: 'Delivery times', content: 'Old content.', status: 'DRAFT', version: 1, intent: 'buyer.delivery_info', authorId: 'admin-1', reviewerId: null, approvedAt: null, updatedAt: new Date() } })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await PATCH(
      new Request('http://localhost/api/admin/support-documents/doc-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Delivery times (updated)', content: 'New delivery content here.' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(200)
    expect(prisma.supportDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ title: 'Delivery times (updated)', content: 'New delivery content here.' }),
    })
    const actions = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)
    expect(actions).toContain('SUPPORT_DOCUMENT_EDITED')
    expect(prisma.auditLog.create.mock.calls[0][0].data.entityType).toBe('SUPPORT_DOCUMENT')
  })

  it('APPROVED/PUBLISHED content is immutable: editing is rejected with 409', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const prisma = buildPrisma({ doc: { id: 'doc-1', slug: 'x', title: 'x', content: 'x', status: 'APPROVED', version: 1, intent: 'x', authorId: 'a', reviewerId: null, approvedAt: null, updatedAt: new Date() } })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await PATCH(
      new Request('http://localhost/api/admin/support-documents/doc-1', {
        method: 'PATCH',
        body: JSON.stringify({ content: 'tampered' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(409)
    expect(prisma.supportDocument.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('a document that does not exist returns 404', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    const prisma = buildPrisma({ doc: null })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await PATCH(
      new Request('http://localhost/api/admin/support-documents/missing', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'x' }),
      }),
      { params: { id: 'missing' } },
    )
    expect(res.status).toBe(404)
  })
})
