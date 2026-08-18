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
  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search
  const fullUrl = `${pathname}${search || ''}`
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))

  const matchedRoute = Object.keys(protectedRoutes).find(route =>
    pathname.startsWith(route)
  )

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-invoke-path', pathname)

  if (!matchedRoute) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  const token = request.cookies.get('token')?.value

  if (!token) {
    if (!isAuthRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', fullUrl)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload: TokenPayload | null = await verifyTokenEdge(token)

  if (!payload) {
    if (!isAuthRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', fullUrl)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const allowedRoles = protectedRoutes[matchedRoute]

  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
