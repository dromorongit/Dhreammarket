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

function buildPrisma(over: Record<string, any> = {}) {
  const tickets: any[] = over.tickets ?? []
  return {
    superAdminSettings: { findFirst: vi.fn(async () => ({ id: 's1', supportAiV2Enabled: true })) },
    supportTicket: {
      findFirst: vi.fn(async (args: any) => {
        const where = args?.where ?? {}
        return (
          tickets.find(
            (t) =>
              t.conversationRef === where.conversationRef &&
              (where.userId === undefined || t.userId === where.userId),
          ) ?? null
        )
      }),
      create: vi.fn(async (data: any) => {
        const id = `T-${tickets.length + 1}-${Date.now()}`
        const ticket = { id, ...data.data }
        tickets.push(ticket)
        return ticket
      }),
    },
    auditLog: { create: vi.fn(async () => {}) },
  } as any
}

function session(role: string, userId = 'u-1') {
  return { userId, role, sessionId: 's-1' }
}

function post(ip: string, body: any) {
  return POST(
    new Request('http://localhost/api/support-ai/v2/escalate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  )
}

describe('app/api/support-ai/v2/escalate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'true')
    mockGetPrisma.mockReturnValue(buildPrisma())
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-1'))
    mockUserOwnsConversation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when logged out', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await post('10.0.2.1', { conversationId: 'conv-1' })
    expect(res.status).toBe(401)
  })

  it('returns 404 when the flag is off or unset', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'false')
    const res = await post('10.0.2.20', { conversationId: 'conv-1' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })

    vi.unstubAllEnvs()
    mockGetPrisma.mockReturnValue({
      ...buildPrisma(),
      superAdminSettings: { findFirst: vi.fn(async () => ({ id: 's1', supportAiV2Enabled: false })) },
    })
    const res2 = await post('10.0.2.21', { conversationId: 'conv-1' })
    expect(res2.status).toBe(404)
    expect(await res2.json()).toEqual({ error: 'Not found' })
  })

  it('works as before when flag is on', async () => {
    const res = await post('10.0.2.22', { conversationId: 'conv-1', note: 'Please help' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.reference).toBe('string')
    expect(mockGetPrisma().supportTicket.create).toHaveBeenCalledTimes(1)
  })

  it('user B cannot escalate or read the ticket reference for user A\'s conversation (404)', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'u-b'))
    mockUserOwnsConversation.mockResolvedValue(false)
    const res = await post('10.0.2.10', { conversationId: 'conv-a', note: 'Please help' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Conversation not found.' })
    expect(mockUserOwnsConversation).toHaveBeenCalledWith('u-b', 'conv-a')
    expect(mockGetPrisma().supportTicket.findFirst).not.toHaveBeenCalled()
    expect(mockGetPrisma().supportTicket.create).not.toHaveBeenCalled()
  })

  it('the owner gets one ticket and the same reference on a repeat call; idempotency lookup is user-scoped', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-6'))
    const res1 = await post('10.0.2.6', { conversationId: 'conv-idem', note: 'first' })
    const res2 = await post('10.0.2.7', { conversationId: 'conv-idem', note: 'second' })
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const b1 = await res1.json()
    const b2 = await res2.json()
    expect(b1.reference).toBe(b2.reference)
    expect(mockGetPrisma().supportTicket.create).toHaveBeenCalledTimes(1)
    expect(mockGetPrisma().supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationRef: 'conv-idem', userId: 'esc-u-6' },
      }),
    )
  })

  it('creates a ticket and returns the reference for the owner', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-1'))
    const res = await post('10.0.2.2', { conversationId: 'conv-1', note: 'Please help' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reference).toBeDefined()
    expect(typeof body.reference).toBe('string')

    const createCall = mockGetPrisma().supportTicket.create.mock.calls[0][0].data
    expect(createCall.conversationRef).toBe('conv-1')
    expect(createCall.escalationReason).toBe('Please help')
    expect(createCall.subject).toBe('Support AI v2: USER_REQUEST')
    expect(createCall.userId).toBe('esc-u-1')
  })

  it('redacts the note through the core redactor before storing', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-2'))
    await post('10.0.2.3', { conversationId: 'conv-2', note: 'my otp is 123456 and card 4111111111111111' })
    const createCall = mockGetPrisma().supportTicket.create.mock.calls[0][0].data
    expect(createCall.escalationReason).not.toContain('123456')
    expect(createCall.escalationReason).not.toContain('4111111111111111')
    expect(createCall.escalationReason).toContain('[OTP_REDACTED]')
    expect(createCall.escalationReason).toContain('[CARD_REDACTED]')
  })

  it('rejects invalid conversationId with 400', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-4'))
    expect((await post('10.0.2.4', { note: 'hi' })).status).toBe(400)
    expect((await post('10.0.2.4b', { conversationId: '   ' })).status).toBe(400)
    expect((await post('10.0.2.4c', { conversationId: 'bad id' })).status).toBe(400)
    expect((await post('10.0.2.4d', { conversationId: 'a'.repeat(101) })).status).toBe(400)
    expect(mockUserOwnsConversation).not.toHaveBeenCalled()
  })

  it('rejects a note longer than 500 characters with 400', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-5'))
    const res = await post('10.0.2.5', { conversationId: 'conv-5', note: 'x'.repeat(501) })
    expect(res.status).toBe(400)
  })

  it('accepts a note of exactly 500 characters', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-5b'))
    const res = await post('10.0.2.5b', { conversationId: 'conv-5b', note: 'x'.repeat(500) })
    expect(res.status).toBe(200)
  })
})
