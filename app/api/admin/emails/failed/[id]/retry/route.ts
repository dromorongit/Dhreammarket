import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { retryFailedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const prisma = getPrisma()
    const failedEmail = await prisma.failedEmail.findUnique({
      where: { id: params.id },
    })

    if (!failedEmail) {
      return NextResponse.json({ error: 'Failed email not found' }, { status: 404 })
    }

    const result = await retryFailedEmail(failedEmail)

    return NextResponse.json({
      id: failedEmail.id,
      recipientEmail: failedEmail.recipientEmail,
      emailType: failedEmail.emailType,
      success: result.success,
      error: result.error,
    })
  } catch (error) {
    console.error('Retry failed email error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
