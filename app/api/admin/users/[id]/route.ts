import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
const prisma = getPrisma()
import { requireAdmin, type AdminUser } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

// GET user by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        store: {
          select: {
            id: true,
            name: true,
            isVerified: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user

    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error('Admin user get error:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PATCH - Update user status (ban, unban, disable, re-enable)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const requestingUser = authCheck as AdminUser
    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // Fetch the user to check current role and status
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        store: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

let updatedUser

    switch (action) {
       case 'ban':
       case 'disable':
         if (user.role === 'SUPER_ADMIN') {
           return NextResponse.json({ error: 'Cannot ban a SUPER_ADMIN' }, { status: 403 })
         }
         if (user.role === 'ADMIN' && requestingUser.role !== 'SUPER_ADMIN') {
           return NextResponse.json({ error: 'Only SUPER_ADMIN can ban ADMIN accounts' }, { status: 403 })
         }
         updatedUser = await prisma.user.update({
           where: { id },
           data: { status: action === 'ban' ? 'BANNED' : 'DISABLED' },
         })
         createAuditLog({
           userId: requestingUser.userId,
           userRole: requestingUser.role,
           action: 'USER_SUSPENDED',
           entityType: 'USER',
           entityId: id,
           beforeData: { status: user.status, role: user.role },
           afterData: { status: action === 'ban' ? 'BANNED' : 'DISABLED', role: user.role },
         }).catch(err => console.error('Failed to create audit log:', err))
         break

       case 'unban':
       case 'reactivate':
         if (user.role === 'SUPER_ADMIN') {
           return NextResponse.json({ error: 'Cannot unban a SUPER_ADMIN' }, { status: 403 })
         }
         if (user.role === 'ADMIN' && requestingUser.role !== 'SUPER_ADMIN') {
           return NextResponse.json({ error: 'Only SUPER_ADMIN can unban ADMIN accounts' }, { status: 403 })
         }
         updatedUser = await prisma.user.update({
           where: { id },
           data: { status: 'ACTIVE' },
         })
         createAuditLog({
           userId: requestingUser.userId,
           userRole: requestingUser.role,
           action: 'USER_REACTIVATED',
           entityType: 'USER',
           entityId: id,
           beforeData: { status: user.status, role: user.role },
           afterData: { status: 'ACTIVE', role: user.role },
         }).catch(err => console.error('Failed to create audit log:', err))
         break

       default:
         return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
     }

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error('Admin user patch error:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE - Delete a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const requestingUser = authCheck as AdminUser
    const { id } = await params

    // Fetch the user to check role
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Security rules:
    // 1. SUPER_ADMIN cannot delete themselves
    if (user.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot delete a SUPER_ADMIN' }, { status: 403 })
    }

    // 2. Prevent self-deletion
    if (requestingUser.userId === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 })
    }

    // 3. Only SUPER_ADMIN can delete ADMIN accounts
    if (user.role === 'ADMIN' && requestingUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can delete ADMIN accounts' }, { status: 403 })
    }

    // Delete the user (this will cascade to profile, store, etc. due to onDelete: Cascade)
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin user delete error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}