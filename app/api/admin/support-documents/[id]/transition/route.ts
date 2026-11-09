import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createAuditLog, captureBeforeAfter, type AuditAction } from '@/lib/audit-log'
import { chunkSupportDocument } from '@/lib/support-documents/chunk'

export const dynamic = 'force-dynamic'

const ALLOWED_TARGETS: Record<string, string[]> = {
  DRAFT: ['APPROVED', 'RETIRED'],
  APPROVED: ['PUBLISHED', 'RETIRED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
}

const ACTIVE_STATUSES: string[] = ['APPROVED', 'PUBLISHED']

function transitionAction(target: string): AuditAction {
  switch (target) {
    case 'APPROVED':
      return 'SUPPORT_DOCUMENT_APPROVED'
    case 'PUBLISHED':
      return 'SUPPORT_DOCUMENT_PUBLISHED'
    case 'RETIRED':
      return 'SUPPORT_DOCUMENT_RETIRED'
    default:
      return 'SUPPORT_DOCUMENT_RETIRED'
  }
}

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
  const body = (await request.json().catch(() => ({}))) as { status?: string }
  const target: string = body.status ?? ''

  const doc = await getPrisma().supportDocument.findUnique({ where: { id } })
  if (!doc) {
    return NextResponse.json({ error: 'Support document not found' }, { status: 404 })
  }

  const targets = ALLOWED_TARGETS[doc.status] ?? []
  if (!targets.includes(target)) {
    return NextResponse.json(
      { error: `Invalid transition from ${doc.status} to ${target || '(none)'}` },
      { status: 400 },
    )
  }

  // An author cannot approve/publish their own document unless a SUPER_ADMIN
  // records an explicit override audit event.
  let selfApprovalOverride = false
  if (doc.authorId && doc.authorId === userId) {
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Self-approval is not allowed' }, { status: 403 })
    }
    selfApprovalOverride = true
  }

  // Exactly one active (APPROVED/PUBLISHED) version per intent.
  if (ACTIVE_STATUSES.includes(target)) {
    const conflict = await getPrisma().supportDocument.findFirst({
      where: {
        intent: doc.intent,
        status: { in: ACTIVE_STATUSES },
        id: { not: id },
      },
    })
    if (conflict) {
      return NextResponse.json(
        { error: `Another active version already exists for intent ${doc.intent}` },
        { status: 409 },
      )
    }
  }

  const now = new Date()
  const becomingActive = ACTIVE_STATUSES.includes(target) && !ACTIVE_STATUSES.includes(doc.status)
  const after: Record<string, any> = { ...doc, status: target, updatedAt: now }
  if (ACTIVE_STATUSES.includes(target)) {
    after.reviewerId = userId
    if (becomingActive) {
      after.approvedAt = now
    }
  }

  let result: any
  try {
    result = await getPrisma().$transaction(async (tx) => {
      const updated = await tx.supportDocument.update({
        where: { id },
        data: {
          status: target,
          ...(ACTIVE_STATUSES.includes(target) ? { reviewerId: userId } : {}),
          ...(becomingActive ? { approvedAt: now } : {}),
          updatedAt: now,
        },
      })

      // Fresh chunks are created only for active documents; RETIRED documents
      // stay out of the retriever because the retriever queries only
      // APPROVED/PUBLISHED statuses.
      if (ACTIVE_STATUSES.includes(target)) {
        await tx.documentChunk.deleteMany({ where: { documentId: id } })
        const chunks = chunkSupportDocument(doc.content)
        for (let i = 0; i < chunks.length; i++) {
          await tx.documentChunk.create({
            data: { documentId: id, chunkIndex: i, content: chunks[i].content },
          })
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          userRole: role,
          action: transitionAction(target),
          entityType: 'SUPPORT_DOCUMENT',
          entityId: id,
          ...captureBeforeAfter(doc, after),
        },
      })

      if (selfApprovalOverride) {
        await tx.auditLog.create({
          data: {
            userId,
            userRole: role,
            action: 'SUPPORT_DOCUMENT_SELF_APPROVAL_OVERRIDE',
            entityType: 'SUPPORT_DOCUMENT',
            entityId: id,
            afterData: {
              reason: 'SUPER_ADMIN self-approval override',
              documentId: id,
              status: target,
              overriddenBy: userId,
            },
          },
        })
      }

      return updated
    })
  } catch (error) {
    console.error('[SUPPORT DOCUMENT TRANSITION] Error:', error)
    return NextResponse.json({ error: 'Transition failed' }, { status: 500 })
  }

  return NextResponse.json({
    message: `Document ${target.toLowerCase()}`,
    document: {
      id: result.id,
      status: result.status,
      version: result.version,
      approvedAt: result.approvedAt,
      reviewerId: result.reviewerId,
    },
  })
}
