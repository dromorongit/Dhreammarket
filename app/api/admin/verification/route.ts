// Admin verification API - only shows PAID applications
import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'
import { createNotification } from '@/lib/notifications'
import { sendVerificationStatusEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GET all verification applications (for admin listing - only PAID applications)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden - Admins only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''

    // Build where clause - only show PAID applications by default
    const where: any = {
      paymentStatus: 'PAID',
    }

    // If a specific status is requested, filter by it
    if (status) {
      where.status = status
    }

    // Search filter
    if (search) {
      where.OR = [
        { store: { name: { contains: search, mode: 'insensitive' } } },
        { vendor: { email: { contains: search, mode: 'insensitive' } } },
        { vendor: { profile: { firstName: { contains: search, mode: 'insensitive' } } } },
        { vendor: { profile: { lastName: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    const applications = await getPrisma().vendorVerificationApplication.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              }
            }
          }
        },
store: {
           select: {
             id: true,
             name: true,
             badgeTier: true,
           }
         },
documents: true,
         payments: true,
         auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const total = await getPrisma().vendorVerificationApplication.count({ where })

    return NextResponse.json({
      applications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching verification applications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden - Admins only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('applicationId')
    const { action, note } = await request.json()

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 })
    }

    const application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { id: applicationId },
      include: { store: true }
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    let newStatus: string
    let auditAction: string

    switch (action) {
      case 'approve':
        newStatus = 'APPROVED'
        auditAction = 'ADMIN_APPROVED'
        break
      case 'reject':
        newStatus = 'REJECTED'
        auditAction = 'ADMIN_REJECTED'
        break
      case 'revoke':
        newStatus = 'REJECTED'
        auditAction = 'ADMIN_REJECTED'
        break
      case 'request_changes':
        newStatus = 'CHANGES_REQUESTED'
        auditAction = 'ADMIN_REQUESTED_CHANGES'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update application status
    if (!application.store) {
      return NextResponse.json({ error: 'Vendor store not found' }, { status: 404 })
    }

    const updatedApplication = await getPrisma().vendorVerificationApplication.update({
      where: { id: applicationId },
      data: { status: newStatus as any },
      include: {
        store: true,
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        kycInfo: true,
        documents: true,
      }
    })

    // Update store verification status for APPROVED or REVOKE
    if (action === 'approve') {
      await getPrisma().store.update({
        where: { id: application.storeId },
        data: { isVerified: true }
      })
    } else if (action === 'revoke') {
      await getPrisma().store.update({
        where: { id: application.storeId },
        data: { isVerified: false }
      })
    }

    // Create audit log (platform-level)
    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: action === 'approve' ? 'KYC_APPROVED' : action === 'reject' || action === 'revoke' ? 'KYC_REJECTED' : 'SUPPORT_TICKET_UPDATED',
      entityType: 'KYC_APPLICATION',
      entityId: applicationId,
      beforeData: { status: application.status },
      afterData: { status: newStatus, note },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    // Create audit log (verification-specific)
    await getPrisma().verificationAuditLog.create({
      data: {
        applicationId,
        action: auditAction as any,
        adminId: payload.userId,
        note,
      }
    })

    const vendorId = application.vendorId
    const vendorEmail = updatedApplication.vendor?.email
    const vendorName = `${updatedApplication.vendor?.profile?.firstName || ''} ${updatedApplication.vendor?.profile?.lastName || ''}`.trim() || 'Vendor'
    const storeName = updatedApplication.store?.name || 'Your Store'

    const notificationTypeMap: Record<string, string> = {
      APPROVED: 'VERIFICATION_APPROVED',
      REJECTED: 'VERIFICATION_REJECTED',
      CHANGES_REQUESTED: 'VERIFICATION_CHANGES_REQUESTED',
    }

    const notificationTitleMap: Record<string, string> = {
      APPROVED: 'Verification Approved',
      REJECTED: 'Verification Rejected',
      CHANGES_REQUESTED: 'Changes Requested',
    }

    const notificationMessageMap: Record<string, string> = {
      APPROVED: `Your verification for "${storeName}" has been approved.`,
      REJECTED: `Your verification for "${storeName}" has been rejected.`,
      CHANGES_REQUESTED: `Changes have been requested for your verification for "${storeName}".`,
    }

    if (action === 'revoke') {
      await createNotification(
        vendorId,
        'VERIFICATION_REVOKED',
        'Verification Revoked',
        `Your store verification for "${storeName}" has been revoked.`
      )
      if (vendorEmail) {
        sendVerificationStatusEmail(vendorEmail, vendorName, 'REVOKED', storeName).catch(err => {
          console.error('Failed to send verification revoked email:', err)
        })
      }
    } else {
      const notificationType = notificationTypeMap[newStatus]
      const notificationTitle = notificationTitleMap[newStatus]
      const notificationMessage = notificationMessageMap[newStatus]

      if (notificationType) {
        await createNotification(vendorId, notificationType as any, notificationTitle, notificationMessage)
      }
      if (vendorEmail) {
        sendVerificationStatusEmail(vendorEmail, vendorName, newStatus, storeName).catch(err => {
          console.error('Failed to send verification status email:', err)
        })
      }
    }

    return NextResponse.json({ application: updatedApplication })
  } catch (error) {
    console.error('Error updating verification application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}