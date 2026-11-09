import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from './route'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }))

const mockGetPrisma = getPrisma as any
const mockRequireAdmin = requireAdmin as any

const PARAGRAPH =
  'Delivery times vary by seller location and shipping method. Standard delivery typically takes 3-7 business days. ' +
  'You will receive tracking information once your order ships. Express delivery is available in major cities. '

function longContent(paragraphs: number): string {
  return Array.from({ length: paragraphs }, () => PARAGRAPH.repeat(9)).join('\n\n')
}

const baseDoc = (over: Record<string, any> = {}) => ({
  id: 'doc-1',
  slug: 'delivery-info',
  title: 'Delivery times',
  content: longContent(2),
  status: 'DRAFT',
  version: 1,
  intent: 'buyer.delivery_info',
  authorId: 'admin-1',
  reviewerId: null,
  approvedAt: null,
  updatedAt: new Date('2026-01-01'),
  ...over,
})

function buildPrisma(over: Record<string, any> = {}) {
  const doc = over.doc === undefined ? baseDoc() : over.doc
  const prisma: any = {
    supportDocument: {
      findUnique: vi.fn(async () => doc),
      findFirst: vi.fn(async () => over.conflict ?? null),
      update: vi.fn(async (args: any) => ({ ...doc, ...args.data })),
    },
    documentChunk: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async (args: any) => args.data),
    },
    auditLog: { create: vi.fn(async () => {}) },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return prisma
}

function session(userId: string, role: string) {
  return { userId, role }
}

describe('app/api/admin/support-documents/[id]/transition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unauthenticated requests are rejected with 401', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    )
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(401)
    expect(mockGetPrisma().supportDocument.findUnique).not.toHaveBeenCalled()
  })

  it('non-admin users are rejected with 403', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    )
    mockGetPrisma.mockReturnValue(buildPrisma())

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(403)
  })

  it('an invalid transition is rejected with 400', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    mockGetPrisma.mockReturnValue(buildPrisma({ doc: baseDoc({ status: 'DRAFT' }) }))

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'PUBLISHED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid transition')
  })

  it('a document that does not exist returns 404', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    mockGetPrisma.mockReturnValue(buildPrisma({ doc: null }))

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/missing/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED' }),
      }),
      { params: { id: 'missing' } },
    )

    expect(res.status).toBe(404)
  })

  it('self-approval by a non-SUPER_ADMIN is blocked with 403', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'ADMIN'))
    mockGetPrisma.mockReturnValue(buildPrisma({ doc: baseDoc({ authorId: 'admin-1' }) }))

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(403)
    expect(mockGetPrisma().supportDocument.update).not.toHaveBeenCalled()
    expect(mockGetPrisma().auditLog.create).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN self-approval override writes SUPPORT_DOCUMENT_SELF_APPROVAL_OVERRIDE', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-1', 'SUPER_ADMIN'))
    const prisma = buildPrisma({ doc: baseDoc({ authorId: 'admin-1', status: 'DRAFT' }) })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(200)
    expect(prisma.supportDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ status: 'APPROVED', reviewerId: 'admin-1', approvedAt: expect.any(Date) }),
    })
    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc-1' } })
    expect(prisma.documentChunk.create).toHaveBeenCalled()

    const actions = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)
    expect(actions).toContain('SUPPORT_DOCUMENT_APPROVED')
    expect(actions).toContain('SUPPORT_DOCUMENT_SELF_APPROVAL_OVERRIDE')
    const override = prisma.auditLog.create.mock.calls.find(
      (c: any) => c[0].data.action === 'SUPPORT_DOCUMENT_SELF_APPROVAL_OVERRIDE',
    )
    expect(override![0].data.userRole).toBe('SUPER_ADMIN')
    expect(override![0].data.afterData.reason).toBe('SUPER_ADMIN self-approval override')
  })

  it('a second active version for the same intent is rejected with 409', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-2', 'ADMIN'))
    const prisma = buildPrisma({
      doc: baseDoc({ authorId: 'admin-3', status: 'DRAFT' }),
      conflict: { id: 'doc-2', status: 'APPROVED', intent: 'buyer.delivery_info' },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(409)
    expect(prisma.supportDocument.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('approval sets approvedAt and reviewerId and creates ordered chunks in one transaction', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-2', 'ADMIN'))
    const prisma = buildPrisma({ doc: baseDoc({ authorId: 'admin-3', status: 'DRAFT', content: longContent(4) }) })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(200)
    expect(prisma.supportDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        reviewerId: 'admin-2',
        approvedAt: expect.any(Date),
      }),
    })
    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc-1' } })

    const creates = prisma.documentChunk.create.mock.calls.map((c: any) => c[0].data)
    expect(creates.length).toBeGreaterThan(1)
    expect(creates.map((c: any) => c.chunkIndex)).toEqual([...Array(creates.length).keys()])
    expect(creates.every((c: any) => c.documentId === 'doc-1')).toBe(true)
    const joined = creates.map((c: any) => c.content).join('\n\n')
    expect(joined).toContain('Delivery times vary by seller location')
    expect(joined.length).toBeGreaterThan(0)

    const actions = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)
    expect(actions).toContain('SUPPORT_DOCUMENT_APPROVED')
    expect(prisma.auditLog.create.mock.calls.some((c: any) => c[0].data.entityType === 'SUPPORT_DOCUMENT')).toBe(true)
  })

  it('publish transition sets reviewerId without overwriting an existing approvedAt', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-2', 'ADMIN'))
    const approvedAt = new Date('2026-01-02')
    const prisma = buildPrisma({
      doc: baseDoc({ authorId: 'admin-3', status: 'APPROVED', approvedAt }),
    })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'PUBLISHED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(200)
    const updateCall = prisma.supportDocument.update.mock.calls[0][0]
    expect(updateCall.data).toEqual(
      expect.objectContaining({ status: 'PUBLISHED', reviewerId: 'admin-2' }),
    )
    expect(updateCall.data).not.toHaveProperty('approvedAt')
  })

  it('retiring a document creates no chunks and writes a RETIRED audit row', async () => {
    mockRequireAdmin.mockResolvedValue(session('admin-2', 'ADMIN'))
    const prisma = buildPrisma({ doc: baseDoc({ authorId: 'admin-3', status: 'APPROVED' }) })
    mockGetPrisma.mockReturnValue(prisma)

    const res = await POST(
      new Request('http://localhost/api/admin/support-documents/doc-1/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'RETIRED' }),
      }),
      { params: { id: 'doc-1' } },
    )

    expect(res.status).toBe(200)
    expect(prisma.supportDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ status: 'RETIRED' }),
    })
    expect(prisma.documentChunk.create).not.toHaveBeenCalled()
    const actions = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.action)
    expect(actions).toContain('SUPPORT_DOCUMENT_RETIRED')
  })
})
