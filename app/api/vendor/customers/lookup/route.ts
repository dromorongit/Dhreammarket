import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { rateLimit } from '@/lib/rate-limit'
import { isVendorOnboarded } from '@/lib/onboarding'
import { normalizeGhanaPhone } from '@/lib/phone'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimitCheck = rateLimit('vendor-customers')(request)
  if (!rateLimitCheck.success) {
    return rateLimitCheck.response
  }

  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to look up customers' },
        { status: 403 }
      )
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (typeof phone !== 'string' || phone.trim().length === 0) {
      return NextResponse.json({ error: 'phone query parameter is required' }, { status: 400 })
    }

    const normalized = normalizeGhanaPhone(phone)
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const customer = await getPrisma().vendorCustomer.findFirst({
      where: { storeId: store.id, phone: normalized },
      select: { id: true, name: true, phone: true, email: true },
    })

    return NextResponse.json({
      normalizedPhone: normalized,
      found: !!customer,
      customer: customer || null,
    })
  } catch (error) {
    console.error('Error looking up vendor customer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
