'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'

export default function CreateAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    position: '',
  })

  useEffect(() => {
    checkAuthorization()
  }, [])

  const checkAuthorization = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const user = await response.json()
        if (user.user.role === 'SUPER_ADMIN') {
          setAuthorized(true)
        } else {
          setError('Only SUPER_ADMIN can access this page')
        }
      } else {
        setError('Authentication required')
      }
    } catch (err) {
      setError('Failed to verify permissions')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/users/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create admin employee')
        return
      }

      alert(`Admin employee created successfully!\n\nEmail: ${data.user.email}\nRole: ${data.user.role}\nPosition: ${data.user.position}`)
      setFormData({ name: '', email: '', password: '', position: '' })
    } catch (error) {
      console.error('Error creating admin:', error)
      setError('Failed to create admin employee')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-80 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!authorized && error) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card variant="elevated">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-deep-navy mb-2">Access Denied</h2>
              <p className="text-slate-600">{error}</p>
              <Button onClick={() => router.push('/dashboard/admin')} variant="primary" className="mt-6">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-deep-navy">Create Admin Employee</h1>
          <p className="text-slate-600 mt-1">Add a new admin staff member with specific position</p>
        </div>

        <Card variant="elevated">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Position / Role *
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                  placeholder="e.g., Customer Support Manager, Inventory Specialist, Sales Admin"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  This defines the employee&apos;s job function (e.g., &quot;Order Manager&quot;, &quot;Product Moderator&quot;)
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold">Important</p>
                    <p>This will create an ADMIN account with the specified position. The employee can log in and manage vendors, products, and orders based on their permissions.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push('/dashboard/admin')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Creating...' : 'Create Admin Employee'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
