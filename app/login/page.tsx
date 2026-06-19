'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PasswordInput } from '@/components/PasswordInput'
import { Card, CardContent, CardHeader } from '@/components/Card'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  useEffect(() => {
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

    if (!email || !password) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.needsVerification) {
          const redirectParam = redirectUrl ? `&redirect=${encodeURIComponent(redirectUrl)}` : ''
          window.location.href = `/verify-email?email=${encodeURIComponent(email)}${redirectParam}`
        } else {
          const role = data.user.role
          // Vendors go to store setup unless redirect specified (onboarding cannot be bypassed)
          const dashboardPath = role === 'SUPER_ADMIN' ? '/dashboard/super-admin' :
                              role === 'ADMIN' ? '/dashboard/admin' :
                              role === 'VENDOR' ? '/dashboard/vendor/store' :
                              '/dashboard/customer'
          // Only allow redirect to non-dashboard paths; vendor onboarding must be completed
          const targetUrl = redirectUrl && !redirectUrl.startsWith('/dashboard/vendor') 
            ? redirectUrl 
            : dashboardPath
          window.location.href = targetUrl
        }
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
         <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
           Sign in to Dhream Market
         </h2>
<p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href={redirectUrl ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : "/register"} className="font-medium text-blue-600 hover:text-blue-500">
              create a new account
            </Link>
          </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Welcome back</h3>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                  Forgot your password?
                </Link>
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}