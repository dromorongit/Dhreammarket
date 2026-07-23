'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import ChangePasswordCard from '@/components/account/ChangePasswordCard'

interface Session {
  id: string
  device: string
  browser: string
  os: string
  ipAddress: string
  location: string
  lastActive: string
  current: boolean
  isExpired: boolean
}

interface SecuritySectionProps {
  onLogoutAll?: () => void
}

export default function SecuritySection({ onLogoutAll }: SecuritySectionProps) {
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/account/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
        setFetchError(null)
      } else {
        const data = await response.json().catch(() => ({}))
        setFetchError(data.error || 'Failed to load sessions')
      }
    } catch {
      setFetchError('An error occurred while loading sessions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId)
    setLogoutMessage(null)
    setLogoutError(null)

    try {
      const response = await fetch(`/api/account/sessions/${sessionId}/revoke`, { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        setLogoutMessage('Session revoked successfully')
        setRefreshing(true)
        await fetchSessions()
        setTimeout(() => setLogoutMessage(null), 3000)
      } else {
        setLogoutError(data.error || 'Failed to revoke session')
      }
    } catch {
      setLogoutError('An error occurred while revoking session')
    } finally {
      setRevokingId(null)
    }
  }

  const handleLogoutAll = async () => {
    setLoggingOutAll(true)
    setLogoutMessage(null)
    setLogoutError(null)
    setFetchError(null)

    try {
      const response = await fetch('/api/account/logout-all', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        setLogoutMessage(data.message || 'Logged out from all devices')
        onLogoutAll?.()
        setRefreshing(true)
        await fetchSessions()
        setTimeout(() => setLogoutMessage(null), 3000)
      } else {
        setLogoutError(data.error || 'Failed to logout from all devices')
      }
    } catch {
      setLogoutError('An error occurred while logging out from all devices')
    } finally {
      setLoggingOutAll(false)
    }
  }

  const formatLastActive = (iso: string): string => {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
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
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : fetchError ? (
            <div className="text-sm text-rose-600 py-4 text-center">{fetchError}</div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-500">No active sessions found.</p>
          ) : (
            <div className="space-y-3">
              {refreshing && (
                <div className="text-xs text-slate-500 mb-2">Updating sessions...</div>
              )}
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0 ${
                    session.isExpired ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {session.device} {session.os ? `(${session.os})` : ''}
                      </p>
                      {session.current && (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          Current
                        </span>
                      )}
                      {session.isExpired && (
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                          Revoked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {session.browser} · {session.ipAddress} · {formatLastActive(session.lastActive)}
                    </p>
                  </div>
                  {!session.isExpired && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(session.id)}
                      disabled={revokingId === session.id}
                    >
                      {revokingId === session.id ? 'Revoking...' : 'Revoke'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

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
            <Button
              variant="outline"
              onClick={handleLogoutAll}
              disabled={loggingOutAll || sessions.length === 0}
              className="w-full sm:w-auto"
            >
              {loggingOutAll ? 'Logging out...' : 'Logout From All Devices'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
