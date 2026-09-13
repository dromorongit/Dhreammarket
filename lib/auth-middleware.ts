import { jwtVerify, errors } from 'jose'
import { getPrisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'VENDOR' | 'CUSTOMER'

export interface VerifyTokenResult {
  authenticated: true
  userId: string
  role: Role
  sessionId: string
}

export interface VerifyTokenFailure {
  authenticated: false
  reason: 'session_expired' | 'invalid_token' | 'verification_error' | 'no_secret' | 'session_not_found'
}

export type VerifyTokenOutcome = VerifyTokenResult | VerifyTokenFailure

export async function verifyToken(token: string): Promise<VerifyTokenOutcome> {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set')
    return { authenticated: false, reason: 'no_secret' }
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    if (typeof payload === 'object' && payload.userId && payload.role && payload.sessionId) {
      const sessionId = payload.sessionId as string
      const prisma = getPrisma()
      const session = await prisma.session.findUnique({
        where: { sessionId },
      })

      if (!session) {
        return { authenticated: false, reason: 'session_not_found' }
      }

      if (session.isExpired) {
        return { authenticated: false, reason: 'session_expired' }
      }

      return {
        authenticated: true,
        userId: payload.userId as string,
        role: payload.role as Role,
        sessionId,
      }
    }

    return { authenticated: false, reason: 'invalid_token' }
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return { authenticated: false, reason: 'session_expired' }
    }
    if (
      error instanceof errors.JWTInvalid ||
      error instanceof errors.JWSSignatureVerificationFailed ||
      error instanceof errors.JWSInvalid
    ) {
      return { authenticated: false, reason: 'invalid_token' }
    }
    console.error('Token verification error:', error)
    return { authenticated: false, reason: 'verification_error' }
  }
}
