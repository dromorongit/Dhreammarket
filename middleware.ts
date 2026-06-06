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
        // Allow access to store setup page without onboarding check
        // Use startsWith to allow all store-related subpaths (e.g., /dashboard/vendor/store, /dashboard/vendor/store/edit)
        if (pathname.startsWith('/dashboard/vendor/store')) {
          return NextResponse.next()
        }
        
        // Also allow access to vendor verification page without onboarding check
        if (pathname.startsWith('/dashboard/vendor/verification')) {
          return NextResponse.next()
        }
       
       try {
         const { isVendorOnboarded } = await import('./lib/onboarding')
         const isOnboarded = await isVendorOnboarded(payload.userId)
         
         // Debug logging
         console.log('[Middleware] Onboarding check for user:', payload.userId, 'isOnboarded:', isOnboarded, 'pathname:', pathname)
         
         if (!isOnboarded) {
           // Redirect to store setup if vendor hasn't completed onboarding
           // But don't redirect if already on the store setup page (prevents loop)
           if (!pathname.startsWith('/dashboard/vendor/store')) {
             const storeSetupUrl = '/dashboard/vendor/store'
             const redirectUrl = new URL(storeSetupUrl, request.url)
             return NextResponse.redirect(redirectUrl)
           }
         }
       } catch (error) {
         console.error('Error checking vendor onboarding status:', error)
         // On error, allow access to prevent redirect loop
         // Don't redirect - just allow access to the page
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