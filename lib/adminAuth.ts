import { getUserFromToken, type Role } from './auth'
import { NextResponse } from 'next/server'

export interface AdminUser {
  userId: string
  role: Role
}

export function requireAdmin(): AdminUser | NextResponse {
  console.log('[ADMIN AUTH] requireAdmin called')
  const user = getUserFromToken()
  console.log('[ADMIN AUTH] getUserFromToken result:', user ? `userId=${user.userId} role=${user.role}` : 'null')
  
  if (!user) {
    console.log('[ADMIN AUTH] No user found, returning 401')
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    console.log('[ADMIN AUTH] Invalid role:', user.role, 'returning 403')
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  
  console.log('[ADMIN AUTH] Access granted for user:', user.userId)
  return user
}

export function requireSuperAdmin(): AdminUser | NextResponse {
  console.log('[ADMIN AUTH] requireSuperAdmin called')
  const user = getUserFromToken()
  console.log('[ADMIN AUTH] getUserFromToken result:', user ? `userId=${user.userId} role=${user.role}` : 'null')
  
  if (!user) {
    console.log('[ADMIN AUTH] No user found, returning 401')
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  
  if (user.role !== 'SUPER_ADMIN') {
    console.log('[ADMIN AUTH] Invalid role for super admin:', user.role, 'returning 403')
    return NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
  }
  
  console.log('[ADMIN AUTH] Super admin access granted for user:', user.userId)
  return user
}

export function requireAdminReturnUser(): { userId: string; role: Role } | null {
  console.log('[ADMIN AUTH] requireAdminReturnUser called')
  const user = getUserFromToken()
  console.log('[ADMIN AUTH] getUserFromToken result:', user ? `userId=${user.userId} role=${user.role}` : 'null')
  
  if (!user) {
    console.log('[ADMIN AUTH] No user found, returning null')
    return null
  }
  
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    console.log('[ADMIN AUTH] Invalid role:', user.role, 'returning null')
    return null
  }
  
  console.log('[ADMIN AUTH] Access granted for user:', user.userId)
  return user
}