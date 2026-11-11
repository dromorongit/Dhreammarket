import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'
import { getPrisma } from '../../../../lib/prisma'
import { getServerSession } from '../../../../lib/auth'

vi.mock('../../../../lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('../../../../lib/auth', () => ({ getServerSession: vi.fn() }))

const mockGetPrisma = getPrisma as any
const mockGetServerSession = getServerSession as any

function buildPrisma(over: Record<string, any> = {}) {
  return {
    superAdminSettings: { findFirst: vi.fn(async () => over.settings ?? { id: 's1', supportAiV2Enabled: false }) },
  } as any
}

function get() {
  return GET(new Request('http://localhost/api/support-ai/config'))
}

describe('app/api/support-ai/config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPrisma.mockReturnValue(buildPrisma())
    mockGetServerSession.mockResolvedValue({ userId: 'u-1', role: 'CUSTOMER', sessionId: 's-1' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to v1 and sets Cache-Control no-store', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ mode: 'v1' })
  })

  it('returns v2 when kill switch allows, logged in, and in pilot list', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'true')
    mockGetPrisma.mockReturnValue(buildPrisma({ settings: { id: 's1', supportAiV2Enabled: true } }))
    mockGetServerSession.mockResolvedValue({ userId: 'pilot-1', role: 'CUSTOMER', sessionId: 's-1' })
    vi.stubEnv('SUPPORT_AI_V2_PILOT_USER_IDS', 'pilot-1, pilot-2 ')

    const res = await get()
    expect(await res.json()).toEqual({ mode: 'v2' })
  })

  it('returns v2 when SUPPORT_AI_V2_PILOT_ALL is true', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'true')
    mockGetServerSession.mockResolvedValue({ userId: 'anyone', role: 'CUSTOMER', sessionId: 's-1' })
    vi.stubEnv('SUPPORT_AI_V2_PILOT_ALL', 'true')

    const res = await get()
    expect(await res.json()).toEqual({ mode: 'v2' })
  })

  it('env override off always wins even when flag and pilot allow', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'false')
    mockGetPrisma.mockReturnValue(buildPrisma({ settings: { id: 's1', supportAiV2Enabled: true } }))
    mockGetServerSession.mockResolvedValue({ userId: 'pilot-1', role: 'CUSTOMER', sessionId: 's-1' })
    vi.stubEnv('SUPPORT_AI_V2_PILOT_USER_IDS', 'pilot-1')

    const res = await get()
    expect(await res.json()).toEqual({ mode: 'v1' })
    expect(mockGetPrisma().superAdminSettings.findFirst).not.toHaveBeenCalled()
  })

  it('logged-out visitor is always v1', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'true')
    vi.stubEnv('SUPPORT_AI_V2_PILOT_USER_IDS', 'u-1')
    mockGetServerSession.mockResolvedValue(null)

    const res = await get()
    expect(await res.json()).toEqual({ mode: 'v1' })
  })

  it('prisma error gives v1', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'true')
    mockGetPrisma.mockReturnValue({
      superAdminSettings: { findFirst: vi.fn(async () => { throw new Error('db down') }) },
    } as any)
    mockGetServerSession.mockResolvedValue({ userId: 'u-1', role: 'CUSTOMER', sessionId: 's-1' })

    const res = await get()
    expect(await res.json()).toEqual({ mode: 'v1' })
  })

  it('session error gives v1', async () => {
    vi.stubEnv('SUPPORT_AI_V2_ENABLED', 'true')
    vi.stubEnv('SUPPORT_AI_V2_PILOT_USER_IDS', 'u-1')
    mockGetServerSession.mockRejectedValue(new Error('session down'))

    const res = await get()
    expect(await res.json()).toEqual({ mode: 'v1' })
  })
})
