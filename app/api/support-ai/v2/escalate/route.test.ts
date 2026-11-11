import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import { getPrisma } from '../../../../../lib/prisma'
import { getServerSession } from '../../../../../lib/auth'

vi.mock('../../../../../lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('../../../../../lib/auth', () => ({ getServerSession: vi.fn() }))

const mockGetPrisma = getPrisma as any
const mockGetServerSession = getServerSession as any

function buildPrisma(over: Record<string, any> = {}) {
  const tickets: any[] = over.tickets ?? []
  return {
    supportTicket: {
      findFirst: vi.fn(async (args: any) => {
        if (!args?.where?.conversationRef) return null
        return tickets.find((t) => t.conversationRef === args.where.conversationRef) ?? null
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
    mockGetPrisma.mockReturnValue(buildPrisma())
    mockGetServerSession.mockResolvedValue(session('CUSTOMER'))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when logged out', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await post('10.0.2.1', { conversationId: 'conv-1' })
    expect(res.status).toBe(401)
  })

  it('creates a ticket via the escalation port and returns the reference', async () => {
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

  it('rejects a missing conversationId with 400', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-4'))
    const res = await post('10.0.2.4', { note: 'hi' })
    expect(res.status).toBe(400)
  })

  it('rejects an empty conversationId with 400', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-4b'))
    const res = await post('10.0.2.4b', { conversationId: '   ' })
    expect(res.status).toBe(400)
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

  it('is idempotent: same conversation escalated twice creates one ticket', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-6'))
    const res1 = await post('10.0.2.6', { conversationId: 'conv-idem', note: 'first' })
    const res2 = await post('10.0.2.7', { conversationId: 'conv-idem', note: 'second' })
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const b1 = await res1.json()
    const b2 = await res2.json()
    expect(b1.reference).toBe(b2.reference)
    expect(mockGetPrisma().supportTicket.create).toHaveBeenCalledTimes(1)
  })

  it('returns 429 when rate limited', async () => {
    mockGetServerSession.mockResolvedValue(session('CUSTOMER', 'esc-u-ratelimit'))
    const ip = '10.0.2.20'
    for (let i = 0; i < 20; i++) {
      expect((await post(ip, { conversationId: `conv-rl-${i}` })).status).toBe(200)
    }
    const res = await post(ip, { conversationId: 'conv-rl-final' })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBe(null)
  })
})
