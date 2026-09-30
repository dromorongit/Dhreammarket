import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { sendWaitlistConfirmationEmail } from '@/lib/email'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Platform = 'ANDROID' | 'IOS' | 'BOTH'
type Role = 'CUSTOMER' | 'VENDOR'

const ALLOWED_PLATFORMS: Platform[] = ['ANDROID', 'IOS', 'BOTH']
const ALLOWED_ROLES: Role[] = ['CUSTOMER', 'VENDOR']

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function sanitizeSource(source: string | undefined): string | undefined {
  if (!source) return undefined
  const cleaned = source.trim().slice(0, 64)
  if (!cleaned) return undefined
  if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return undefined
  }
  return cleaned
}

async function sendConfirmation(email: string): Promise<void> {
  try {
    const result = await sendWaitlistConfirmationEmail(email)
    if (result.success) {
      const prisma = getPrisma()
      try {
        await prisma.appWaitlistEntry.update({
          where: { email },
          data: { confirmationSentAt: new Date() },
        })
      } catch (updateError) {
        logError('Failed to record waitlist confirmation time', updateError)
      }
    } else {
      logError('Failed to send waitlist confirmation email')
    }
  } catch {
    logError('Failed to send waitlist confirmation email')
  }
}

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('waitlist')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }

    const rawEmail = typeof body.email === 'string' ? body.email.trim() : ''
    const honeypot = typeof body.website === 'string' ? body.website.trim() : ''

    if (honeypot.length > 0) {
      return NextResponse.json({ success: true, message: "You're on the list! We'll be in touch when the app launches." }, { status: 200 })
    }

    if (!rawEmail || rawEmail.length > 254 || !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }

    const email = rawEmail.toLowerCase()

    const rawName = typeof body.name === 'string' ? body.name.trim() : ''
    const name = rawName ? rawName.slice(0, 100) : undefined

    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const phone = rawPhone ? rawPhone.slice(0, 20) : undefined
    if (phone && !/^[+]?[\d\s()-]+$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 })
    }

    const rawPlatform = typeof body.platform === 'string' ? body.platform.trim().toUpperCase() : 'BOTH'
    const platform: Platform = ALLOWED_PLATFORMS.includes(rawPlatform as Platform) ? (rawPlatform as Platform) : 'BOTH'

    const rawRole = typeof body.role === 'string' ? body.role.trim().toUpperCase() : 'CUSTOMER'
    const role: Role = ALLOWED_ROLES.includes(rawRole as Role) ? (rawRole as Role) : 'CUSTOMER'

    const source = sanitizeSource(typeof body.source === 'string' ? body.source : undefined)

    const rawReferredByCode = typeof body.referredByCode === 'string' ? body.referredByCode.trim() : ''
    const referredByCode = rawReferredByCode ? rawReferredByCode.slice(0, 32) : undefined

    const prisma = getPrisma()

    let isNew = false
    try {
      await prisma.appWaitlistEntry.create({
        data: {
          email,
          name,
          phone,
          platform,
          role,
          source,
          referredByCode,
        },
      })
      isNew = true
    } catch (error: any) {
      if (error?.code === 'P2002') {
        isNew = false
      } else {
        logError('Waitlist signup error', error)
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
      }
    }

    if (isNew) {
      void sendConfirmation(email)
    }

    return NextResponse.json(
      { success: true, message: "You're on the list! We'll be in touch when the app launches." },
      { status: 200 }
    )
  } catch (error) {
    logError('Waitlist unexpected error', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
