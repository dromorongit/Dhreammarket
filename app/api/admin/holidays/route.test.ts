import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))
vi.mock('@/lib/adminAuth', () => ({
  requireSuperAdmin: vi.fn(),
}))
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'

const mockGetPrisma = vi.mocked(getPrisma)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)
const mockCreateAuditLog = vi.mocked(createAuditLog)

function buildMockPrisma() {
  let holidays: string[] = []
  const mockPrisma = {
    platformPolicy: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === 'singleton') {
          return { id: 'singleton', holidayList: [...holidays], systemCutoverTimestamp: null }
        }
        return null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        if (where.id === 'singleton' && Array.isArray(data.holidayList)) {
          holidays = [...data.holidayList]
        }
        return { id: 'singleton', holidayList: [...holidays] }
      }),
    },
  }
  return { mockPrisma, holidays: () => holidays }
}

const SUPER_ADMIN = { userId: 'sa-1', role: 'SUPER_ADMIN' as const }

describe('POST /api/admin/holidays', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    mockRequireSuperAdmin.mockResolvedValue(SUPER_ADMIN as any)
    mockCreateAuditLog.mockResolvedValue(undefined)
  })

  const request = (body: any) =>
    new Request('http://localhost/api/admin/holidays', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as any

  it('rejects non-SUPER_ADMIN with 403', async () => {
    mockRequireSuperAdmin.mockResolvedValue(
      NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
    )
    const { POST } = await import('@/app/api/admin/holidays/route')
    const res = await POST(request({ date: '2026-12-25', action: 'add' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid dates', async () => {
    const { POST } = await import('@/app/api/admin/holidays/route')
    for (const body of [
      { date: '2026-13-01', action: 'add' },
      { date: 'not-a-date', action: 'add' },
      { date: '2026-1-5', action: 'add' },
      { date: '2026-12-25', action: 'bogus' },
    ]) {
      const res = await POST(request(body))
      expect(res.status).toBe(400)
    }
  })

  it('rejects duplicate dates', async () => {
    const { POST } = await import('@/app/api/admin/holidays/route')
    await POST(request({ date: '2026-12-25', action: 'add' }))
    const res = await POST(request({ date: '2026-12-25', action: 'add' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('already')
  })

  it('adds a date, sorts the list, and writes an audit log', async () => {
    const { POST, GET } = await import('@/app/api/admin/holidays/route')
    await POST(request({ date: '2026-12-25', action: 'add' }))
    await POST(request({ date: '2026-01-01', action: 'add' }))
    await POST(request({ date: '2026-06-15', action: 'add' }))

    const getRes = await GET(
      new Request('http://localhost/api/admin/holidays') as any
    )
    expect(getRes.status).toBe(200)
    const getJson = await getRes.json()
    expect(getJson.holidayList).toEqual(['2026-01-01', '2026-06-15', '2026-12-25'])

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(3)
    const last = mockCreateAuditLog.mock.calls[0][0]
    expect(last.action).toBe('HOLIDAY_LIST_UPDATED')
    expect(last.userRole).toBe('SUPER_ADMIN')
    expect(last.entityType).toBe('SYSTEM')
  })

  it('removes a date and writes an audit log', async () => {
    const { POST } = await import('@/app/api/admin/holidays/route')
    await POST(request({ date: '2026-12-25', action: 'add' }))
    await POST(request({ date: '2026-01-01', action: 'add' }))
    const res = await POST(request({ date: '2026-01-01', action: 'remove' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.holidayList).toEqual(['2026-12-25'])
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(3)
  })
})

describe('GET /api/admin/holidays', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
    mockRequireSuperAdmin.mockResolvedValue(SUPER_ADMIN as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireSuperAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    )
    const { GET } = await import('@/app/api/admin/holidays/route')
    const res = await GET(new Request('http://localhost/api/admin/holidays') as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a plain ADMIN', async () => {
    mockRequireSuperAdmin.mockResolvedValue(
      NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
    )
    const { GET } = await import('@/app/api/admin/holidays/route')
    const res = await GET(new Request('http://localhost/api/admin/holidays') as any)
    expect(res.status).toBe(403)
  })

  it('returns the holiday list for SUPER_ADMIN', async () => {
    const { GET } = await import('@/app/api/admin/holidays/route')
    const res = await GET(new Request('http://localhost/api/admin/holidays') as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.holidayList).toEqual([])
  })
})
