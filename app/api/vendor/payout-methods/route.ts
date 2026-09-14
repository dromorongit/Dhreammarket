import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

const MOMO_PROVIDERS = ['MTN', 'VODAFONE', 'AIRTELTIGO', 'AIRTEL', 'TIGO']

function validateMomoNumber(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const digits = value.replace(/\s/g, '')
  return digits.length >= 9 && digits.length <= 15 && /^\d+$/.test(digits)
}

function validatePayoutDetails(type: string, details: unknown): { valid: boolean; error?: string } {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return { valid: false, error: 'Details must be a valid object' }
  }
  const d = details as Record<string, any>

  if (type === 'MOBILE_MONEY') {
    const provider = (d.momoProvider || '').trim().toUpperCase()
    if (!provider || !MOMO_PROVIDERS.includes(provider)) {
      return { valid: false, error: `momoProvider must be one of: ${MOMO_PROVIDERS.join(', ')}` }
    }
    if (!validateMomoNumber(d.momoNumber)) {
      return { valid: false, error: 'momoNumber must be a valid phone number (9–15 digits)' }
    }
    if (!d.accountHolderName || !String(d.accountHolderName).trim()) {
      return { valid: false, error: 'accountHolderName is required' }
    }
    return { valid: true }
  }

  if (type === 'BANK_ACCOUNT') {
    if (!d.bankName || !String(d.bankName).trim()) {
      return { valid: false, error: 'bankName is required' }
    }
    if (!d.accountNumber || !String(d.accountNumber).trim()) {
      return { valid: false, error: 'accountNumber is required' }
    }
    if (!d.accountHolderName || !String(d.accountHolderName).trim()) {
      return { valid: false, error: 'accountHolderName is required' }
    }
    return { valid: true }
  }

  return { valid: false, error: `Unsupported type: ${type}` }
}

export async function GET(request: NextRequest) {
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

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ payoutMethods: [] })
    }

    const payoutMethods = await getPrisma().vendorPayoutMethod.findMany({
      where: { vendorId: payload.userId, storeId: store.id, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ payoutMethods })
  } catch (error) {
    console.error('Error fetching vendor payout methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { type, details, isDefault } = body

    const typeUpper = (type || 'MOBILE_MONEY').toUpperCase()
    if (!['MOBILE_MONEY', 'BANK_ACCOUNT'].includes(typeUpper)) {
      return NextResponse.json({ error: 'Type must be MOBILE_MONEY or BANK_ACCOUNT' }, { status: 400 })
    }

    const validation = validatePayoutDetails(typeUpper, details)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const prisma = getPrisma()

    const store = await prisma.store.findUnique({
      where: { userId: payload.userId },
    })
    if (!store) {
      return NextResponse.json({ error: 'No store found for this vendor' }, { status: 400 })
    }

    if (isDefault) {
      await prisma.vendorPayoutMethod.updateMany({
        where: { vendorId: payload.userId, storeId: store.id },
        data: { isDefault: false },
      })
    }

    const payoutMethod = await prisma.vendorPayoutMethod.create({
      data: {
        vendorId: payload.userId,
        storeId: store.id,
        type: typeUpper as 'MOBILE_MONEY' | 'BANK_ACCOUNT',
        details: details || {},
        isDefault: isDefault ?? false,
      },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'VENDOR_PAYOUT_METHOD_CREATED',
      entityType: 'VENDOR_PAYOUT_METHOD',
      entityId: payoutMethod.id,
      afterData: { payoutMethodId: payoutMethod.id, type: typeUpper },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ payoutMethod }, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor payout method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
