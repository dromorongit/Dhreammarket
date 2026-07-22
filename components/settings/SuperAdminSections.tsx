'use client'

import { useState } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import Toggle from '@/components/settings/Toggle'

interface SuperAdminSectionsProps {
  platformName?: string
}

export default function SuperAdminSections({ platformName }: SuperAdminSectionsProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [platformPrefs, setPlatformPrefs] = useState({
    maintenanceMode: false,
    registrationOpen: true,
    newVendorApproval: true,
    autoApproveProducts: false,
    defaultCurrency: 'GHS',
    platformFee: '2.5',
  })

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setMessage('Platform preferences saved')
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setError('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Platform Preferences" description="Global platform configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input label="Platform Name" value={platformName || 'Dhreamarket'} onChange={(e) => {}} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Default Currency</label>
            <select
              value={platformPrefs.defaultCurrency}
              onChange={(e) => setPlatformPrefs({ ...platformPrefs, defaultCurrency: e.target.value })}
              className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow"
            >
              <option value="GHS">GHS - Ghanaian Cedi</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Platform Fee (%)</label>
            <Input label="" type="number" value={platformPrefs.platformFee} onChange={(e) => setPlatformPrefs({ ...platformPrefs, platformFee: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Toggle label="Maintenance Mode" description="Temporarily disable the platform for maintenance" checked={platformPrefs.maintenanceMode} onChange={() => setPlatformPrefs({ ...platformPrefs, maintenanceMode: !platformPrefs.maintenanceMode })} />
          <Toggle label="Open Registration" description="Allow new user registrations" checked={platformPrefs.registrationOpen} onChange={() => setPlatformPrefs({ ...platformPrefs, registrationOpen: !platformPrefs.registrationOpen })} />
          <Toggle label="Require Vendor Approval" description="New vendors require admin approval" checked={platformPrefs.newVendorApproval} onChange={() => setPlatformPrefs({ ...platformPrefs, newVendorApproval: !platformPrefs.newVendorApproval })} />
          <Toggle label="Auto-approve Products" description="Automatically approve new product listings" checked={platformPrefs.autoApproveProducts} onChange={() => setPlatformPrefs({ ...platformPrefs, autoApproveProducts: !platformPrefs.autoApproveProducts })} />
        </div>

        {message && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-sm text-emerald-700">{message}</p>
          </div>
        )}
        {error && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="md">
            {saving ? 'Saving...' : 'Save Platform Settings'}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Global Notification Preferences" description="Platform-wide notification settings">
        <div className="space-y-2">
          <Toggle label="System Outage Alerts" description="Notify all users during outages" defaultChecked />
          <Toggle label="Feature Announcements" description="Send emails for new features" defaultChecked />
          <Toggle label="Policy Updates" description="Notify users of terms or policy changes" defaultChecked />
          <Toggle label="Security Alerts" description="Immediate alerts for security events" defaultChecked />
        </div>
      </SettingsSection>

      <SettingsSection title="System Administration Preferences" description="Administration tool configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Audit Log Retention</label>
            <select className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow">
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="forever">Forever</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Session Timeout</label>
            <select className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow">
              <option value="1">1 hour</option>
              <option value="4">4 hours</option>
              <option value="8">8 hours</option>
              <option value="24">24 hours</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Admin IPs (comma separated)</label>
            <Input label="" placeholder="192.168.1.1, 10.0.0.1" />
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
