import { verifyToken, type Role } from './auth-middleware'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export interface AdminUser {
  userId: string
  role: Role
}

export async function requireAdmin(): Promise<AdminUser | NextResponse> {
  const token = cookies().get('token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const user = await verifyToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  return user
}

export async function requireSuperAdmin(): Promise<AdminUser | NextResponse> {
  const token = cookies().get('token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const user = await verifyToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
  }

  return user
}

export async function requireAdminReturnUser(): Promise<{ userId: string; role: Role } | null> {
  const token = cookies().get('token')?.value
  if (!token) {
    return null
  }

  const user = await verifyToken(token)
  if (!user) {
    return null
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return null
  }

  return user
}