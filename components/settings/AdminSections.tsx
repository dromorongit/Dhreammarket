'use client'

import { useState, useEffect } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import Toggle from '@/components/settings/Toggle'

interface AdminSettings {
  id: string
  defaultDashboardTab: string
  compactView: boolean
  autoRefresh: boolean
  refreshInterval: number
  dateFormat: string
  itemsPerPage: number
  widgetVisibility: Record<string, any>
  analyticsPreferences: Record<string, any>
  defaultFilters: Record<string, any>
  moderationPreferences: Record<string, any>
  reviewPreferences: Record<string, any>
  notifyNewUsers: boolean
  notifyVerificationRequests: boolean
  notifySupportTickets: boolean
  notifyOrderAnomalies: boolean
  notifySecurityAlerts: boolean
  notificationChannels: Record<string, any>
}

interface AdminSectionsProps {
  adminName?: string
}

export default function AdminSections({ adminName }: AdminSectionsProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AdminSettings | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/admin')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = <K extends keyof AdminSettings>(field: K, value: AdminSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/settings/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      if (response.ok) {
        setSettings(data.settings)
        setMessage('Administration preferences saved')
        setTimeout(() => setMessage(null), 3000)
      } else {
        setError(data.error || 'Failed to save preferences')
      }
    } catch {
      setError('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Administration Preferences" description="Configure your admin experience">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Default Dashboard Tab</label>
              <select
                value={settings?.defaultDashboardTab || 'overview'}
                onChange={(e) => updateSetting('defaultDashboardTab', e.target.value)}
                disabled={saving}
                className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
              >
                <option value="overview">Overview</option>
                <option value="users">Users</option>
                <option value="vendors">Vendors</option>
                <option value="orders">Orders</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Auto-refresh Interval</label>
              <select
                value={String(settings?.refreshInterval ?? 30)}
                onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value))}
                disabled={saving}
                className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
              >
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="0">Off</option>
              </select>
            </div>

            <div className="space-y-2">
              <Toggle label="Compact View" description="Use compact tables and lists" checked={settings?.compactView ?? false} onChange={() => updateSetting('compactView', !(settings?.compactView))} disabled={saving} />
              <Toggle label="Auto-refresh" description="Automatically refresh dashboard data" checked={settings?.autoRefresh ?? true} onChange={() => updateSetting('autoRefresh', !(settings?.autoRefresh))} disabled={saving} />
            </div>

            {message && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm text-emerald-700">{message}</p>
              </div>
            )}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="md">
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Dashboard Preferences" description="Customize your admin dashboard layout">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date Format</label>
              <select
                value={settings?.dateFormat || 'MM/DD/YYYY'}
                onChange={(e) => updateSetting('dateFormat', e.target.value)}
                disabled={saving}
                className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Items Per Page</label>
              <select
                value={String(settings?.itemsPerPage ?? 25)}
                onChange={(e) => updateSetting('itemsPerPage', parseInt(e.target.value))}
                disabled={saving}
                className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Notification Preferences" description="Manage admin notification channels">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            <Toggle label="New User Alerts" description="Notify when a new user registers" checked={settings?.notifyNewUsers ?? true} onChange={() => updateSetting('notifyNewUsers', !(settings?.notifyNewUsers))} disabled={saving} />
            <Toggle label="Verification Requests" description="Notify for new vendor verification requests" checked={settings?.notifyVerificationRequests ?? true} onChange={() => updateSetting('notifyVerificationRequests', !(settings?.notifyVerificationRequests))} disabled={saving} />
            <Toggle label="Support Tickets" description="Notify on new or updated support tickets" checked={settings?.notifySupportTickets ?? true} onChange={() => updateSetting('notifySupportTickets', !(settings?.notifySupportTickets))} disabled={saving} />
            <Toggle label="Order Anomalies" description="Flags for suspicious order patterns" checked={settings?.notifyOrderAnomalies ?? true} onChange={() => updateSetting('notifyOrderAnomalies', !(settings?.notifyOrderAnomalies))} disabled={saving} />
            <Toggle label="Security Alerts" description="Immediate alerts for security events" checked={settings?.notifySecurityAlerts ?? true} onChange={() => updateSetting('notifySecurityAlerts', !(settings?.notifySecurityAlerts))} disabled={saving} />
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
