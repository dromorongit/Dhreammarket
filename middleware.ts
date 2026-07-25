export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, type Role } from './lib/auth-middleware'
import { isEmailServiceEnabled } from './lib/feature-flags'
import { updateSessionLastActivity } from './lib/session'

const AUTH_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password']

export async function middleware(request: NextRequest) {
  console.log('[MIDDLEWARE] Request started:', request.method, request.nextUrl.pathname)
  const { pathname, search } = request.nextUrl
  
  const fullUrl = `${pathname}${search || ''}`
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))
  console.log('[MIDDLEWARE] isAuthRoute:', isAuthRoute, 'pathname:', pathname)

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
    console.log('[MIDDLEWARE] Protected route detected:', protectedRoute, 'for pathname:', pathname)
    console.log('[MIDDLEWARE] PATHNAME:', pathname)
    const token = request.cookies.get('token')?.value
    console.log('[MIDDLEWARE] TOKEN EXISTS:', !!token)

    if (!token) {
      if (!isAuthRoute) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', fullUrl)
        console.log('[MIDDLEWARE] No token - redirecting to login:', redirectUrl.toString())
        return NextResponse.redirect(redirectUrl)
      }
      console.log('[MIDDLEWARE] No token - auth route, redirecting to login')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const payload = await verifyToken(token)
    console.log('[MIDDLEWARE] Token verification payload:', payload ? 'valid' : 'null/invalid')
    if (!payload) {
      if (!isAuthRoute) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', fullUrl)
        console.log('[MIDDLEWARE] Invalid token - redirecting to login:', redirectUrl.toString())
        return NextResponse.redirect(redirectUrl)
      }
      console.log('[MIDDLEWARE] Invalid token - auth route, redirecting to login')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    console.log('[MIDDLEWARE] User authenticated:', payload.userId, 'role:', payload.role)

    await updateSessionLastActivity(
      payload.sessionId,
      request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || undefined,
      request.headers.get('user-agent') || undefined
    )
    console.log('[MIDDLEWARE] Session last activity updated for session:', payload.sessionId)

    const allowedRoles = protectedRoutes[protectedRoute as keyof typeof protectedRoutes]
    console.log('[MIDDLEWARE] Allowed roles for route:', protectedRoute, 'are:', allowedRoles, 'user role:', payload.role)
    if (!allowedRoles.includes(payload.role)) {
      console.log('[MIDDLEWARE] Role not authorized - redirecting to home. User role:', payload.role, 'Allowed:', allowedRoles)
      return NextResponse.redirect(new URL('/', request.url))
    }

    const emailServiceEnabled = isEmailServiceEnabled()
    console.log('[MIDDLEWARE] Email service enabled:', emailServiceEnabled)

    if (pathname.startsWith('/dashboard/customer') && payload.role === 'CUSTOMER') {
      if (emailServiceEnabled) {
        // Check email verification first
        try {
          const { getPrisma } = await import('./lib/prisma')
          console.log('[MIDDLEWARE] Checking email verification for customer user:', payload.userId)
          const user = await getPrisma().user.findUnique({
            where: { id: payload.userId },
            select: { isEmailVerified: true },
          })
          console.log('[MIDDLEWARE] Email verification result:', user ? user.isEmailVerified : 'user not found')
          
          if (!user?.isEmailVerified) {
            const verifyUrl = new URL('/verify-email', request.url)
            if (fullUrl) {
              verifyUrl.searchParams.set('redirect', fullUrl)
            }
            console.log('[MIDDLEWARE] Email not verified - redirecting to verify-email')
            return NextResponse.redirect(verifyUrl)
          }
        } catch (error) {
          console.error('[MIDDLEWARE] Error checking email verification:', error)
        }
      }
    }
    
    // Additional onboarding check for vendor routes
    if (pathname.startsWith('/dashboard/vendor') && payload.role === 'VENDOR') {
      if (emailServiceEnabled) {
        // Check email verification first
        try {
          const { getPrisma } = await import('./lib/prisma')
          console.log('[MIDDLEWARE] Checking email verification for vendor user:', payload.userId)
          const user = await getPrisma().user.findUnique({
            where: { id: payload.userId },
            select: { isEmailVerified: true },
          })
          console.log('[MIDDLEWARE] Vendor email verification result:', user ? user.isEmailVerified : 'user not found')
          
          if (!user?.isEmailVerified) {
            const verifyUrl = new URL('/verify-email', request.url)
            if (fullUrl) {
              verifyUrl.searchParams.set('redirect', fullUrl)
            }
            console.log('[MIDDLEWARE] Vendor email not verified - redirecting to verify-email')
            return NextResponse.redirect(verifyUrl)
          }
        } catch (error) {
          console.error('[MIDDLEWARE] Error checking vendor email verification:', error)
        }
      }
      
      // Allow access to store setup page without onboarding check
      // Use startsWith to allow all store-related subpaths (e.g., /dashboard/vendor/store, /dashboard/vendor/store/edit)
      if (pathname.startsWith('/dashboard/vendor/store')) {
        console.log('[MIDDLEWARE] Allowing vendor store route access:', pathname)
        return NextResponse.next()
      }
      
      // Also allow access to vendor verification page without onboarding check
      if (pathname.startsWith('/dashboard/vendor/verification')) {
        console.log('[MIDDLEWARE] Allowing vendor verification route access:', pathname)
        return NextResponse.next()
      }
        
        try {
          const { isVendorOnboarded } = await import('./lib/onboarding')
          console.log('[MIDDLEWARE] Checking vendor onboarding for user:', payload.userId)
          const isOnboarded = await isVendorOnboarded(payload.userId)
          
          // Debug logging
          console.log('[MIDDLEWARE] Onboarding check for user:', payload.userId, 'isOnboarded:', isOnboarded, 'pathname:', pathname)
          
          if (!isOnboarded) {
            // Redirect to store setup if vendor hasn't completed onboarding
            // But don't redirect if already on the store setup page (prevents loop)
            if (!pathname.startsWith('/dashboard/vendor/store')) {
              const storeSetupUrl = '/dashboard/vendor/store'
              const redirectUrl = new URL(storeSetupUrl, request.url)
              if (fullUrl) {
                redirectUrl.searchParams.set('redirect', fullUrl)
              }
              console.log('[MIDDLEWARE] Vendor not onboarded - redirecting to store setup:', redirectUrl.toString())
              return NextResponse.redirect(redirectUrl)
            }
            console.log('[MIDDLEWARE] Vendor not onboarded but on store setup page - allowing access')
          }
        } catch (error) {
          console.error('[MIDDLEWARE] Error checking vendor onboarding status:', error)
          // On error, allow access to prevent redirect loop
          // Don't redirect - just allow access to the page
        }
      }
    console.log('[MIDDLEWARE] Request passing through, calling NextResponse.next() for pathname:', pathname)
  }

  console.log('[MIDDLEWARE] Request completed, returning NextResponse.next()')
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
}