import { getPrisma } from '@/lib/prisma'

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
