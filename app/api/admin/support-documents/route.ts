import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) {
    return auth
  }

  const documents = await getPrisma().supportDocument.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true, slug: true, title: true, status: true, version: true, intent: true,
      authorId: true, reviewerId: true, approvedAt: true, createdAt: true,
    },
  })

  return NextResponse.json({ documents })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) {
    return auth
  }
  const { userId, role } = auth

  const body = (await request.json().catch(() => ({}))) as {
    slug?: string; title?: string; content?: string; intent?: string
  }
  const { slug, title, content, intent } = body

  if (!slug || !title || !content || !intent) {
    return NextResponse.json({ error: 'slug, title, content and intent are required' }, { status: 400 })
  }

  const existing = await getPrisma().supportDocument.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: `A document with slug ${slug} already exists` }, { status: 409 })
  }

  let result: any
  try {
    result = await getPrisma().$transaction(async (tx) => {
      const created = await tx.supportDocument.create({
        data: { slug, title, content, status: 'DRAFT', version: 1, intent, authorId: userId },
      })
      await tx.auditLog.create({
        data: {
          userId,
          userRole: role,
          action: 'SUPPORT_DOCUMENT_CREATED',
          entityType: 'SUPPORT_DOCUMENT',
          entityId: created.id,
          afterData: captureBeforeAfter(null, { ...created, status: 'DRAFT', version: 1 }).afterData,
        },
      })
      return created
    })
  } catch (error) {
    console.error('[SUPPORT DOCUMENT CREATE] Error:', error)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }

  return NextResponse.json({ document: result }, { status: 201 })
}
