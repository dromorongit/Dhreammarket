'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'
import Link from 'next/link'

interface VerificationSettings {
  verificationFee: number
  verificationEnabled: boolean
  allowResubmissionAfterRejection: boolean
  autoExpirePendingApplications: boolean
  expiryDays: number
}

export default function SuperAdminVerificationSettings() {
  const [settings, setSettings] = useState<VerificationSettings>({
    verificationFee: 250.00,
    verificationEnabled: true,
    allowResubmissionAfterRejection: true,
    autoExpirePendingApplications: false,
    expiryDays: 30,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/super-admin/verification-settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const response = await fetch('/api/super-admin/verification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field: keyof VerificationSettings) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/dashboard/super-admin" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Verification Settings</h1>
          <p className="text-gray-600 mt-2">Configure vendor verification fees and policies</p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Verification Configuration</h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Verification Fee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Fee (GH₵)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.verificationFee}
                  onChange={(e) => setSettings(prev => ({ ...prev, verificationFee: parseFloat(e.target.value) || 0 }))}
                  placeholder="250.00"
                />
                <p className="text-xs text-slate-500 mt-1">Fee charged to vendors when they apply for verification</p>
              </div>

              {/* Verification Enabled */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Verification Enabled</h3>
                  <p className="text-sm text-slate-500">Allow vendors to apply for verification</p>
                </div>
                <button
                  onClick={() => handleToggle('verificationEnabled')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.verificationEnabled ? 'bg-royal-blue' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    settings.verificationEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Allow Resubmission After Rejection */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Allow Resubmission After Rejection</h3>
                  <p className="text-sm text-slate-500">Vendors can resubmit after being rejected</p>
                </div>
                <button
                  onClick={() => handleToggle('allowResubmissionAfterRejection')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.allowResubmissionAfterRejection ? 'bg-royal-blue' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    settings.allowResubmissionAfterRejection ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Auto Expire Pending Applications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Auto Expire Pending Applications</h3>
                  <p className="text-sm text-slate-500">Automatically expire applications after set days</p>
                </div>
                <button
                  onClick={() => handleToggle('autoExpirePendingApplications')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoExpirePendingApplications ? 'bg-royal-blue' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    settings.autoExpirePendingApplications ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Expiry Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Days
                </label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.expiryDays}
                  onChange={(e) => setSettings(prev => ({ ...prev, expiryDays: parseInt(e.target.value) || 30 }))}
                  placeholder="30"
                  disabled={!settings.autoExpirePendingApplications}
                />
                <p className="text-xs text-slate-500 mt-1">Days before pending applications expire (1-365)</p>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving} variant={saved ? 'success' : 'primary'}>
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <div className="mt-8">
          <Card variant="elevated">
            <CardContent className="p-6">
              <h3 className="font-medium text-gray-900 mb-4">Verification Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/dashboard/admin/verification-applications">
                  <Button variant="outline" className="w-full">
                    View Verification Applications
                  </Button>
                </Link>
                <Link href="/dashboard/admin/vendors">
                  <Button variant="outline" className="w-full">
                    Manage Vendors
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}