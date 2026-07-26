import { jwtVerify } from 'jose'
import type { Role } from './auth'

const JWT_SECRET = process.env.JWT_SECRET

export interface TokenPayload {
  userId: string
  role: Role
  sessionId: string
}

export async function verifyTokenEdge(token: string): Promise<TokenPayload | null> {
  if (!JWT_SECRET) {
    return null
  }
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    if (
      typeof payload === 'object' &&
      payload.userId &&
      payload.role &&
      payload.sessionId
    ) {
      return {
        userId: payload.userId as string,
        role: payload.role as Role,
        sessionId: payload.sessionId as string,
      }
    }
    return null
  } catch (error) {
    return null
  }
}
