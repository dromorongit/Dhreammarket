import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'VENDOR' | 'CUSTOMER'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: { userId: string; role: Role; sessionId: string }): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string; role: Role; sessionId: string } | null {
  console.log('[AUTH] verifyToken called')
  if (!JWT_SECRET) {
    console.error('[AUTH] JWT_SECRET is not configured')
    throw new Error('JWT_SECRET environment variable is required')
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { sessionId?: string }
    console.log('[AUTH] Token decoded successfully')
    if (typeof decoded === 'object' && decoded.userId && decoded.role && decoded.sessionId) {
      console.log('[AUTH] Token valid, userId:', decoded.userId, 'role:', decoded.role)
      return { userId: decoded.userId as string, role: decoded.role as Role, sessionId: decoded.sessionId }
    }
    console.log('[AUTH] Token missing required fields')
    return null
  } catch (error) {
    console.error('[AUTH] Token verification error:', error)
    console.error('[AUTH] Token verification error stack:', error?.stack)
    return null
  }
}

export function getTokenFromCookies(): string | null {
  const cookieStore = cookies()
  const token = cookieStore.get('token')?.value || null
  console.log('[AUTH] getTokenFromCookies result:', token ? 'token found' : 'no token')
  return token
}



export function getUserFromToken(): { userId: string; role: Role; sessionId: string } | null {
  console.log('[AUTH] getUserFromToken called')
  const token = getTokenFromCookies()
  if (!token) {
    console.log('[AUTH] No token found in cookies')
    return null
  }
  console.log('[AUTH] Token found, verifying...')
  return verifyToken(token)
}

export async function getServerSession(): Promise<{ userId: string; role: Role; sessionId: string } | null> {
  const token = getTokenFromCookies()
  if (!token) return null
  return verifyToken(token)
}

// Generate a selector (public identifier) for password reset tokens
export function generateSelector(): string {
  return randomBytes(16).toString('hex')
}

// Generate a secure random token (secret) for password reset
export function generateResetSecret(): string {
  return randomBytes(32).toString('hex')
}

// Hash a token for secure storage
export function hashResetToken(token: string): string {
  return bcrypt.hashSync(token, 12)
}

// Verify a token against its hash
export function verifyResetToken(token: string, hashedToken: string): boolean {
  return bcrypt.compareSync(token, hashedToken)
}

// Generate a 6-digit numeric OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Hash an OTP for secure storage
export function hashOTP(otp: string): string {
  return bcrypt.hashSync(otp, 12)
}