import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await getPrisma().superAdminSettings.findFirst()

    if (!settings) {
      const newSettings = await getPrisma().superAdminSettings.create({
        data: {},
      })
      return NextResponse.json({ settings: newSettings })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching super admin settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const prisma = getPrisma()

    const existing = await prisma.superAdminSettings.findFirst()

    const allowedFields = [
      'maintenanceMode', 'registrationOpen', 'newVendorApproval', 'autoApproveProducts',
      'defaultCurrency', 'platformFee', 'platformName', 'platformTimezone',
      'regionalDefaults', 'brandingPreferences', 'auditLogRetention', 'sessionTimeout',
      'allowedAdminIps', 'monitoringPreferences', 'platformBehaviourPreferences',
      'notifySystemOutage', 'notifyFeatureAnnouncements', 'notifyPolicyUpdates',
      'notifySecurityAlerts', 'notifyInfrastructureAlerts', 'notifyFinanceAlerts',
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    let settings
    if (existing) {
      settings = await prisma.superAdminSettings.update({
        where: { id: existing.id },
        data: updateData,
      })
    } else {
      settings = await getPrisma().superAdminSettings.create({
        data: updateData,
      })
    }

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: payload.userId,
      afterData: { superAdminSettingsId: settings.id, action: 'updated' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error updating super admin settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
