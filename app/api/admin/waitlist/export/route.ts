import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin()
  if (admin instanceof NextResponse) return admin

  try {
    const prisma = getPrisma()
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.trim()
    const interest = url.searchParams.get('interest')
    const device = url.searchParams.get('device')

    const where: any = {}
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (interest && interest !== 'all') where.interest = interest
    if (device && device !== 'all') where.device = device

    const rows = await prisma.waitlistSignup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const header = ['id', 'full_name', 'email', 'phone', 'interest', 'device', 'source', 'utm_medium', 'utm_campaign', 'created_at', 'notified_at']
    const lines = [header.join(',')]
    for (const r of rows) {
      const vals = [
        r.id,
        `"${(r.fullName || '').replace(/"/g, '""')}"`,
        r.email,
        r.phone ? `"${r.phone.replace(/"/g, '""')}"` : '',
        r.interest,
        r.device || '',
        r.source || '',
        r.utmMedium || '',
        r.utmCampaign || '',
        r.createdAt.toISOString(),
        r.notifiedAt ? r.notifiedAt.toISOString() : '',
      ]
      lines.push(vals.join(','))
    }

    const csv = lines.join('\n')
    const response = new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="waitlist-export.csv"',
        'Cache-Control': 'no-store',
      },
    })
    return response
  } catch (error) {
    console.error('Waitlist export error:', error)
    const errRes = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    errRes.headers.set('Cache-Control', 'no-store')
    return errRes
  }
}
