import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyResetToken, hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { selector, token, password } = await request.json()

    if (!selector || !token || !password) {
      return NextResponse.json({ error: 'Selector, token, and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    // O(1) indexed lookup using selector
    // Support legacy tokens by checking if selector looks like an old-format token (64 hex chars)
    let authTokenRecord
    const isLegacyFormat = selector.length === 64 && /^[a-f0-9]+$/i.test(selector)

    if (isLegacyFormat) {
      // Legacy token: lookup by tokenHash (bcrypt comparison)
      // This only scans tokens with NULL selectors (legacy tokens - limited set)
      // Migration will remove this code path after legacy tokens expire
      const legacyTokens = await getPrisma().authToken.findMany({
        where: {
          tokenType: 'PASSWORD_RESET',
          selector: { equals: null },
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      })

      for (const t of legacyTokens) {
        if (verifyResetToken(selector, t.tokenHash)) {
          authTokenRecord = t
          break
        }
      }
    } else {
      // New format: O(1) lookup by selector
      authTokenRecord = await getPrisma().authToken.findUnique({
        where: { selector },
        include: { user: true },
      })
    }

    if (!authTokenRecord || !authTokenRecord.user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    // Verify token hasn't been used
    if (authTokenRecord.usedAt !== null) {
      return NextResponse.json({ error: 'Reset token has already been used' }, { status: 400 })
    }

    // Verify token hasn't expired
    if (authTokenRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 })
    }

    // Verify token type is PASSWORD_RESET
    if (authTokenRecord.tokenType !== 'PASSWORD_RESET') {
      return NextResponse.json({ error: 'Invalid token type' }, { status: 400 })
    }

    // Verify the secret token against stored hash
    // For legacy tokens, the selector IS the token (single token format)
    // For new tokens, we verify the separate secret token
    const actualToken = isLegacyFormat ? selector : token
    if (!verifyResetToken(actualToken, authTokenRecord.tokenHash)) {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 400 })
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
