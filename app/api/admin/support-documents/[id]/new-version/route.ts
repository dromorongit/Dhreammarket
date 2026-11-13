import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

const ACTIVE_STATUSES: string[] = ['APPROVED', 'PUBLISHED']

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) {
    return auth
  }
  const { userId, role } = auth

  const { id } = params

  const doc = await getPrisma().supportDocument.findUnique({ where: { id } })
  if (!doc) {
    return NextResponse.json({ error: 'Support document not found' }, { status: 404 })
  }

  // Only active documents can be versioned.
  if (!ACTIVE_STATUSES.includes(doc.status)) {
    return NextResponse.json(
      { error: `Cannot create a new version of a ${doc.status} document` },
      { status: 409 },
    )
  }

  const nextVersion = doc.version + 1
  const slug = `${doc.slug}-v${nextVersion}`

  const existing = await getPrisma().supportDocument.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: `A document with slug ${slug} already exists` }, { status: 409 })
  }

  const now = new Date()
  let result: any
  try {
    result = await getPrisma().$transaction(async (tx) => {
      const created = await tx.supportDocument.create({
        data: {
          slug,
          title: doc.title,
          content: doc.content,
          status: 'DRAFT',
          version: nextVersion,
          intent: doc.intent,
          authorId: userId,
        },
      })
      await tx.auditLog.create({
        data: {
          userId,
          userRole: role,
          action: 'SUPPORT_DOCUMENT_CREATED',
          entityType: 'SUPPORT_DOCUMENT',
          entityId: created.id,
          afterData: {
            ...captureBeforeAfter(doc, { ...created, status: 'DRAFT', version: nextVersion }).afterData,
            basedOnDocumentId: doc.id,
            basedOnVersion: doc.version,
          },
        },
      })
      return created
    })
  } catch (error) {
    console.error('[SUPPORT DOCUMENT NEW VERSION] Error:', error)
    return NextResponse.json({ error: 'New version failed' }, { status: 500 })
  }

  return NextResponse.json({ document: result }, { status: 201 })
}
