import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Logout successful' })

  try {
    const token = request.cookies.get('token')?.value
    if (token) {
      const payload = verifyToken(token)
      if (payload?.sessionId) {
        await getPrisma().session.updateMany({
          where: { sessionId: payload.sessionId, userId: payload.userId, isExpired: false },
          data: { isExpired: true, expiredAt: new Date() },
        }).catch((err) => console.error('Failed to expire session on logout:', err))
      }
    }
  } catch (error) {
    console.error('Logout session invalidation error:', error)
  }

  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
  return response
}
