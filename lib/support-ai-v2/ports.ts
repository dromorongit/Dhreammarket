import { getPrisma } from '@/lib/prisma'
import { DocumentStatus } from '@prisma/client'
import { createAuditLog } from '@/lib/audit-log'
import { scanRetrievedText } from './src/security/scan'
import type {
  Actor,
  AuditEvent,
  DraftAnswer,
  EscalationPort,
  GeneratorPort,
  RetrievalSummary,
  RetrieverPort,
  ValidatorPort,
  Violation,
  AuditSink,
} from './src/types'

const APPROVED_STATUSES: DocumentStatus[] = ['APPROVED', 'PUBLISHED']

function mapPriority(priority: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  switch (priority) {
    case 'high':
      return 'HIGH'
    case 'urgent':
      return 'URGENT'
    case 'low':
      return 'LOW'
    default:
      return 'MEDIUM'
  }
}

export function makePorts(actor: Actor) {
  const userId = actor.userId

  const audit: AuditSink = {
    emit: (event: AuditEvent): void => {
      if (!userId) return
      void createAuditLog({
        userId,
        userRole: actor.role,
        action: 'SUPPORT_AI_V2_CHAT',
        entityType: 'SYSTEM',
        entityId: event.traceId,
        afterData: {
          state: event.state,
          reasonCodes: event.reasonCodes,
          intent: event.intent,
          riskLevel: event.riskLevel,
          role: event.role,
          conversationId: event.conversationId,
          confidence: event.confidence,
          retrievalSources: event.retrievalSources,
        },
      })
    },
  }

  const retriever: RetrieverPort = {
    retrieve: async (intent, redactedText): Promise<RetrievalSummary> => {
      const docs = await getPrisma().supportDocument.findMany({
        where: { status: { in: APPROVED_STATUSES }, intent },
        include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
      })

      const conflicts: string[] = []
      if (docs.length > 1) {
        conflicts.push(
          `multiple active documents for intent ${intent}: ${docs.map((d) => `${d.slug} v${d.version}`).join(', ')}`,
        )
      }
      const now = new Date()
      const stale: string[] = []
      for (const d of docs) {
        if (d.reviewDueAt && d.reviewDueAt < now) stale.push(`${d.slug} is due for review`)
      }

      let rows: Array<{ content: string; rank: number }> = []
      try {
        rows = await getPrisma().$queryRawUnsafe<Array<{ content: string; rank: number }>>(
          `SELECT dc."content" AS content, ts_rank_cd(dc."contentSearch", plainto_tsquery($2)) AS rank
           FROM "document_chunks" dc
           JOIN "support_documents" d ON d."id" = dc."documentId"
           WHERE d."status" IN ('APPROVED', 'PUBLISHED')
             AND d."intent" = $1
             AND dc."contentSearch" @@ plainto_tsquery($2)
           ORDER BY rank DESC`,
          intent,
          redactedText,
        )
      } catch {
        rows = []
      }

      const usable = rows.filter((r) => !scanRetrievedText(r.content).block)

      return {
        usableChunkCount: usable.length,
        coverage: Math.min(1, usable.length / 3),
        topChunkScore: rows.length > 0 ? Math.max(0, ...rows.map((r) => r.rank)) : 0,
        conflicts,
        stale,
      }
    },
  }

  const generator: GeneratorPort = {
    generate: async (intent): Promise<DraftAnswer> => {
      const doc = await getPrisma().supportDocument.findFirst({
        where: { status: { in: APPROVED_STATUSES }, intent },
        orderBy: { version: 'desc' },
      })
      if (!doc) {
        throw new Error(`no approved document for intent ${intent}`)
      }
      return { text: `${doc.content}\n\nSource: ${doc.title}` }
    },
  }

  const validator: ValidatorPort = {
    validate: async (draft, intent): Promise<{ ok: boolean; violations: Violation[] }> => {
      const violations: Violation[] = []
      const chunks = await getPrisma().documentChunk.findMany({
        where: { document: { status: { in: APPROVED_STATUSES }, intent } },
        include: { document: { select: { title: true } } },
      })
      const hasVerbatimChunk = chunks.some((c) => draft.text.includes(c.content))
      const hasCitation = chunks.some((c) => draft.text.includes(c.document.title))
      if (!hasVerbatimChunk) violations.push({ code: 'NOT_DOCUMENT_TEXT', detail: 'answer must quote an approved retrieved chunk verbatim' })
      if (!hasCitation) violations.push({ code: 'MISSING_CITATION', detail: 'answer must cite the document title' })
      return { ok: violations.length === 0, violations }
    },
  }

  const escalation: EscalationPort = {
    escalate: async (tag, queueCategory, priority, _templateId, conversationRef, escalationReason): Promise<string> => {
      const ticket = await getPrisma().supportTicket.create({
        data: {
          subject: `Support AI v2: ${tag}`,
          message: `Escalated via support-ai v2. Tag: ${tag}; queue: ${queueCategory}; priority: ${priority}.`,
          type: 'GENERAL',
          status: 'OPEN',
          priority: mapPriority(priority),
          userId: userId ?? undefined,
          ...(conversationRef ? { conversationRef } : {}),
          ...(escalationReason ? { escalationReason } : {}),
        },
      })
      if (userId) {
        void createAuditLog({
          userId,
          userRole: actor.role,
          action: 'SUPPORT_TICKET_CREATED',
          entityType: 'SUPPORT_TICKET',
          entityId: ticket.id,
          afterData: { subject: ticket.subject, type: ticket.type, status: ticket.status },
        })
      }
      return ticket.id
    },
  }

  return { audit, retriever, generator, validator, escalation }
}
