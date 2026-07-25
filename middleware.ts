import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyTokenEdge, type TokenPayload } from './lib/auth-edge'

const AUTH_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password']

const protectedRoutes: Record<string, string[]> = {
  '/dashboard/admin': ['ADMIN', 'SUPER_ADMIN'],
  '/dashboard/super-admin': ['SUPER_ADMIN'],
  '/dashboard/vendor': ['VENDOR', 'ADMIN', 'SUPER_ADMIN'],
  '/dashboard/customer': ['CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN'],
}

export async function middleware(request: NextRequest) {
  console.log('[MIDDLEWARE] Request:', request.method, request.nextUrl.pathname)

  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search
  const fullUrl = `${pathname}${search || ''}`
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))

  const matchedRoute = Object.keys(protectedRoutes).find(route =>
    pathname.startsWith(route)
  )

  if (!matchedRoute) {
    return NextResponse.next()
  }

  const token = request.cookies.get('token')?.value

  if (!token) {
    if (!isAuthRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', fullUrl)
      console.log('[MIDDLEWARE] No token – redirecting to login')
      return NextResponse.redirect(loginUrl)
    }
    console.log('[MIDDLEWARE] No token – auth route, redirecting to login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload: TokenPayload | null = await verifyTokenEdge(token)
  console.log('[MIDDLEWARE] Token verification payload:', payload ? 'valid' : 'null/invalid')

  if (!payload) {
    if (!isAuthRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', fullUrl)
      console.log('[MIDDLEWARE] Invalid token – redirecting to login')
      return NextResponse.redirect(loginUrl)
    }
    console.log('[MIDDLEWARE] Invalid token – auth route, redirecting to login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  console.log('[MIDDLEWARE] User authenticated:', payload.userId, 'role:', payload.role)

  const allowedRoles = protectedRoutes[matchedRoute]
  console.log('[MIDDLEWARE] Allowed roles for', matchedRoute, ':', allowedRoles, 'user role:', payload.role)

  if (!allowedRoles.includes(payload.role)) {
    console.log('[MIDDLEWARE] Role not authorized – redirecting to home')
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
