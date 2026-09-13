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
    const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    response.cookies.set('token', '', { expires: new Date(0), path: '/' })
    return response
  }

  const outcome = await verifyToken(token)
  if (!outcome.authenticated) {
    const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    response.cookies.set('token', '', { expires: new Date(0), path: '/' })
    return response
  }

  const user = outcome
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  return user
}

export async function requireSuperAdmin(): Promise<AdminUser | NextResponse> {
  const token = cookies().get('token')?.value
  if (!token) {
    const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    response.cookies.set('token', '', { expires: new Date(0), path: '/' })
    return response
  }

  const outcome = await verifyToken(token)
  if (!outcome.authenticated) {
    const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    response.cookies.set('token', '', { expires: new Date(0), path: '/' })
    return response
  }

  const user = outcome
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

  const outcome = await verifyToken(token)
  if (!outcome.authenticated) {
    return null
  }

  const user = outcome
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return null
  }

  return user
}