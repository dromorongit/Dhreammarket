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

      <SettingsSection title="Monitoring Preferences" description="Control monitoring alerts and notifications">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            <Toggle label="Enable All Monitoring Alerts" description="Master toggle for all monitoring alerts" checked={settings?.monitoringPreferences?.alertsEnabled ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), alertsEnabled: !(settings?.monitoringPreferences?.alertsEnabled) })} disabled={saving} />
            <Toggle label="Email Alerts" description="Send email notifications for alerts" checked={settings?.monitoringPreferences?.emailAlerts ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), emailAlerts: !(settings?.monitoringPreferences?.emailAlerts) })} disabled={saving} />
            <Toggle label="System Outage Alerts" description="Alerts when system outages are detected" checked={settings?.monitoringPreferences?.systemOutageAlerts ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), systemOutageAlerts: !(settings?.monitoringPreferences?.systemOutageAlerts) })} disabled={saving} />
            <Toggle label="Feature Announcement Alerts" description="Notifications for new features" checked={settings?.monitoringPreferences?.featureAnnouncementAlerts ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), featureAnnouncementAlerts: !(settings?.monitoringPreferences?.featureAnnouncementAlerts) })} disabled={saving} />
            <Toggle label="Policy Update Alerts" description="Notifications for policy changes" checked={settings?.monitoringPreferences?.policyUpdateAlerts ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), policyUpdateAlerts: !(settings?.monitoringPreferences?.policyUpdateAlerts) })} disabled={saving} />
            <Toggle label="Security Alerts" description="Immediate alerts for security events" checked={settings?.monitoringPreferences?.securityAlerts ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), securityAlerts: !(settings?.monitoringPreferences?.securityAlerts) })} disabled={saving} />
            <Toggle label="Infrastructure Alerts" description="Server and infrastructure notifications" checked={settings?.monitoringPreferences?.infrastructureAlerts ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), infrastructureAlerts: !(settings?.monitoringPreferences?.infrastructureAlerts) })} disabled={saving} />
            <Toggle label="Finance Alerts" description="Payout, settlement, and finance notifications" checked={settings?.monitoringPreferences?.financeAlerts ?? true} onChange={() => updateSetting('monitoringPreferences', { ...(settings?.monitoringPreferences || {}), financeAlerts: !(settings?.monitoringPreferences?.financeAlerts) })} disabled={saving} />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Platform Behaviour Preferences" description="Control platform-wide behavioural settings">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Toggle label="Require Email Verification" description="Users must verify email before accessing full platform" checked={settings?.platformBehaviourPreferences?.requireEmailVerification ?? false} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), requireEmailVerification: !(settings?.platformBehaviourPreferences?.requireEmailVerification) })} disabled={saving} />
            <Toggle label="Auto-approve Vendors" description="Automatically approve new vendor registrations" checked={settings?.platformBehaviourPreferences?.autoApproveVendors ?? false} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), autoApproveVendors: !(settings?.platformBehaviourPreferences?.autoApproveVendors) })} disabled={saving} />
            <Toggle label="Vendor Messaging" description="Allow vendors to message customers" checked={settings?.platformBehaviourPreferences?.enableVendorMessaging ?? true} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), enableVendorMessaging: !(settings?.platformBehaviourPreferences?.enableVendorMessaging) })} disabled={saving} />
            <Toggle label="Product Reviews" description="Allow customers to leave product reviews" checked={settings?.platformBehaviourPreferences?.enableProductReviews ?? true} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), enableProductReviews: !(settings?.platformBehaviourPreferences?.enableProductReviews) })} disabled={saving} />
            <Toggle label="Wishlist" description="Allow users to save products to a wishlist" checked={settings?.platformBehaviourPreferences?.enableWishlist ?? true} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), enableWishlist: !(settings?.platformBehaviourPreferences?.enableWishlist) })} disabled={saving} />
            <Toggle label="Product Comparisons" description="Allow users to compare products side by side" checked={settings?.platformBehaviourPreferences?.enableComparisons ?? true} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), enableComparisons: !(settings?.platformBehaviourPreferences?.enableComparisons) })} disabled={saving} />
            <Toggle label="Guest Checkout" description="Allow users to purchase without creating an account" checked={settings?.platformBehaviourPreferences?.allowGuestCheckout ?? false} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), allowGuestCheckout: !(settings?.platformBehaviourPreferences?.allowGuestCheckout) })} disabled={saving} />
            <Toggle label="Digital Products" description="Allow selling digital products" checked={settings?.platformBehaviourPreferences?.enableDigitalProducts ?? true} onChange={() => updateSetting('platformBehaviourPreferences', { ...(settings?.platformBehaviourPreferences || {}), enableDigitalProducts: !(settings?.platformBehaviourPreferences?.enableDigitalProducts) })} disabled={saving} />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Branding Preferences" description="Customize platform branding">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Logo URL"
                value={settings?.brandingPreferences?.logoUrl || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), logoUrl: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Favicon URL"
                value={settings?.brandingPreferences?.favicon || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), favicon: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Company Address"
                value={settings?.brandingPreferences?.companyAddress || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), companyAddress: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Input
                label="Support Email"
                value={settings?.brandingPreferences?.supportEmail || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), supportEmail: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Input
                label="Support Phone"
                value={settings?.brandingPreferences?.supportPhone || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), supportPhone: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Input
                label="Primary Color"
                value={settings?.brandingPreferences?.primaryColor || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), primaryColor: e.target.value })}
                disabled={saving}
                placeholder="#1a1a2e"
              />
            </div>
            <div>
              <Input
                label="Secondary Color"
                value={settings?.brandingPreferences?.secondaryColor || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), secondaryColor: e.target.value })}
                disabled={saving}
                placeholder="#6b7280"
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Tagline"
                value={settings?.brandingPreferences?.tagline || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), tagline: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="OG Image URL"
                value={settings?.brandingPreferences?.ogImage || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), ogImage: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Header Color</label>
              <Input
                label=""
                value={settings?.brandingPreferences?.emailHeaderColor || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), emailHeaderColor: e.target.value })}
                disabled={saving}
                placeholder="#1a1a2e"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Background Color</label>
              <Input
                label=""
                value={settings?.brandingPreferences?.emailBackgroundColor || ''}
                onChange={(e) => updateSetting('brandingPreferences', { ...(settings?.brandingPreferences || {}), emailBackgroundColor: e.target.value })}
                disabled={saving}
                placeholder="#f8f9fa"
              />
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
