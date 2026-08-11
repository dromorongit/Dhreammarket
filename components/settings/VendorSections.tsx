'use client'

import { useState, useEffect } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { Textarea } from '@/components/Textarea'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Toggle from '@/components/settings/Toggle'

interface StoreInfo {
  id: string
  name: string
  slug: string
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

interface VendorSettings {
  id: string
  defaultDashboardTab?: string
  compactView?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  dateFormat?: string
  itemsPerPage?: number
  widgetVisibility?: Record<string, any>
  productDisplayPreferences?: Record<string, any>
  orderManagementPreferences?: Record<string, any>
  inventoryPreferences?: Record<string, any>
  notifyNewOrders?: boolean
  notifyLowStock?: boolean
  notifyCustomerMessages?: boolean
  notifySettlements?: boolean
  notificationChannels?: Record<string, any>
}

interface VendorSectionsProps {
  initialStore?: StoreInfo | null
}

export default function VendorSections({ initialStore }: VendorSectionsProps) {
  const router = useRouter()
  const [store, setStore] = useState<StoreInfo | null>(initialStore || null)
  const [storeLoading, setStoreLoading] = useState(!initialStore)
  const [storeSaving, setStoreSaving] = useState(false)
  const [storeMessage, setStoreMessage] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [newStoreSlug, setNewStoreSlug] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [vendorSettings, setVendorSettings] = useState<VendorSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    if (!initialStore) {
      fetchStore()
    }
  }, [initialStore])

  useEffect(() => {
    fetchVendorSettings()
  }, [])

  const fetchStore = async () => {
    setStoreLoading(true)
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
      setStoreLoading(false)
    }
  }

  const fetchVendorSettings = async () => {
    setSettingsLoading(true)
    try {
      const response = await fetch('/api/settings/vendor')
      if (response.ok) {
        const data = await response.json()
        setVendorSettings(data.settings)
      }
    } catch {
      // silent
    } finally {
      setSettingsLoading(false)
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

  const handleStoreSave = async () => {
    if (!store) return
    if (!validate()) return

    setStoreSaving(true)
    setStoreMessage(null)
    setStoreError(null)

    try {
      const response = await fetch('/api/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      })

      const data = await response.json()
      if (response.ok) {
        setStore(data.store)
        setStoreMessage('Store information updated successfully')
        setTimeout(() => {
          setStoreMessage(null)
          setNewStoreSlug(null)
        }, 5000)
        if (data.store.slug && data.store.slug !== store?.slug) {
          setNewStoreSlug(data.store.slug)
        }
      } else {
        setStoreError(data.error || 'Failed to update store')
      }
    } catch {
      setStoreError('An error occurred while updating store')
    } finally {
      setStoreSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      setStoreError('Please select an image file')
      return
    }

    setUploadingLogo(true)
    setStoreError(null)

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
        setStoreError(data.error || 'Failed to upload logo')
      }
    } catch {
      setStoreError('An error occurred while uploading logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleVendorSettingSave = async () => {
    if (!vendorSettings) return
    setSettingsSaving(true)
    setSettingsMessage(null)
    setSettingsError(null)

    try {
      const response = await fetch('/api/settings/vendor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorSettings),
      })

      const data = await response.json()
      if (response.ok) {
        setVendorSettings(data.settings)
        setSettingsMessage('Settings saved successfully')
        setTimeout(() => setSettingsMessage(null), 3000)
      } else {
        setSettingsError(data.error || 'Failed to save settings')
      }
    } catch {
      setSettingsError('An error occurred while saving settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  const updateVendorSetting = <K extends keyof VendorSettings>(field: K, value: VendorSettings[K]) => {
    setVendorSettings((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  if (storeLoading) {
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
            {storeError && storeError.includes('upload') && (
              <p className="text-xs text-rose-600 mt-1">{storeError}</p>
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

      <SettingsSection title="Vendor Dashboard Preferences" description="Configure your dashboard experience">
        {settingsLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Default Dashboard Tab</label>
                <select
                  value={vendorSettings?.defaultDashboardTab || 'overview'}
                  onChange={(e) => updateVendorSetting('defaultDashboardTab', e.target.value)}
                  disabled={settingsSaving}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
                >
                  <option value="overview">Overview</option>
                  <option value="products">Products</option>
                  <option value="orders">Orders</option>
                  <option value="inventory">Inventory</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Auto-refresh Interval (seconds)</label>
                <select
                  value={String(vendorSettings?.refreshInterval ?? 30)}
                  onChange={(e) => updateVendorSetting('refreshInterval', parseInt(e.target.value))}
                  disabled={settingsSaving}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
                >
                  <option value="0">Off</option>
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date Format</label>
                <select
                  value={vendorSettings?.dateFormat || 'MM/DD/YYYY'}
                  onChange={(e) => updateVendorSetting('dateFormat', e.target.value)}
                  disabled={settingsSaving}
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
                  value={String(vendorSettings?.itemsPerPage ?? 25)}
                  onChange={(e) => updateVendorSetting('itemsPerPage', parseInt(e.target.value))}
                  disabled={settingsSaving}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 mt-2">
              <Toggle label="Compact View" description="Use compact tables and lists" checked={vendorSettings?.compactView ?? false} onChange={() => updateVendorSetting('compactView', !(vendorSettings?.compactView))} disabled={settingsSaving} />
              <Toggle label="Auto-refresh" description="Automatically refresh dashboard data" checked={vendorSettings?.autoRefresh ?? true} onChange={() => updateVendorSetting('autoRefresh', !(vendorSettings?.autoRefresh))} disabled={settingsSaving} />
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Product Display Preferences" description="Customize how products are displayed">
        {settingsLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            <Toggle label="Show low stock badges" description="Highlight products running low on stock" checked={vendorSettings?.inventoryPreferences?.showLowStockBadge ?? true} onChange={() => updateVendorSetting('inventoryPreferences', { ...vendorSettings?.inventoryPreferences, showLowStockBadge: !(vendorSettings?.inventoryPreferences?.showLowStockBadge) })} disabled={settingsSaving} />
            <Toggle label="Group by category" description="Organize products into category folders" checked={vendorSettings?.productDisplayPreferences?.groupByCategory ?? false} onChange={() => updateVendorSetting('productDisplayPreferences', { ...vendorSettings?.productDisplayPreferences, groupByCategory: !(vendorSettings?.productDisplayPreferences?.groupByCategory) })} disabled={settingsSaving} />
            <Toggle label="Show out-of-stock items" description="Keep out-of-stock products visible on listings" checked={vendorSettings?.productDisplayPreferences?.showOutOfStock ?? false} onChange={() => updateVendorSetting('productDisplayPreferences', { ...vendorSettings?.productDisplayPreferences, showOutOfStock: !(vendorSettings?.productDisplayPreferences?.showOutOfStock) })} disabled={settingsSaving} />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Order Management Preferences" description="Configure how orders are handled">
        {settingsLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            <Toggle label="Auto-accept orders" description="Automatically accept incoming orders" checked={vendorSettings?.orderManagementPreferences?.autoAcceptOrders ?? false} onChange={() => updateVendorSetting('orderManagementPreferences', { ...vendorSettings?.orderManagementPreferences, autoAcceptOrders: !(vendorSettings?.orderManagementPreferences?.autoAcceptOrders) })} disabled={settingsSaving} />
            <Toggle label="Order status filters" description="Remember selected status filters in order list" checked={vendorSettings?.orderManagementPreferences?.rememberStatusFilters ?? false} onChange={() => updateVendorSetting('orderManagementPreferences', { ...vendorSettings?.orderManagementPreferences, rememberStatusFilters: !(vendorSettings?.orderManagementPreferences?.rememberStatusFilters) })} disabled={settingsSaving} />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Notification Preferences" description="Manage vendor notification channels">
        {settingsLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            <Toggle label="New Orders" description="Get notified when a new order is placed" checked={vendorSettings?.notifyNewOrders ?? true} onChange={() => updateVendorSetting('notifyNewOrders', !(vendorSettings?.notifyNewOrders))} disabled={settingsSaving} />
            <Toggle label="Low Stock Alerts" description="Get notified when inventory is low" checked={vendorSettings?.notifyLowStock ?? true} onChange={() => updateVendorSetting('notifyLowStock', !(vendorSettings?.notifyLowStock))} disabled={settingsSaving} />
            <Toggle label="Customer Messages" description="Get notified when a customer sends a message" checked={vendorSettings?.notifyCustomerMessages ?? true} onChange={() => updateVendorSetting('notifyCustomerMessages', !(vendorSettings?.notifyCustomerMessages))} disabled={settingsSaving} />
            <Toggle label="Settlements" description="Get notified about payout and settlement updates" checked={vendorSettings?.notifySettlements ?? true} onChange={() => updateVendorSetting('notifySettlements', !(vendorSettings?.notifySettlements))} disabled={settingsSaving} />
          </div>
        )}
      </SettingsSection>

      {storeMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-sm text-emerald-700">{storeMessage}</p>
        </div>
      )}
      {storeError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
          <p className="text-sm text-rose-700">{storeError}</p>
        </div>
      )}

      {newStoreSlug && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-700 font-medium mb-1">Your store link has been updated:</p>
          <p className="text-sm text-blue-600 break-all">https://www.dhreamarket.com/vendor/{newStoreSlug}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleStoreSave} disabled={storeSaving} size="lg" className="shadow-lg shadow-royal-blue/20">
          {storeSaving ? 'Saving...' : 'Save Store Changes'}
        </Button>
      </div>

      {settingsMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-sm text-emerald-700">{settingsMessage}</p>
        </div>
      )}
      {settingsError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
          <p className="text-sm text-rose-700">{settingsError}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleVendorSettingSave} disabled={settingsSaving} size="lg" className="shadow-lg shadow-royal-blue/20">
          {settingsSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
