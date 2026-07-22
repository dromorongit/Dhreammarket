'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SettingsContext } from './SettingsContext'

interface UserProfile {
  id: string
  email: string
  role: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  address: string | null
  avatar?: string | null
  darkMode?: boolean
  language?: string
  currency?: string
  timezone?: string
  emailNotifications?: boolean
  orderNotifications?: boolean
  promotionalNotifications?: boolean
  systemNotifications?: boolean
}

interface User {
  id: string
  email: string
  role: string
  profile: UserProfile | null
}

interface SettingsShellProps {
  children: React.ReactNode
  role: string
  dashboardHref: string
}

const roleLabels: Record<string, string> = {
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
}

export default function SettingsShell({ children, role, dashboardHref }: SettingsShellProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }, [])

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false))
  }, [fetchProfile])

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
    <SettingsContext.Provider value={{ user, setUser, refreshUser: fetchProfile }}>
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="premium">Account Settings</Badge>
              <div className="flex-1 h-px bg-gradient-to-r from-royal-blue/20 to-transparent"></div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">Settings</h1>
            <p className="text-slate-600 mt-2">Manage your profile, preferences, and account security</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {children}
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
                      <span className="text-sm text-slate-600">Role</span>
                      <span className="text-sm font-medium text-deep-navy">{roleLabels[role] || role}</span>
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
                      <Link href={dashboardHref}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1" />
                        </svg>
                        Dashboard
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </SettingsContext.Provider>
  )
}
