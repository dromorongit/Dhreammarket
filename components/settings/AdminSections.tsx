'use client'

import { useState } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import Toggle from '@/components/settings/Toggle'

interface AdminSectionsProps {
  adminName?: string
}

export default function AdminSections({ adminName }: AdminSectionsProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adminPrefs, setAdminPrefs] = useState({
    defaultTab: 'overview',
    compactView: false,
    autoRefresh: true,
    refreshInterval: '30',
  })

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setMessage('Administration preferences saved')
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setError('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Administration Preferences" description="Configure your admin experience">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Default Dashboard Tab</label>
            <select
              value={adminPrefs.defaultTab}
              onChange={(e) => setAdminPrefs({ ...adminPrefs, defaultTab: e.target.value })}
              className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow"
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
              value={adminPrefs.refreshInterval}
              onChange={(e) => setAdminPrefs({ ...adminPrefs, refreshInterval: e.target.value })}
              className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow"
            >
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="0">Off</option>
            </select>
          </div>

          <div className="space-y-2">
            <Toggle label="Compact View" description="Use compact tables and lists" checked={adminPrefs.compactView} onChange={() => setAdminPrefs({ ...adminPrefs, compactView: !adminPrefs.compactView })} />
            <Toggle label="Auto-refresh" description="Automatically refresh dashboard data" checked={adminPrefs.autoRefresh} onChange={() => setAdminPrefs({ ...adminPrefs, autoRefresh: !adminPrefs.autoRefresh })} />
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
      </SettingsSection>

      <SettingsSection title="Dashboard Preferences" description="Customize your admin dashboard layout">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date Format</label>
            <select className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow">
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Items Per Page</label>
            <select className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Notification Preferences" description="Manage admin notification channels">
        <div className="space-y-2">
          <Toggle label="New User Alerts" description="Notify when a new user registers" defaultChecked />
          <Toggle label="Verification Requests" description="Notify for new vendor verification requests" defaultChecked />
          <Toggle label="System Alerts" description="Critical system notifications" defaultChecked />
          <Toggle label="Order Anomalies" description="Flags for suspicious order patterns" defaultChecked />
        </div>
      </SettingsSection>
    </div>
  )
}
