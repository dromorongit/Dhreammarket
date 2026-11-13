import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import { getPrisma } from '../../../../../lib/prisma'
import { getServerSession } from '../../../../../lib/auth'
import { userOwnsConversation } from '@/lib/support-ai-v2/conversation-ownership'

vi.mock('../../../../../lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('../../../../../lib/auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/support-ai-v2/conversation-ownership', async () => {
  const actual = await vi.importActual<typeof import('@/lib/support-ai-v2/conversation-ownership')>(
    '@/lib/support-ai-v2/conversation-ownership',
  )
  return { ...actual, userOwnsConversation: vi.fn() }
})

const mockGetPrisma = getPrisma as any
const mockGetServerSession = getServerSession as any
const mockUserOwnsConversation = userOwnsConversation as any

function buildPrisma() {
  return {
    superAdminSettings: { findFirst: vi.fn(async () => ({ id: 's1', supportAiV2Enabled: true })) },
    supportFeedback: { create: vi.fn(async () => ({ id: 'FB-1' })) },
    auditLog: { create: vi.fn(async () => {}) },
  } as any
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
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'true')
    mockGetPrisma.mockReturnValue(buildPrisma())
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'u-1'))
    mockUserOwnsConversation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when there is no session', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await post('10.0.1.0', { conversationId: 'conv-1', traceId: 'trace-1', helpful: true })
    expect(res.status).toBe(401)
  })

  it('returns 404 when the flag is off or unset', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'false')
    const res = await post('10.0.1.20', { conversationId: 'conv-1', traceId: 'trace-1', helpful: true })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })

    vi.unstubAllEnvs()
    mockGetPrisma.mockReturnValue({
      ...buildPrisma(),
      superAdminSettings: { findFirst: vi.fn(async () => ({ id: 's1', supportAiV2Enabled: false })) },
    })
    const res2 = await post('10.0.1.21', { conversationId: 'conv-1', traceId: 'trace-1', helpful: true })
    expect(res2.status).toBe(404)
    expect(await res2.json()).toEqual({ error: 'Not found' })
  })

  it('works as before when flag is on', async () => {
    const res = await post('10.0.1.22', { conversationId: 'conv-1', traceId: 'trace-1', helpful: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockGetPrisma().supportFeedback.create).toHaveBeenCalledTimes(1)
  })

  it('user B cannot post feedback on user A\'s conversation (404)', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'u-2'))
    mockUserOwnsConversation.mockResolvedValue(false)
    const res = await post('10.0.1.10', { conversationId: 'conv-a', traceId: 'trace-a', helpful: true })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Conversation not found.' })
    expect(mockUserOwnsConversation).toHaveBeenCalledWith('u-2', 'conv-a')
    expect(mockGetPrisma().supportFeedback.create).not.toHaveBeenCalled()
  })

  it('the owner can store feedback and stored userId comes from the session', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'u-1'))
    mockUserOwnsConversation.mockResolvedValue(true)

    const res = await post('10.0.1.1', {
      conversationId: 'conv-1',
      traceId: 'trace-1',
      helpful: true,
      reason: 'Clear answer',
      userId: 'attacker-user',
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
    expect(auditCall.userId).toBe('u-1')
    expect(auditCall.userRole).toBe('CUSTOMER')
    expect(auditCall.afterData).toEqual({ conversationId: 'conv-1', helpful: true })
  })

  it('rejects invalid bodies with 400', async () => {
    const res1 = await post('10.0.1.3', { traceId: 'trace-1', helpful: true })
    expect(res1.status).toBe(400)
    const res2 = await post('10.0.1.4', { conversationId: 'conv-1', traceId: 'trace-1', helpful: 'yes' })
    expect(res2.status).toBe(400)
    const res3 = await post('10.0.1.5', { conversationId: 'conv-1', traceId: 'trace-1', helpful: true, reason: 'x'.repeat(501) })
    expect(res3.status).toBe(400)
  })

  it('rejects invalid ids with 400', async () => {
    const badConversation = await post('10.0.1.6', { conversationId: 'bad id', traceId: 'trace-1', helpful: true })
    expect(badConversation.status).toBe(400)
    const longConversation = await post('10.0.1.7', { conversationId: 'a'.repeat(101), traceId: 'trace-1', helpful: true })
    expect(longConversation.status).toBe(400)
    const badTrace = await post('10.0.1.8', { conversationId: 'conv-1', traceId: 'trace/1', helpful: true })
    expect(badTrace.status).toBe(400)
    expect(mockUserOwnsConversation).not.toHaveBeenCalled()
  })
})
