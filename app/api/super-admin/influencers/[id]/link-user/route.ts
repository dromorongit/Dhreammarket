import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const trimmedEmail = email.trim().toLowerCase()

    const influencer = await prisma.influencer.findUnique({ where: { id } })
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      include: { influencer: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'INFLUENCER') {
      return NextResponse.json(
        { error: `User must have role ADMIN or INFLUENCER to be linked (current role: ${user.role})` },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true },
      })

      if (!freshUser || (freshUser.role !== 'ADMIN' && freshUser.role !== 'INFLUENCER')) {
        throw new Error(`User role changed during transaction (current role: ${freshUser?.role ?? 'MISSING'})`)
      }

      const fullInfluencer = await tx.influencer.findUnique({
        where: { id },
        select: { id: true, userId: true },
      })

      if (!fullInfluencer) {
        throw new Error('Influencer not found during transaction')
      }

      if (fullInfluencer.userId && fullInfluencer.userId !== user.id) {
        throw new Error('Influencer is already linked to a different user')
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { role: 'INFLUENCER' },
      })

      await tx.influencer.update({
        where: { id },
        data: { userId: user.id },
      })

      return { user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role } }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Super Admin link user to influencer error:', error)
    return NextResponse.json({ error: 'Failed to link user' }, { status: 500 })
  }
}
