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
      console.log('[AUTH_DB] Session not found:', sessionId)
      return { valid: false, reason: 'SESSION_NOT_FOUND' }
    }

    if (session.isExpired) {
      console.log('[AUTH_DB] Session expired:', sessionId)
      return { valid: false, reason: 'SESSION_EXPIRED' }
    }

    console.log('[AUTH_DB] Session valid:', sessionId)
    return { valid: true }
  } catch (error) {
    console.error('[AUTH_DB] Error validating session:', error)
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
      const store = await prisma.store.findUnique({
        where: { userId },
        select: { categoryId: true },
      })
      isOnboarded = !!store && !!store.categoryId
    }

    return {
      isEmailVerified: user.isEmailVerified,
      isOnboarded,
    }
  } catch (error) {
    console.error('[AUTH_DB] Error fetching user status:', error)
    return { isEmailVerified: false, isOnboarded: true }
  }
}
