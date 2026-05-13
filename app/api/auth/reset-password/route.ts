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

    // Find user by reset token
    const users = await getPrisma().user.findMany({
      where: { resetPasswordToken: { not: null } },
    })

    // Find matching user by comparing token with stored hash
    let user = null
    for (const u of users) {
      if (u.resetPasswordToken && verifyResetToken(token, u.resetPasswordToken)) {
        user = u
        break
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    // Check if token has expired
    if (!user.resetPasswordExpires || new Date() > user.resetPasswordExpires) {
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password)

    // Update password and clear reset token
    await getPrisma().user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    })

    return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
