import { getPrisma } from '@/lib/prisma'
import { getSessionTimeoutMs } from './platform-preferences'

export async function updateSessionLastActivity(sessionId: string, ipAddress?: string | null, userAgent?: string | null) {
  try {
    const prisma = getPrisma()
    await prisma.session.updateMany({
      where: { sessionId, isExpired: false },
      data: {
        lastActivity: new Date(),
        ...(ipAddress ? { ipAddress } : {}),
        ...(userAgent ? { userAgent } : {}),
      },
    })
  } catch (error) {
    console.error('Failed to update session last activity:', error)
  }
}

export async function expireIdleSessions(): Promise<number> {
  try {
    const prisma = getPrisma()
    const timeoutMs = await getSessionTimeoutMs()
    const expiryThreshold = new Date(Date.now() - timeoutMs)
    const result = await prisma.session.updateMany({
      where: {
        isExpired: false,
        lastActivity: { lt: expiryThreshold },
      },
      data: {
        isExpired: true,
        expiredAt: new Date(),
      },
    })
    return result.count
  } catch (error) {
    console.error('Failed to expire idle sessions:', error)
    return 0
  }
}

export async function isSessionExpired(sessionId: string): Promise<boolean> {
  try {
    const prisma = getPrisma()
    const session = await prisma.session.findUnique({
      where: { sessionId },
    })
    if (!session || session.isExpired) {
      return true
    }
    const timeoutMs = await getSessionTimeoutMs()
    const expiryThreshold = new Date(Date.now() - timeoutMs)
    if (session.lastActivity < expiryThreshold) {
      await prisma.session.update({
        where: { sessionId },
        data: {
          isExpired: true,
          expiredAt: new Date(),
        },
      })
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to check session expiry:', error)
    return false
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const prisma = getPrisma()
    const result = await prisma.session.deleteMany({
      where: {
        isExpired: true,
      },
    })
    return result.count
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error)
    return 0
  }
}
