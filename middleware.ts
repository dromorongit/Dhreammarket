export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, type Role } from './lib/auth-middleware'
import { isEmailServiceEnabled } from './lib/feature-flags'
import { isEmailVerificationRequired } from './lib/platform-preferences'
import { updateSessionLastActivity, isSessionExpired } from './lib/session'
import { getPlatformPreferences, getAllowedAdminIps, getMonitoringPreferences } from './lib/platform-preferences'
import { scheduleAuditLogCleanup } from './lib/audit-log'
import { expireIdleSessions } from './lib/session'

let lastAuditCleanup = 0
const AUDIT_CLEANUP_INTERVAL = 60 * 60 * 1000

const AUTH_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/maintenance']
const MAINTENANCE_EXEMPT = [
  '/maintenance',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
]

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  
  const fullUrl = `${pathname}${search || ''}`
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))
  const isMaintenanceExempt = MAINTENANCE_EXEMPT.some(route => pathname.startsWith(route))

  // Maintenance mode check for all app routes
  if (!isMaintenanceExempt) {
    const preferences = await getPlatformPreferences()
    if (preferences.maintenanceMode) {
      const token = request.cookies.get('token')?.value
      if (token) {
        const payload = await verifyToken(token)
        if (payload?.role !== 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/maintenance', request.url))
        }
      } else {
        return NextResponse.redirect(new URL('/maintenance', request.url))
      }
    }
  }

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
    console.log('PATHNAME:', pathname)
    const token = request.cookies.get('token')?.value
    console.log('TOKEN EXISTS:', !!token)

    if (!token) {
      if (!isAuthRoute) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', fullUrl)
        return NextResponse.redirect(redirectUrl)
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const payload = await verifyToken(token)
    if (!payload) {
      if (!isAuthRoute) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', fullUrl)
        return NextResponse.redirect(redirectUrl)
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    await updateSessionLastActivity(
      payload.sessionId,
      request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || undefined,
      request.headers.get('user-agent') || undefined
    )

    const sessionExpired = await isSessionExpired(payload.sessionId)
    if (sessionExpired) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', fullUrl)
      redirectUrl.searchParams.set('reason', 'session_expired')
      return NextResponse.redirect(redirectUrl)
    }

    const isAdminRoute = pathname.startsWith('/dashboard/admin') || pathname.startsWith('/dashboard/super-admin')
    if (isAdminRoute && payload.role !== 'SUPER_ADMIN') {
      const allowedIps = await getAllowedAdminIps()
      if (allowedIps.length > 0) {
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || ''
        const isAllowedIP = allowedIps.some((allowedIp) => {
          if (clientIp === allowedIp) return true
          if (allowedIp.endsWith('/*')) {
            const prefix = allowedIp.slice(0, -2)
            return clientIp.startsWith(prefix)
          }
          return false
        })
        if (!isAllowedIP) {
          return NextResponse.json(
            { error: 'Access denied. Your IP address is not allowed to access the admin dashboard.', status: 403 }
          )
        }
      }
    }

    const allowedRoles = protectedRoutes[protectedRoute as keyof typeof protectedRoutes]
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const emailServiceEnabled = isEmailServiceEnabled()
    const requireEmailVerification = await isEmailVerificationRequired()

    if (pathname.startsWith('/dashboard/customer') && payload.role === 'CUSTOMER') {
      if (requireEmailVerification && emailServiceEnabled) {
        // Check email verification first
        try {
          const { getPrisma } = await import('./lib/prisma')
          const user = await getPrisma().user.findUnique({
            where: { id: payload.userId },
            select: { isEmailVerified: true },
          })
          
          if (!user?.isEmailVerified) {
            const verifyUrl = new URL('/verify-email', request.url)
            if (fullUrl) {
              verifyUrl.searchParams.set('redirect', fullUrl)
            }
            return NextResponse.redirect(verifyUrl)
          }
        } catch (error) {
          console.error('Error checking email verification:', error)
        }
      }
    }
    
    // Additional onboarding check for vendor routes
    if (pathname.startsWith('/dashboard/vendor') && payload.role === 'VENDOR') {
      if (requireEmailVerification && emailServiceEnabled) {
        // Check email verification first
        try {
          const { getPrisma } = await import('./lib/prisma')
          const user = await getPrisma().user.findUnique({
            where: { id: payload.userId },
            select: { isEmailVerified: true },
          })
          
          if (!user?.isEmailVerified) {
            const verifyUrl = new URL('/verify-email', request.url)
            if (fullUrl) {
              verifyUrl.searchParams.set('redirect', fullUrl)
            }
            return NextResponse.redirect(verifyUrl)
          }
        } catch (error) {
          console.error('Error checking email verification:', error)
        }
      }
      
// Allow access to store setup page without onboarding check
       // Use startsWith to allow all store-related subpaths (e.g., /dashboard/vendor/store, /dashboard/vendor/store/edit)
       if (pathname.startsWith('/dashboard/vendor/store')) {
         await runScheduledCleanup(request)
         return NextResponse.next()
       }
       
       // Also allow access to vendor verification page without onboarding check
       if (pathname.startsWith('/dashboard/vendor/verification')) {
         await runScheduledCleanup(request)
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
              if (fullUrl) {
                redirectUrl.searchParams.set('redirect', fullUrl)
              }
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

  await runScheduledCleanup(request)
  return NextResponse.next()
}

// Run scheduled cleanup tasks on admin routes
async function runScheduledCleanup(request: NextRequest) {
  const now = Date.now()
  if (now - lastAuditCleanup < AUDIT_CLEANUP_INTERVAL) return
  if (!request.nextUrl.pathname.startsWith('/dashboard/admin') && !request.nextUrl.pathname.startsWith('/dashboard/super-admin')) return
  lastAuditCleanup = now
  scheduleAuditLogCleanup().catch(() => {})
  expireIdleSessions().catch(() => {})
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/',
    '/checkout',
    '/cart',
    '/search',
    '/about',
    '/contact',
    '/terms',
    '/privacy',
    '/refund',
    '/payment-policy',
    '/faq',
    '/help-center',
    '/marketplace/:path*',
    '/vendor/:path*',
    '/help/:path*',
    '/payment/success',
    '/payment/failed',
    '/payment/cancelled',
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password/:path*',
  ],
}
