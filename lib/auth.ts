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

export function generateToken(payload: { userId: string; role: Role }): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string; role: Role } | null {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
    if (typeof decoded === 'object' && decoded.userId && decoded.role) {
      return { userId: decoded.userId as string, role: decoded.role as Role }
    }
    return null
  } catch {
    return null
  }
}

export function getTokenFromCookies(): string | null {
  const cookieStore = cookies()
  return cookieStore.get('token')?.value || null
}



export function getUserFromToken(): { userId: string; role: Role } | null {
  const token = getTokenFromCookies()
  if (!token) return null
  return verifyToken(token)
}

// Generate a secure random token for password reset
export function generateResetToken(): string {
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