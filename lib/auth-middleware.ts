import { jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'VENDOR' | 'CUSTOMER'

export async function verifyToken(token: string): Promise<{ userId: string; role: Role } | null> {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set')
    return null
  }
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    if (typeof payload === 'object' && payload.userId && payload.role) {
      return { userId: payload.userId as string, role: payload.role as Role }
    }
    return null
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}