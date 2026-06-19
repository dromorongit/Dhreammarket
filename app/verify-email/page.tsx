'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card, CardContent, CardHeader } from '@/components/Card'

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

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }
    const redirectParam = searchParams.get('redirect')
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
          
          // For vendors, check if they need to complete onboarding
          if (role === 'VENDOR' && !redirectUrl) {
            // Redirect to store setup for vendor onboarding (cannot be bypassed via redirect param)
            window.location.href = '/dashboard/vendor/store'
          } else {
            const dashboardPath = role === 'SUPER_ADMIN' ? '/dashboard/super-admin' :
                                    role === 'ADMIN' ? '/dashboard/admin' :
                                    role === 'VENDOR' ? '/dashboard/vendor/store' :
                                    '/dashboard/customer'
            const targetUrl = redirectUrl || dashboardPath
            window.location.href = targetUrl
          }
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
                disabled={!!searchParams.get('email')}
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