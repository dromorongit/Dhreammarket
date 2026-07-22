'use client'

import { useState } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { Textarea } from '@/components/Textarea'
import Toggle from '@/components/settings/Toggle'
import Image from 'next/image'

interface StoreInfo {
  id: string
  name: string
  description?: string
  logo?: string
  categoryId?: string
  location?: string
  mainPhoneNumber?: string
  alternativePhoneNumber?: string
  whatsappNumber?: string
  email?: string
}

interface VendorSectionsProps {
  initialStore?: StoreInfo | null
}

export default function VendorSections({ initialStore }: VendorSectionsProps) {
  const [store, setStore] = useState<StoreInfo | null>(initialStore || null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState({
    lowStockAlerts: true,
    orderNotifications: true,
    reviewNotifications: true,
    payoutNotifications: true,
  })

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      })

      const data = await response.json()
      if (response.ok) {
        setMessage('Store information updated')
        setTimeout(() => setMessage(null), 3000)
      } else {
        setError(data.error || 'Failed to update store')
      }
    } catch {
      setError('An error occurred while updating store')
    } finally {
      setSaving(false)
    }
  }

  if (!store) {
    return (
      <div className="space-y-6">
        <SettingsSection title="Store Information" description="Your store details">
          <div className="text-center py-8">
            <p className="text-slate-600 text-sm mb-3">You have not set up your store yet.</p>
            <Button size="sm">Set Up Store</Button>
          </div>
        </SettingsSection>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Store Information" description="Update your store details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Store Name"
              value={store.name}
              onChange={(e) => setStore({ ...store, name: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Description"
              placeholder="Describe your store"
              value={store.description || ''}
              onChange={(e) => setStore({ ...store, description: e.target.value })}
            />
          </div>
          <div>
            <Input
              label="Location"
              placeholder="City, Region"
              value={store.location || ''}
              onChange={(e) => setStore({ ...store, location: e.target.value })}
            />
          </div>
          <div>
            <Input
              label="Store Category"
              value={store.categoryId || ''}
              onChange={(e) => setStore({ ...store, categoryId: e.target.value })}
            />
          </div>
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
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Store Logo" description="Manage your store logo and branding">
        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center">
          <p className="text-sm text-slate-500">Store logo upload coming soon</p>
          {store.logo && (
            <div className="relative mx-auto mt-4 h-32 w-32 rounded-xl overflow-hidden">
              <Image src={store.logo} alt="Store logo" fill className="object-cover" />
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Business Contact Information" description="Update contact details for your store">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Business Email" type="email" value={store.email || ''} onChange={(e) => setStore({ ...store, email: e.target.value })} />
          <Input label="Main Phone" type="tel" value={store.mainPhoneNumber || ''} onChange={(e) => setStore({ ...store, mainPhoneNumber: e.target.value })} />
          <Input label="Alternative Phone" type="tel" value={store.alternativePhoneNumber || ''} onChange={(e) => setStore({ ...store, alternativePhoneNumber: e.target.value })} />
          <Input label="WhatsApp Number" type="tel" value={store.whatsappNumber || ''} onChange={(e) => setStore({ ...store, whatsappNumber: e.target.value })} />
        </div>
      </SettingsSection>

      <SettingsSection title="Store Notifications" description="Manage notifications for your store">
        <div className="space-y-2">
          <Toggle label="Order Notifications" description="New orders and updates" checked={preferences.orderNotifications} onChange={() => setPreferences({ ...preferences, orderNotifications: !preferences.orderNotifications })} />
          <Toggle label="Review Notifications" description="New customer reviews" checked={preferences.reviewNotifications} onChange={() => setPreferences({ ...preferences, reviewNotifications: !preferences.reviewNotifications })} />
          <Toggle label="Payout Notifications" description="When payouts are processed" checked={preferences.payoutNotifications} onChange={() => setPreferences({ ...preferences, payoutNotifications: !preferences.payoutNotifications })} />
          <Toggle label="Low Stock Alerts" description="When products are running low" checked={preferences.lowStockAlerts} onChange={() => setPreferences({ ...preferences, lowStockAlerts: !preferences.lowStockAlerts })} />
        </div>
      </SettingsSection>

      <SettingsSection title="Vendor Preferences" description="General vendor settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Order Fulfillment Time</label>
            <select className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow">
              <option value="same-day">Same Day</option>
              <option value="next-day">Next Day</option>
              <option value="2-3-days">2-3 Days</option>
              <option value="week">1 Week</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Auto-accept orders</label>
            <select className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow">
              <option value="manual">Manual</option>
              <option value="auto">Auto-accept</option>
            </select>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
