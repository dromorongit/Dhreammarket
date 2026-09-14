import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

function validatePayoutDetails(type: string, details: unknown): { valid: boolean; error?: string } {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return { valid: false, error: 'Details must be a valid object' }
  }
  const d = details as Record<string, any>

  if (type === 'MOBILE_MONEY') {
    const MOMO_PROVIDERS = ['MTN', 'VODAFONE', 'AIRTELTIGO', 'AIRTEL', 'TIGO']
    const provider = (d.momoProvider || '').trim().toUpperCase()
    if (!provider || !MOMO_PROVIDERS.includes(provider)) {
      return { valid: false, error: `momoProvider must be one of: ${MOMO_PROVIDERS.join(', ')}` }
    }
    const digits = String(d.momoNumber || '').replace(/\s/g, '')
    if (digits.length < 9 || digits.length > 15 || !/^\d+$/.test(digits)) {
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

async function getOwnedMethod(prisma: ReturnType<typeof getPrisma>, id: string, userId: string) {
  return prisma.vendorPayoutMethod.findFirst({
    where: { id, vendorId: userId, isActive: true },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const prisma = getPrisma()
    const existing = await getOwnedMethod(prisma, params.id, payload.userId)

    if (!existing) {
      return NextResponse.json({ error: 'Payout method not found' }, { status: 404 })
    }

    const updateData: Record<string, any> = {}

    if (type !== undefined) {
      const typeUpper = String(type).toUpperCase()
      if (!['MOBILE_MONEY', 'BANK_ACCOUNT'].includes(typeUpper)) {
        return NextResponse.json({ error: 'Type must be MOBILE_MONEY or BANK_ACCOUNT' }, { status: 400 })
      }
      updateData.type = typeUpper
    }

    const effectiveType = type ? String(type).toUpperCase() : existing.type

    if (details !== undefined) {
      const validation = validatePayoutDetails(effectiveType, details)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
      updateData.details = details
    }

    if (isDefault !== undefined) {
      if (isDefault) {
        await prisma.vendorPayoutMethod.updateMany({
          where: { vendorId: payload.userId, storeId: existing.storeId },
          data: { isDefault: false },
        })
      }
      updateData.isDefault = isDefault
    }

    const payoutMethod = await prisma.vendorPayoutMethod.update({
      where: { id: params.id },
      data: updateData,
    })

    const action = isDefault ? 'VENDOR_PAYOUT_METHOD_SET_DEFAULT' : 'VENDOR_PAYOUT_METHOD_UPDATED'

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action,
      entityType: 'VENDOR_PAYOUT_METHOD',
      entityId: params.id,
      afterData: { payoutMethodId: params.id, action: isDefault ? 'set_default' : 'updated' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ payoutMethod })
  } catch (error) {
    console.error('Error updating vendor payout method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const prisma = getPrisma()
    const existing = await getOwnedMethod(prisma, params.id, payload.userId)

    if (!existing) {
      return NextResponse.json({ error: 'Payout method not found' }, { status: 404 })
    }

    await prisma.vendorPayoutMethod.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'VENDOR_PAYOUT_METHOD_DELETED',
      entityType: 'VENDOR_PAYOUT_METHOD',
      entityId: params.id,
      afterData: { payoutMethodId: params.id, action: 'deleted' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vendor payout method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
