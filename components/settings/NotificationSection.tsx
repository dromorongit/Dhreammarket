'use client'

import { useEffect, useState } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import Toggle from '@/components/settings/Toggle'
import { useSettingsUser } from '@/components/settings/SettingsContext'

interface NotificationSectionProps {
  initialNotifications: {
    emailNotifications: boolean
    orderNotifications: boolean
    promotionalNotifications: boolean
    systemNotifications: boolean
  }
}

export default function NotificationSection({ initialNotifications }: NotificationSectionProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState(initialNotifications)
  const { refreshUser } = useSettingsUser()

  useEffect(() => {
    setNotifications(initialNotifications)
  }, [initialNotifications])

  const saveNotifications = async (next: typeof notifications) => {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })

      const data = await response.json()
      if (response.ok) {
        setMessage('Notification preferences saved')
        setNotifications(next)
        refreshUser()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setError(data.error || 'Failed to save preferences')
      }
    } catch {
      setError('An error occurred while saving preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field: keyof typeof notifications) => {
    const next = { ...notifications, [field]: !notifications[field] }
    saveNotifications(next)
  }

  return (
    <SettingsSection title="Notification Preferences" description="Manage how you receive notifications">
      <div className="space-y-2">
        <Toggle label="Email Notifications" description="Receive notifications via email" checked={notifications.emailNotifications} onChange={() => handleToggle('emailNotifications')} disabled={saving} />
        <Toggle label="Order Notifications" description="Get updates about your orders" checked={notifications.orderNotifications} onChange={() => handleToggle('orderNotifications')} disabled={saving} />
        <Toggle label="Promotional Notifications" description="Receive offers and promotions" checked={notifications.promotionalNotifications} onChange={() => handleToggle('promotionalNotifications')} disabled={saving} />
        <Toggle label="System Notifications" description="Important updates about the platform" checked={notifications.systemNotifications} onChange={() => handleToggle('systemNotifications')} disabled={saving} />
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
    </SettingsSection>
  )
}
