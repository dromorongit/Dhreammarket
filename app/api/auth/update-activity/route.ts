import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = await verifyToken(token)

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { ipAddress, userAgent } = await request.json().catch(() => ({}))

    await updateLastActivity(payload.sessionId, ipAddress, userAgent)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[UPDATE_ACTIVITY] Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function updateLastActivity(sessionId: string, ipAddress?: string, userAgent?: string) {
  const { getPrisma } = await import('@/lib/prisma')
  const prisma = getPrisma()
  await prisma.session.updateMany({
    where: { sessionId, isExpired: false },
    data: {
      lastActivity: new Date(),
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    },
  })
}
