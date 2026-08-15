import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { retryFailedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const prisma = getPrisma()
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const emailType = searchParams.get('emailType')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (emailType) {
      where.emailType = emailType
    }

    const [failedEmails, total] = await Promise.all([
      prisma.failedEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      prisma.failedEmail.count({ where }),
    ])

    return NextResponse.json({
      failedEmails,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('List failed emails error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const prisma = getPrisma()
    const body = await request.json().catch(() => ({}))
    const statusFilter = body.status || 'PENDING'

    const pendingEmails = await prisma.failedEmail.findMany({
      where: { status: statusFilter },
      orderBy: { createdAt: 'asc' },
    })

    const results = []
    for (const email of pendingEmails) {
      const result = await retryFailedEmail(email)
      results.push({
        id: email.id,
        recipientEmail: email.recipientEmail,
        emailType: email.emailType,
        success: result.success,
        error: result.error,
      })
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({
      message: `Bulk retry completed. Success: ${successCount}, Failed: ${failureCount}`,
      results,
      successCount,
      failureCount,
    })
  } catch (error) {
    console.error('Bulk retry failed emails error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
