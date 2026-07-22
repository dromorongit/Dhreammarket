'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { isEmailServiceEnabled } from '@/lib/feature-flags'

function VerifyEmailContent() {
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const emailServiceEnabled = isEmailServiceEnabled()

  useEffect(() => {
    const emailParam = searchParams?.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }
    const redirectParam = searchParams?.get('redirect')
    if (redirectParam) {
      try {
        const decodedUrl = decodeURIComponent(redirectParam)
        if (decodedUrl.startsWith('/')) {
          const authRoutes = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password']
          const isAuthRoute = authRoutes.some(route => decodedUrl.startsWith(route))
          if (!isAuthRoute) {
            setRedirectUrl(decodedUrl)
          }
        }
      } catch {
        // Invalid redirect URL, ignore
      }
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit code')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      const data = await response.json()

      if (response.ok) {
        // Auto-login is handled by the backend - redirect to target page
        if (data.user) {
          // User is auto-authenticated, redirect directly
          const role = data.user.role
          const isOnboarded = data.isOnboarded

          // Determine dashboard path based on role and onboarding status
          let dashboardPath: string
          if (role === 'SUPER_ADMIN') {
            dashboardPath = '/dashboard/super-admin'
          } else if (role === 'ADMIN') {
            dashboardPath = '/dashboard/admin'
          } else if (role === 'VENDOR') {
            // Vendors go to vendor dashboard if onboarded, otherwise to store setup
            dashboardPath = isOnboarded ? '/dashboard/vendor' : '/dashboard/vendor/store'
          } else {
            dashboardPath = '/dashboard/customer'
          }

          // Only allow redirect to non-vendor-dashboard paths; vendor onboarding must be completed via middleware
          const targetUrl = redirectUrl && !redirectUrl.startsWith('/dashboard/vendor')
            ? redirectUrl
            : dashboardPath
          window.location.href = targetUrl
        } else {
          // Fallback: redirect to login if no auto-login
          if (redirectUrl) {
            window.location.href = `/login?redirect=${encodeURIComponent(redirectUrl)}`
          } else {
            window.location.href = '/login'
          }
        }
      } else {
        setError(data.error || 'Verification failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendMessage('')
    setResendLoading(true)

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      setResendMessage(data.message)
    } catch (err) {
      setResendMessage('Failed to resend verification code')
    } finally {
      setResendLoading(false)
    }
  }

  if (!emailServiceEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Email Verification Unavailable
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Email services are currently under maintenance.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Temporary Maintenance</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Email verification is temporarily disabled while we perform maintenance on our email services.
                </p>
                <p className="text-sm text-gray-600 mb-6">
                  Your account may have already been verified automatically. If not, you can still log in and access your dashboard.
                </p>
                <Link href={redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : "/login"}>
                  <Button type="button" className="w-full">Go to Login</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Verify Your Email
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter the 6-digit code sent to your email
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Email Verification</h3>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!searchParams?.get('email')}
              />
              <Input
                label="Verification Code"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
              />
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              {resendMessage && (
                <div className="text-green-600 text-sm">{resendMessage}</div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resendLoading || !email}
              >
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </Button>
<p className="text-center text-sm text-gray-600">
                 <Link href={redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : "/login"} className="font-medium text-blue-600 hover:text-blue-500">
                   Back to Login
                 </Link>
               </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}