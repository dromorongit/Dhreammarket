import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getPrisma } from '../../../../../lib/prisma'
import { getServerSession } from '../../../../../lib/auth'

vi.mock('../../../../../lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('../../../../../lib/auth', () => ({ getServerSession: vi.fn() }))

const mockGetPrisma = getPrisma as any
const mockGetServerSession = getServerSession as any

function buildPrisma(over: Record<string, any> = {}) {
  const prisma: any = {
    supportFeedback: { create: vi.fn(async () => ({ id: 'FB-1' })) },
    auditLog: { create: vi.fn(async () => {}) },
  }
  return prisma
}

function session(role: string, userId = 'u-1') {
  return { userId, role, sessionId: 's-1' }
}

function post(ip: string, body: any) {
  return POST(
    new Request('http://localhost/api/support-ai/v2/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  )
}

describe('app/api/support-ai/v2/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPrisma.mockReturnValue(buildPrisma())
    mockGetServerSession.mockResolvedValue(session('CUSTOMER'))
  })

  it('stores feedback for an authenticated user', async () => {
    const res = await post('10.0.1.1', {
      conversationId: 'conv-1',
      traceId: 'trace-1',
      helpful: true,
      reason: 'Clear answer',
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const createCall = mockGetPrisma().supportFeedback.create.mock.calls[0][0].data
    expect(createCall.conversationId).toBe('conv-1')
    expect(createCall.traceId).toBe('trace-1')
    expect(createCall.helpful).toBe(true)
    expect(createCall.reason).toBe('Clear answer')
    expect(createCall.userId).toBe('u-1')

    const auditCall = mockGetPrisma().auditLog.create.mock.calls[0][0].data
    expect(auditCall.action).toBe('SUPPORT_FEEDBACK_RECEIVED')
    expect(auditCall.userRole).toBe('CUSTOMER')
    expect(auditCall.afterData).toEqual({ conversationId: 'conv-1', helpful: true })
  })

  it('accepts session-bound feedback without a session', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const res = await post('10.0.1.2', { conversationId: 'conv-2', traceId: 'trace-2', helpful: false })
    expect(res.status).toBe(200)

    const createCall = mockGetPrisma().supportFeedback.create.mock.calls[0][0].data
    expect(createCall.userId).toBeUndefined()
    expect(mockGetPrisma().auditLog.create).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies with 400', async () => {
    const res1 = await post('10.0.1.3', { traceId: 't', helpful: true })
    expect(res1.status).toBe(400)
    const res2 = await post('10.0.1.4', { conversationId: 'c', traceId: 't', helpful: 'yes' })
    expect(res2.status).toBe(400)
    const res3 = await post('10.0.1.5', { conversationId: 'c', traceId: 't', helpful: true, reason: 'x'.repeat(501) })
    expect(res3.status).toBe(400)
  })

  it('rate limit reuses the support-ai-chat config', async () => {
    const ip = '10.0.1.20'
    for (let i = 0; i < 20; i++) {
      expect((await post(ip, { conversationId: 'c', traceId: 't', helpful: true })).status).toBe(200)
    }
    const res = await post(ip, { conversationId: 'c', traceId: 't', helpful: true })
    expect(res.status).toBe(429)
  })
})
