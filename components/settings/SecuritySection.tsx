'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import ChangePasswordCard from '@/components/account/ChangePasswordCard'

interface SecuritySectionProps {
  onLogoutAll?: () => void
}

export default function SecuritySection({ onLogoutAll }: SecuritySectionProps) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [sessions] = useState([
    { device: 'Current Session', location: 'Accra, Ghana', lastActive: 'Now', current: true },
    { device: 'Chrome on Windows', location: 'Accra, Ghana', lastActive: '2 hours ago', current: false },
  ])

  const handleLogoutAll = async () => {
    setLoggingOut(true)
    setLogoutMessage(null)
    setLogoutError(null)

    try {
      const response = await fetch('/api/account/logout-all', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        setLogoutMessage(data.message || 'Logged out from all devices')
        onLogoutAll?.()
      } else {
        setLogoutError(data.error || 'Failed to logout from all devices')
      }
    } catch {
      setLogoutError('An error occurred while logging out from all devices')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader>
          <h2 className="text-xl font-semibold text-deep-navy">Security</h2>
          <p className="text-slate-600 text-sm mt-1">Manage your password and account security</p>
        </CardHeader>
        <CardContent>
          <ChangePasswordCard />
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <h2 className="text-xl font-semibold text-deep-navy">Active Sessions</h2>
          <p className="text-slate-600 text-sm mt-1">Manage devices where you are currently logged in</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.map((session, idx) => (
              <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{session.device}</p>
                  <p className="text-xs text-slate-500">{session.location} · {session.lastActive}</p>
                </div>
                {session.current && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Current</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-stretch gap-3">
            {logoutMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm text-emerald-700">{logoutMessage}</p>
              </div>
            )}
            {logoutError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-sm text-rose-700">{logoutError}</p>
              </div>
            )}
            <Button variant="outline" onClick={handleLogoutAll} disabled={loggingOut} className="w-full sm:w-auto">
              {loggingOut ? 'Logging out...' : 'Logout From All Devices'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
