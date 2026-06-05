// Admin verification API - only shows PAID applications
import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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
          }
        },
        documents: true,
        payments: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
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

    // Create audit log
    await getPrisma().verificationAuditLog.create({
      data: {
        applicationId,
        action: auditAction as any,
        adminId: payload.userId,
        note,
      }
    })

    return NextResponse.json({ application: updatedApplication })
  } catch (error) {
    console.error('Error updating verification application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}