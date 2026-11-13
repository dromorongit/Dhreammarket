import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) {
    return auth
  }
  const { userId, role } = auth

  const { id } = params
  const body = (await request.json().catch(() => ({}))) as {
    title?: string; slug?: string; content?: string; intent?: string
  }

  const doc = await getPrisma().supportDocument.findUnique({ where: { id } })
  if (!doc) {
    return NextResponse.json({ error: 'Support document not found' }, { status: 404 })
  }

  // APPROVED/PUBLISHED/RETIRED content is immutable; only DRAFT can be edited.
  if (doc.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Cannot edit a ${doc.status} document; only DRAFT documents are editable` },
      { status: 409 },
    )
  }

  const updates: Record<string, any> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.slug !== undefined) updates.slug = body.slug
  if (body.content !== undefined) updates.content = body.content
  if (body.intent !== undefined) updates.intent = body.intent

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (updates.slug && updates.slug !== doc.slug) {
    const existing = await getPrisma().supportDocument.findUnique({ where: { slug: updates.slug } })
    if (existing) {
      return NextResponse.json({ error: `A document with slug ${updates.slug} already exists` }, { status: 409 })
    }
  }

  const now = new Date()
  const after = { ...doc, ...updates, updatedAt: now }
  let result: any
  try {
    result = await getPrisma().$transaction(async (tx) => {
      const updated = await tx.supportDocument.update({
        where: { id },
        data: { ...updates, updatedAt: now },
      })
      await tx.auditLog.create({
        data: {
          userId,
          userRole: role,
          action: 'SUPPORT_DOCUMENT_EDITED',
          entityType: 'SUPPORT_DOCUMENT',
          entityId: id,
          ...captureBeforeAfter(doc, after),
        },
      })
      return updated
    })
  } catch (error) {
    console.error('[SUPPORT DOCUMENT EDIT] Error:', error)
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }

  return NextResponse.json({ document: result })
}
