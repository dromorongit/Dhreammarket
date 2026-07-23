'use client'

import { useState, useEffect } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import Toggle from '@/components/settings/Toggle'

interface SuperAdminSettings {
  id: string
  maintenanceMode: boolean
  registrationOpen: boolean
  newVendorApproval: boolean
  autoApproveProducts: boolean
  defaultCurrency: string
  platformFee: number
  platformName: string | null
  platformTimezone: string
  regionalDefaults: Record<string, any>
  brandingPreferences: Record<string, any>
  auditLogRetention: string
  sessionTimeout: string
  allowedAdminIps: any[]
  monitoringPreferences: Record<string, any>
  platformBehaviourPreferences: Record<string, any>
  notifySystemOutage: boolean
  notifyFeatureAnnouncements: boolean
  notifyPolicyUpdates: boolean
  notifySecurityAlerts: boolean
  notifyInfrastructureAlerts: boolean
  notifyFinanceAlerts: boolean
}

interface SuperAdminSectionsProps {
  platformName?: string
}

export default function SuperAdminSections({ platformName }: SuperAdminSectionsProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SuperAdminSettings | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/super-admin')
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

  const updateSetting = <K extends keyof SuperAdminSettings>(field: K, value: SuperAdminSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/settings/super-admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      if (response.ok) {
        setSettings(data.settings)
        setMessage('Platform preferences saved')
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
      <SettingsSection title="Platform Preferences" description="Global platform configuration">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Platform Name"
                  value={settings?.platformName || platformName || 'Dhreamarket'}
                  onChange={(e) => updateSetting('platformName', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Default Currency</label>
                <select
                  value={settings?.defaultCurrency || 'GHS'}
                  onChange={(e) => updateSetting('defaultCurrency', e.target.value)}
                  disabled={saving}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
                >
                  <option value="GHS">GHS - Ghanaian Cedi</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Platform Fee (%)</label>
                <Input
                  label=""
                  type="number"
                  value={String(settings?.platformFee ?? 2.5)}
                  onChange={(e) => updateSetting('platformFee', parseFloat(e.target.value) || 0)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
                <select
                  value={settings?.platformTimezone || 'Africa/Accra'}
                  onChange={(e) => updateSetting('platformTimezone', e.target.value)}
                  disabled={saving}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
                >
                  <option value="Africa/Accra">Accra (GMT)</option>
                  <option value="Africa/Lagos">Lagos (WAT)</option>
                  <option value="Africa/Nairobi">Nairobi (EAT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Regional Defaults (JSON)</label>
                <Input
                  label=""
                  value={JSON.stringify(settings?.regionalDefaults || {})}
                  onChange={(e) => {
                    try {
                      updateSetting('regionalDefaults', JSON.parse(e.target.value))
                    } catch {
                      // ignore invalid json during typing
                    }
                  }}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <Toggle label="Maintenance Mode" description="Temporarily disable the platform for maintenance" checked={settings?.maintenanceMode ?? false} onChange={() => updateSetting('maintenanceMode', !(settings?.maintenanceMode))} disabled={saving} />
              <Toggle label="Open Registration" description="Allow new user registrations" checked={settings?.registrationOpen ?? true} onChange={() => updateSetting('registrationOpen', !(settings?.registrationOpen))} disabled={saving} />
              <Toggle label="Require Vendor Approval" description="New vendors require admin approval" checked={settings?.newVendorApproval ?? true} onChange={() => updateSetting('newVendorApproval', !(settings?.newVendorApproval))} disabled={saving} />
              <Toggle label="Auto-approve Products" description="Automatically approve new product listings" checked={settings?.autoApproveProducts ?? false} onChange={() => updateSetting('autoApproveProducts', !(settings?.autoApproveProducts))} disabled={saving} />
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
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Global Notification Preferences" description="Platform-wide notification settings">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            <Toggle label="System Outage Alerts" description="Notify all users during outages" checked={settings?.notifySystemOutage ?? true} onChange={() => updateSetting('notifySystemOutage', !(settings?.notifySystemOutage))} disabled={saving} />
            <Toggle label="Feature Announcements" description="Send emails for new features" checked={settings?.notifyFeatureAnnouncements ?? true} onChange={() => updateSetting('notifyFeatureAnnouncements', !(settings?.notifyFeatureAnnouncements))} disabled={saving} />
            <Toggle label="Policy Updates" description="Notify users of terms or policy changes" checked={settings?.notifyPolicyUpdates ?? true} onChange={() => updateSetting('notifyPolicyUpdates', !(settings?.notifyPolicyUpdates))} disabled={saving} />
            <Toggle label="Security Alerts" description="Immediate alerts for security events" checked={settings?.notifySecurityAlerts ?? true} onChange={() => updateSetting('notifySecurityAlerts', !(settings?.notifySecurityAlerts))} disabled={saving} />
            <Toggle label="Infrastructure Alerts" description="Monitoring and infrastructure notifications" checked={settings?.notifyInfrastructureAlerts ?? true} onChange={() => updateSetting('notifyInfrastructureAlerts', !(settings?.notifyInfrastructureAlerts))} disabled={saving} />
            <Toggle label="Finance Alerts" description="Payout, settlement, and finance notifications" checked={settings?.notifyFinanceAlerts ?? true} onChange={() => updateSetting('notifyFinanceAlerts', !(settings?.notifyFinanceAlerts))} disabled={saving} />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="System Administration Preferences" description="Administration tool configuration">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Audit Log Retention</label>
              <select
                value={settings?.auditLogRetention || 'forever'}
                onChange={(e) => updateSetting('auditLogRetention', e.target.value)}
                disabled={saving}
                className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="forever">Forever</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Session Timeout</label>
              <select
                value={settings?.sessionTimeout || '8'}
                onChange={(e) => updateSetting('sessionTimeout', e.target.value)}
                disabled={saving}
                className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
              >
                <option value="1">1 hour</option>
                <option value="4">4 hours</option>
                <option value="8">8 hours</option>
                <option value="24">24 hours</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Admin IPs (comma separated)</label>
              <Input
                label=""
                value={(settings?.allowedAdminIps || []).join(', ')}
                onChange={(e) => updateSetting('allowedAdminIps', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                disabled={saving}
              />
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
