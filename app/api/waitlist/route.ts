import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import {
  validateWaitlist,
  normalizeEmail,
  hasErrors,
  toInterestDb,
  toDeviceDb,
} from '@/lib/waitlist-validation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('waitlist')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const body = await request.json()

    // Honeypot
    if (body?.website && String(body.website).trim() !== '') {
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const interest = body?.interest as string
    const device = body?.device as string | undefined

    const errors = validateWaitlist({
      full_name: body?.full_name,
      email: body?.email,
      phone: body?.phone,
      interest: interest as any,
      device: device as any,
      consent: body?.consent === true,
    })

    if (hasErrors(errors)) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
    }

    const email = normalizeEmail(body.email)
    const fullName = String(body.full_name).trim()
    const phone = body?.phone ? String(body.phone).trim() : null

    const url = new URL(request.url)
    const source =
      (body?.source as string | undefined) ||
      url.searchParams.get('utm_source') ||
      url.searchParams.get('ref') ||
      null
    const utmMedium = body?.utm_medium || url.searchParams.get('utm_medium') || null
    const utmCampaign = body?.utm_campaign || url.searchParams.get('utm_campaign') || null

    const prisma = getPrisma()

    // Duplicate check
    const existing = await prisma.waitlistSignup.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { success: true, duplicate: true, message: "You're already on the waitlist. We'll be in touch!" },
        { status: 200 }
      )
    }

    const created = await prisma.waitlistSignup.create({
      data: {
        fullName,
        email,
        phone,
        interest: toInterestDb(interest as any),
        device: toDeviceDb(device as any),
        consent: true,
        source: source ? String(source).slice(0, 64) : null,
        utmMedium: utmMedium ? String(utmMedium).slice(0, 255) : null,
        utmCampaign: utmCampaign ? String(utmCampaign).slice(0, 255) : null,
      },
    })

    // Optional welcome email (feature-flagged)
    if (process.env.ENABLE_WELCOME_EMAIL === 'true') {
      try {
        const { sendEmail } = await import('@/lib/email')
        await sendEmail({
          to: email,
          subject: 'You are on the Dhream Market app waitlist!',
          htmlContent: `<p>Hi ${fullName},</p><p>Thanks for joining the Dhream Market app waitlist. We'll let you know the moment the app is ready.</p>`,
        })
      } catch (e) {
        console.error('Welcome email failed:', e)
      }
    }

    // Position number
    const position = await prisma.waitlistSignup.count({
      where: { createdAt: { lte: created.createdAt } },
    })

    return NextResponse.json(
      { success: true, duplicate: false, position, message: "You're on the list!" },
      { status: 201 }
    )
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: true, duplicate: true, message: "You're already on the waitlist. We'll be in touch!" },
        { status: 200 }
      )
    }
    console.error('Waitlist signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
