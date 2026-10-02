import { verifyToken, type Role } from '@/lib/auth-middleware'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export interface InfluencerAuthUser {
  userId: string
  role: Role
}

export async function requireInfluencerOrSuperAdmin(): Promise<InfluencerAuthUser | NextResponse> {
  const token = cookies().get('token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const outcome = await verifyToken(token)
  if (!outcome.authenticated) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (outcome.role !== 'INFLUENCER' && outcome.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Influencer access required' }, { status: 403 })
  }

  return { userId: outcome.userId, role: outcome.role }
}

export async function getInfluencerForUser(userId: string) {
  const prisma = getPrisma()
  return prisma.influencer.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      referralCode: true,
      active: true,
      incentivePerVendor: true,
      incentivePerCustomer: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}
