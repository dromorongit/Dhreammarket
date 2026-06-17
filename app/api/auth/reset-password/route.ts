import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyResetToken, hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    // Use indexed lookup - query only unused PASSWORD_RESET tokens (filtered by index on [userId, tokenType, expiresAt])
    const validTokens = await getPrisma().authToken.findMany({
      where: {
        tokenType: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })

    // Find matching token by comparing token with stored hash
    let authTokenRecord: { id: string; userId: string; tokenType: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; createdAt: Date; ipAddress: string | null; userAgent: string | null; user: { id: string; email: string; role: string; status: string; isEmailVerified: boolean; emailVerifiedAt: Date | null; position: string | null } } | null = null
    for (const t of validTokens) {
      if (verifyResetToken(token, t.tokenHash)) {
        authTokenRecord = t
        break
      }
    }

    if (!authTokenRecord || !authTokenRecord.user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password)

    // Update password and mark token as used
    await getPrisma().user.update({
      where: { id: authTokenRecord.userId },
      data: {
        password: hashedPassword,
      },
    })

    // Mark token as used
    await getPrisma().authToken.update({
      where: { id: authTokenRecord.id },
      data: { usedAt: new Date() },
    })

    // Non-blocking audit log
    try {
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                        request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || undefined
      
      await getPrisma().auditLog.create({
        data: {
          userId: authTokenRecord.userId,
          userRole: authTokenRecord.user.role,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: authTokenRecord.userId,
          ipAddress,
          userAgent,
        },
      })
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
    }

    return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
