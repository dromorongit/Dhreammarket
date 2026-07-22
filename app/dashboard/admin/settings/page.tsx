'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import ChangePasswordCard from '@/components/account/ChangePasswordCard'

interface UserProfile {
  id: string
  email: string
  role: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  address: string | null
}

interface User {
  id: string
  email: string
  role: string
  profile: UserProfile | null
}

export default function AdminSettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user)
      })
      .catch((error) => console.error('Error fetching profile:', error))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-48"></div>
            <div className="h-64 bg-slate-200 rounded"></div>
            <div className="h-64 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-slate-600">Unable to load profile. Please try again.</p>
              <Button asChild className="mt-4">
                <Link href="/login">Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="premium">Account Settings</Badge>
            <div className="flex-1 h-px bg-gradient-to-r from-royal-blue/20 to-transparent"></div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">
            Settings
          </h1>
          <p className="text-slate-600 mt-2">
            Manage your profile and account security
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card variant="elevated">
              <CardHeader>
                <h2 className="text-xl font-semibold text-deep-navy">Profile</h2>
                <p className="text-slate-600 text-sm mt-1">Your account information</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">First Name</label>
                    <div className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-slate-900">
                      {user.profile?.firstName || '—'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Last Name</label>
                    <div className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-slate-900">
                      {user.profile?.lastName || '—'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Email Address</label>
                    <div className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-slate-900">
                      {user.email}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                    <div className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-slate-900">
                      {user.profile?.phone || '—'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Role</label>
                    <div className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-slate-900">
                      {user.role.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <h2 className="text-xl font-semibold text-deep-navy">Security</h2>
                <p className="text-slate-600 text-sm mt-1">Manage your password and account security</p>
              </CardHeader>
              <CardContent>
                <ChangePasswordCard />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card variant="elevated">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">Account Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Status</span>
                    <Badge variant="success" size="sm">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Member Since</span>
                    <span className="text-sm font-medium text-deep-navy">
                      {new Date().toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-600">Email</span>
                    <span className="text-sm font-medium text-deep-navy">{user.email}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Links</h3>
                <div className="space-y-3">
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                    <Link href="/dashboard/admin">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1" />
                      </svg>
                      Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                    <Link href="/dashboard/admin/users">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 3 0 11-4 0 2 3 0 014 0zM7 10a2 3 0 11-4 0 2 3 0 014 0z" />
                      </svg>
                      Manage Users
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
