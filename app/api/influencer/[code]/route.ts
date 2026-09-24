import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const prisma = getPrisma()
  const { code } = await params
  const trimmedCode = code.trim().toUpperCase()

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: trimmedCode },
    select: { id: true, active: true },
  })

  const targetUrl = new URL('/register', request.url)
  targetUrl.searchParams.set('influencerCode', trimmedCode)

  if (!influencer || !influencer.active) {
    return NextResponse.redirect(targetUrl, 302)
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    null

  await prisma.influencerClick.create({
    data: {
      influencerId: influencer.id,
      ipAddress: ipAddress ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      referrerUrl: request.headers.get('referer') ?? undefined,
      landingPage: targetUrl.toString(),
    },
  })

  return NextResponse.redirect(targetUrl, 302)
}
