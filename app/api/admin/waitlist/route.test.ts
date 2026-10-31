import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const auth = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({
  requireSuperAdmin: auth.requireSuperAdmin,
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => ({})) }))

import { GET } from '@/app/api/admin/waitlist/route'

function unauth() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
}

describe('GET /api/admin/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when the caller is not authenticated', async () => {
    auth.requireSuperAdmin.mockResolvedValue(unauth() as never)
    const res = await GET(new NextRequest('http://localhost/api/admin/waitlist'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a plain ADMIN', async () => {
    auth.requireSuperAdmin.mockResolvedValue(forbidden() as never)
    const res = await GET(new NextRequest('http://localhost/api/admin/waitlist'))
    expect(res.status).toBe(403)
  })

  it('returns 403 for a non-super-admin authenticated user', async () => {
    auth.requireSuperAdmin.mockResolvedValue(forbidden() as never)
    const res = await GET(new NextRequest('http://localhost/api/admin/waitlist'))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toMatch(/SUPER_ADMIN/i)
  })
})
