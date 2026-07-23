'use client'

import { useState, useEffect } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { Textarea } from '@/components/Textarea'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface StoreInfo {
  id: string
  name: string
  description?: string
  logo?: string
  banner?: string
  categoryId?: string
  location?: string
  mainPhoneNumber?: string
  alternativePhoneNumber?: string
  whatsappNumber?: string
  email?: string
  address?: string
  acceptsPreOrders?: boolean
  acceptsBackOrders?: boolean
}

interface VendorSectionsProps {
  initialStore?: StoreInfo | null
}

export default function VendorSections({ initialStore }: VendorSectionsProps) {
  const router = useRouter()
  const [store, setStore] = useState<StoreInfo | null>(initialStore || null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!initialStore)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    if (!initialStore) {
      fetchStore()
    }
  }, [initialStore])

  const fetchStore = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/store')
      if (response.ok) {
        const data = await response.json()
        if (data.store) {
          setStore(data.store)
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!store?.name?.trim()) {
      errors.name = 'Store name is required'
    }
    if (store?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email)) {
      errors.email = 'Please enter a valid business email'
    }
    if (store?.mainPhoneNumber && store.mainPhoneNumber.length < 7) {
      errors.mainPhoneNumber = 'Please enter a valid phone number'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!store) return
    if (!validate()) return

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
        setStore(data.store)
        setMessage('Store information updated successfully')
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setUploadingLogo(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('folder', 'logos')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (response.ok && data.urls && data.urls.length > 0) {
        setStore((prev) => (prev ? { ...prev, logo: data.urls[0].url } : prev))
      } else {
        setError(data.error || 'Failed to upload logo')
      }
    } catch {
      setError('An error occurred while uploading logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsSection title="Store Information" description="Update your store details">
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </SettingsSection>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="space-y-6">
        <SettingsSection title="Store Information" description="Your store details">
          <div className="text-center py-8">
            <p className="text-slate-600 text-sm mb-3">You have not set up your store yet.</p>
            <Button size="sm" onClick={() => router.push('/dashboard/vendor/store')}>
              Set Up Store
            </Button>
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
              error={formErrors.name}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Business Description"
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
      </SettingsSection>

      <SettingsSection title="Store Logo" description="Manage your store logo and branding">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative h-32 w-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
            {store.logo ? (
              <Image src={store.logo} alt="Store logo" fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs text-center p-2">
                No logo uploaded
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              id="logo-upload"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('logo-upload')?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? 'Uploading...' : store.logo ? 'Change Logo' : 'Upload Logo'}
            </Button>
            <p className="text-xs text-slate-500 mt-2">JPG, PNG, or WebP. Max 10MB.</p>
            {error && error.includes('upload') && (
              <p className="text-xs text-rose-600 mt-1">{error}</p>
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Business Address" description="Your store&apos;s physical address">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Textarea
              label="Full Address"
              placeholder="Enter your business address"
              value={store.address || ''}
              onChange={(e) => setStore({ ...store, address: e.target.value })}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Business Contact Information" description="Update contact details for your store">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Business Email"
            type="email"
            value={store.email || ''}
            onChange={(e) => setStore({ ...store, email: e.target.value })}
            error={formErrors.email}
          />
          <Input
            label="Main Phone"
            type="tel"
            value={store.mainPhoneNumber || ''}
            onChange={(e) => setStore({ ...store, mainPhoneNumber: e.target.value })}
            error={formErrors.mainPhoneNumber}
          />
          <Input
            label="Alternative Phone"
            type="tel"
            value={store.alternativePhoneNumber || ''}
            onChange={(e) => setStore({ ...store, alternativePhoneNumber: e.target.value })}
          />
          <Input
            label="WhatsApp Number"
            type="tel"
            value={store.whatsappNumber || ''}
            onChange={(e) => setStore({ ...store, whatsappNumber: e.target.value })}
          />
        </div>
      </SettingsSection>

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
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg shadow-royal-blue/20">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
