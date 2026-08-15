export interface SessionValidationResult {
  valid: boolean
  reason?: string
}

export interface UserStatus {
  isEmailVerified: boolean
  isOnboarded?: boolean
}

export async function validateSession(sessionId: string): Promise<SessionValidationResult> {
  try {
    const { getPrisma } = await import('@/lib/prisma')
    const prisma = getPrisma()
    const session = await prisma.session.findUnique({
      where: { sessionId },
    })

    if (!session) {
      return { valid: false, reason: 'SESSION_NOT_FOUND' }
    }

    if (session.isExpired) {
      return { valid: false, reason: 'SESSION_EXPIRED' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, reason: 'VALIDATION_ERROR' }
  }
}

export async function getUserStatus(userId: string, role: string): Promise<UserStatus> {
  try {
    const { getPrisma } = await import('@/lib/prisma')
    const prisma = getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isEmailVerified: true },
    })

    if (!user) {
      return { isEmailVerified: false }
    }

    let isOnboarded = true
    if (role === 'VENDOR') {
      const { isVendorOnboarded } = await import('@/lib/onboarding')
      isOnboarded = await isVendorOnboarded(userId)
    }

    return {
      isEmailVerified: user.isEmailVerified,
      isOnboarded,
    }
  } catch (error) {
    return { isEmailVerified: false, isOnboarded: true }
  }
}
