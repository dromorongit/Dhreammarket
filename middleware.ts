export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, type Role } from './lib/auth-middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Define protected routes
  const protectedRoutes = {
    '/dashboard/admin': ['ADMIN', 'SUPER_ADMIN'],
    '/dashboard/super-admin': ['SUPER_ADMIN'],
    '/dashboard/vendor': ['VENDOR', 'ADMIN', 'SUPER_ADMIN'],
    '/dashboard/customer': ['CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN'],
  }

  // Check if the current path is protected
  const protectedRoute = Object.keys(protectedRoutes).find(route =>
    pathname.startsWith(route)
  )

  if (protectedRoute) {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const allowedRoles = protectedRoutes[protectedRoute as keyof typeof protectedRoutes]
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Additional onboarding check for vendor routes
    if (pathname.startsWith('/dashboard/vendor') && payload.role === 'VENDOR') {
      const { isVendorOnboarded } = await import('./lib/onboarding')
      const isOnboarded = await isVendorOnboarded(payload.userId)
      if (!isOnboarded) {
        // Redirect to store setup if vendor hasn't completed onboarding
        return NextResponse.redirect(new URL('/dashboard/vendor/store', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
}