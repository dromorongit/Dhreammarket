import { getUserFromToken, type Role } from './auth'
import { NextResponse } from 'next/server'

export interface AdminUser {
  userId: string
  role: Role
}

export function requireAdmin(): AdminUser | NextResponse {
  const user = getUserFromToken()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  return user
}

export function requireSuperAdmin(): AdminUser | NextResponse {
  const user = getUserFromToken()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
  }

  return user
}

export function requireAdminReturnUser(): { userId: string; role: Role } | null {
  const user = getUserFromToken()

  if (!user) {
    return null
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return null
  }

  return user
}