import { getPrisma } from '@/lib/prisma'

export async function updateSessionLastActivity(sessionId: string, ipAddress?: string | null, userAgent?: string | null) {
  console.log('[SESSION] updateSessionLastActivity called for session:', sessionId)
  try {
    const prisma = getPrisma()
    console.log('[SESSION] Query: prisma.session.updateMany for session:', sessionId)
    await prisma.session.updateMany({
      where: { sessionId, isExpired: false },
      data: {
        lastActivity: new Date(),
        ...(ipAddress ? { ipAddress } : {}),
        ...(userAgent ? { userAgent } : {}),
      },
    })
    console.log('[SESSION] Session last activity updated successfully')
  } catch (error) {
    console.error('[SESSION] Failed to update session last activity:', error)
    console.error('[SESSION] Error stack:', (error as any)?.stack)
  }
}
