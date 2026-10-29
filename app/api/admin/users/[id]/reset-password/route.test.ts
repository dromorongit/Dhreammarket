import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  authToken: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  session: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

const adminAuthMock = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
}))
vi.mock('@/lib/adminAuth', () => ({
  requireSuperAdmin: adminAuthMock.requireSuperAdmin,
}))

const authMock = vi.hoisted(() => ({
  generateSelector: vi.fn(() => 'sel_x'),
  generateResetSecret: vi.fn(() => 'secret_x'),
  hashResetToken: vi.fn(() => 'hashed_secret_x'),
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}))
vi.mock('@/lib/auth', () => ({
  generateSelector: authMock.generateSelector,
  generateResetSecret: authMock.generateResetSecret,
  hashResetToken: authMock.hashResetToken,
  hashPassword: authMock.hashPassword,
}))

const emailMock = vi.hoisted(() => ({
  sendAdminInitiatedPasswordResetEmail: vi.fn(),
  sendPasswordChangedEmail: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendAdminInitiatedPasswordResetEmail: emailMock.sendAdminInitiatedPasswordResetEmail,
  sendPasswordChangedEmail: emailMock.sendPasswordChangedEmail,
}))

const rateLimitMock = vi.hoisted(() => ({
  rateLimitByKey: vi.fn(),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    rateLimitByKey: rateLimitMock.rateLimitByKey,
  }
})

const auditMock = vi.hoisted(() => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: auditMock.createAuditLog,
}))

import { POST } from '@/app/api/admin/users/[id]/reset-password/route'

const ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' as const }
const TARGET_ID = 'user_1'

const targetUser = (overrides: Record<string, unknown> = {}) => ({
  id: TARGET_ID,
  email: 'user@example.com',
  role: 'CUSTOMER',
  status: 'ACTIVE',
  profile: { firstName: 'Test', lastName: 'User' },
  password: 'existing_hash',
  ...overrides,
})

const unauth = () => NextResponse.json({ error: 'Authentication required' }, { status: 401 })
const forbidden = () => NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })

function buildRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${TARGET_ID}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const PARAMS = { params: Promise.resolve({ id: TARGET_ID }) }

beforeEach(() => {
  vi.clearAllMocks()
  adminAuthMock.requireSuperAdmin.mockResolvedValue(ADMIN)
  rateLimitMock.rateLimitByKey.mockReturnValue({ success: true })
  emailMock.sendAdminInitiatedPasswordResetEmail.mockResolvedValue({ success: true })
  emailMock.sendPasswordChangedEmail.mockResolvedValue({ success: true })

  prismaMock.user.findUnique.mockResolvedValue(targetUser())
  prismaMock.user.update.mockResolvedValue({ id: TARGET_ID })
  prismaMock.authToken.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.authToken.create.mockResolvedValue({ id: 'tok_1' })
  prismaMock.session.updateMany.mockResolvedValue({ count: 2 })
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
})

describe('POST /api/admin/users/[id]/reset-password', () => {
  it('returns 401 when the caller is not authenticated', async () => {
    adminAuthMock.requireSuperAdmin.mockResolvedValue(unauth() as never)

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)

    expect(response.status).toBe(401)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns 403 for a plain ADMIN caller', async () => {
    adminAuthMock.requireSuperAdmin.mockResolvedValue(forbidden() as never)

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)

    expect(response.status).toBe(403)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns the requireSuperAdmin response unchanged', async () => {
    const custom = NextResponse.json({ error: 'custom auth failure' }, { status: 401 })
    adminAuthMock.requireSuperAdmin.mockResolvedValue(custom as never)

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)

    expect(response).toBe(custom)
  })

  it('returns 404 for an unknown target', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('User not found')
  })

  it('returns 400 when the target is the acting admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue(targetUser({ id: ADMIN.userId }))

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(prismaMock.authToken.create).not.toHaveBeenCalled()
  })

  it('returns 403 when the target is a SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue(targetUser({ id: 'user_2', role: 'SUPER_ADMIN' }))

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('SUPER_ADMIN')
  })

  it('rejects unknown mode with 400', async () => {
    const response = await POST(buildRequest({ mode: 'reset' as never }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('mode')
  })

  it('returns 400 for an invalid JSON body', async () => {
    const response = await POST(
      new NextRequest(`http://localhost/api/admin/users/${TARGET_ID}/reset-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
      PARAMS
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid request body')
  })

  it('link mode creates a token, sends the email, expires sessions, and does not touch the password', async () => {
    const response = await POST(
      buildRequest({ mode: 'link' }, { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'test-agent' }),
      PARAMS
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, mode: 'link', emailSent: true })

    expect(prismaMock.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID, tokenType: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
    expect(prismaMock.authToken.create).toHaveBeenCalledWith({
      data: {
        userId: TARGET_ID,
        tokenType: 'PASSWORD_RESET',
        selector: 'sel_x',
        tokenHash: 'hashed_secret_x',
        expiresAt: expect.any(Date),
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
      },
    })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID, isExpired: false },
      data: { isExpired: true, expiredAt: expect.any(Date) },
    })
    expect(emailMock.sendAdminInitiatedPasswordResetEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Test User',
      'sel_x',
      'secret_x',
      expect.any(Date)
    )
  })

  it('link mode returns 502 when email sending fails and does not report success', async () => {
    emailMock.sendAdminInitiatedPasswordResetEmail.mockResolvedValue({ success: false, error: 'Brevo down' })

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBeDefined()
    expect(body.success).toBeUndefined()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(auditMock.createAuditLog).not.toHaveBeenCalled()
  })

  it('link mode skips session expiry when expireSessions is false', async () => {
    await POST(buildRequest({ mode: 'link', expireSessions: false }), PARAMS)

    expect(prismaMock.session.updateMany).not.toHaveBeenCalled()
    expect(emailMock.sendAdminInitiatedPasswordResetEmail).toHaveBeenCalled()
  })

  it('manual mode rejects a weak password with 400', async () => {
    const response = await POST(buildRequest({ mode: 'manual', newPassword: 'weak' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.authToken.create).not.toHaveBeenCalled()
    expect(emailMock.sendPasswordChangedEmail).not.toHaveBeenCalled()
  })

  it('manual mode updates the hash (never plaintext), expires sessions, invalidates tokens, sends the changed email, and never echoes the password', async () => {
    const response = await POST(buildRequest({ mode: 'manual', newPassword: 'Str0ng!Pass' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, mode: 'manual', emailSent: true })
    expect(body).not.toHaveProperty('password')
    expect(JSON.stringify(body)).not.toContain('Str0ng!Pass')

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { password: 'hashed:Str0ng!Pass' },
    })
    expect(prismaMock.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID, tokenType: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID, isExpired: false },
      data: { isExpired: true, expiredAt: expect.any(Date) },
    })
    expect(emailMock.sendPasswordChangedEmail).toHaveBeenCalledWith('user@example.com', 'Test User')
  })

  it('manual mode skips session expiry when expireSessions is false', async () => {
    await POST(buildRequest({ mode: 'manual', newPassword: 'Str0ng!Pass', expireSessions: false }), PARAMS)

    expect(prismaMock.session.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalled()
  })

  it('audit records the acting admin as userId, the target as entityId, and no secrets', async () => {
    await POST(buildRequest({ mode: 'manual', newPassword: 'Str0ng!Pass' }), PARAMS)

    const [auditArg] = auditMock.createAuditLog.mock.calls[0]
    expect(auditArg.userId).toBe(ADMIN.userId)
    expect(auditArg.userRole).toBe('SUPER_ADMIN')
    expect(auditArg.action).toBe('ADMIN_PASSWORD_RESET')
    expect(auditArg.entityType).toBe('USER')
    expect(auditArg.entityId).toBe(TARGET_ID)
    expect(auditArg.ipAddress).toBe('unknown')
    expect(auditArg.userAgent).toBe('unknown')
    expect(auditArg.afterData).toEqual({ mode: 'manual', sessionsExpired: true, emailSent: true })
    expect(JSON.stringify(auditArg.afterData)).not.toContain('Str0ng!Pass')
    expect(JSON.stringify(auditArg.afterData)).not.toContain('secret_x')
  })

  it('rate limit exceeded returns 429', async () => {
    rateLimitMock.rateLimitByKey.mockReturnValue({
      success: false,
      response: NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 }),
    } as never)

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toBe('Too many requests. Please try again later.')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ['ADMIN', 'ACTIVE'],
    ['VENDOR', 'BANNED'],
    ['CUSTOMER', 'DISABLED'],
    ['INFLUENCER', 'SUSPENDED'],
  ])('allows %s target with %s status in link mode', async (role, status) => {
    prismaMock.user.findUnique.mockResolvedValue(targetUser({ role, status }))

    const response = await POST(buildRequest({ mode: 'link' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, mode: 'link', emailSent: true })
  })
})
