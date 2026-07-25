import { type TokenPayload, verifyTokenEdge } from '@/lib/auth-edge'
import { cookies } from 'next/headers'
import { validateSession, getUserStatus, type SessionValidationResult, type UserStatus } from '@/lib/auth-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildRedirectUrl(request: Request, path: string): string {
  const url = new URL(path, request.headers.get('referer') || 'http://localhost:3000')
  const fullUrl = new URL(request.url).pathname + new URL(request.url).search
  if (fullUrl && fullUrl !== '/') {
    url.searchParams.set('redirect', fullUrl)
  }
  return url.toString()
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return Response.json({ isValid: false, reason: 'NO_TOKEN' }, { status: 401 })
    }

    const payload = await verifyTokenEdge(token)

    if (!payload) {
      return Response.json({ isValid: false, reason: 'INVALID_TOKEN' }, { status: 401 })
    }

    const result = await validateSession(payload.sessionId)

    if (!result.valid) {
      return Response.json({
        isValid: false,
        reason: result.reason,
        userId: payload.userId,
        role: payload.role,
        sessionId: payload.sessionId,
      }, { status: 403 })
    }

    const userStatus = await getUserStatus(payload.userId, payload.role)

    return Response.json({
      isValid: true,
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId,
      userStatus,
    })
  } catch (error) {
    console.error('[VALIDATE_SESSION] Error:', error)
    return Response.json({ isValid: false, reason: 'SERVER_ERROR' }, { status: 500 })
  }
}
