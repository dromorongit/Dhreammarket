'use client'

import { useEffect, useState } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import Toggle from '@/components/settings/Toggle'
import { useSettingsUser } from '@/components/settings/SettingsContext'
import { getDefaultCurrency, getCurrencySymbol } from '@/lib/platform-preferences'

interface PreferencesSectionProps {
  initialPreferences: {
    darkMode: boolean
    language: string
    currency: string
    timezone: string
  }
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'ha', label: 'Hausa' },
  { value: 'tw', label: 'Twi' },
]

const CURRENCIES = [
  { value: 'GHS', label: 'GHS - Ghanaian Cedi' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
]

const TIMEZONES = [
  { value: 'Africa/Accra', label: 'Accra (GMT)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
  { value: 'UTC', label: 'UTC' },
]

export default function PreferencesSection({ initialPreferences }: PreferencesSectionProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [platformCurrency, setPlatformCurrency] = useState<string>('')
  const [preferences, setPreferences] = useState(initialPreferences)
  const { refreshUser } = useSettingsUser()

  useEffect(() => {
    setPreferences(initialPreferences)
  }, [initialPreferences])

  useEffect(() => {
    getDefaultCurrency().then((curr) => {
      setPlatformCurrency(curr)
    }).catch(() => {
      setPlatformCurrency('GHS')
    })
  }, [])

  const savePreferences = async (next: typeof preferences) => {
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
        setMessage('Preferences saved')
        setPreferences(next)
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

  const handleToggle = () => {
    const next = { ...preferences, darkMode: !preferences.darkMode }
    savePreferences(next)
  }

  const handleSelect = (field: 'language' | 'currency' | 'timezone', value: string) => {
    const next = { ...preferences, [field]: value }
    savePreferences(next)
  }

  const effectiveCurrency = preferences.currency || platformCurrency

  return (
    <SettingsSection title="Preferences" description="Customize your experience">
      <div className="space-y-4">
        <Toggle label="Dark Mode" description="Use dark theme across the application" checked={preferences.darkMode} onChange={handleToggle} disabled={saving} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
            <select
              value={preferences.language}
              onChange={(e) => handleSelect('language', e.target.value)}
              disabled={saving}
              className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
            <select
              value={effectiveCurrency}
              onChange={(e) => handleSelect('currency', e.target.value)}
              disabled={saving}
              className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr.value} value={curr.value}>{curr.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
            <select
              value={preferences.timezone}
              onChange={(e) => handleSelect('timezone', e.target.value)}
              disabled={saving}
              className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
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
      </div>
    </SettingsSection>
  )
}
