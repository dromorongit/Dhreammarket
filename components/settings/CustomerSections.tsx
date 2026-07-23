'use client'

import { useEffect, useState } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'
import Toggle from '@/components/settings/Toggle'

interface Address {
  id: string
  label?: string | null
  street: string
  region: string
  city: string
  isDefault: boolean
}

interface PaymentMethod {
  id: string
  type: string
  details: Record<string, any>
  isDefault: boolean
  isActive: boolean
}

export default function CustomerSections() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [addressLoading, setAddressLoading] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [addressForm, setAddressForm] = useState({ label: '', street: '', region: '', city: '', isDefault: false })
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)

  const [paymentForm, setPaymentForm] = useState<{ type: string; details: Record<string, any>; isDefault: boolean }>({ type: 'MOBILE_MONEY', details: { label: '', phoneNumber: '', last4: '', nameOnCard: '' }, isDefault: false })
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)

  const [wishlistPrefs, setWishlistPrefs] = useState({
    notifyOnSale: false,
    notifyOnPriceDrop: false,
    notifyOnStock: false,
    publicWishlist: false,
    showOnProfile: false,
    allowRecommendations: false,
  })

  const fetchAddresses = async () => {
    setAddressLoading(true)
    try {
      const res = await fetch('/api/settings/addresses')
      if (res.ok) {
        const data = await res.json()
        setAddresses(data.addresses || [])
      }
    } catch {
      // silent
    } finally {
      setAddressLoading(false)
    }
  }

  const fetchPaymentMethods = async () => {
    setPaymentLoading(true)
    try {
      const res = await fetch('/api/settings/payment-methods')
      if (res.ok) {
        const data = await res.json()
        setPaymentMethods(data.paymentMethods || [])
      }
    } catch {
      // silent
    } finally {
      setPaymentLoading(false)
    }
  }

  const fetchWishlistPrefs = async () => {
    try {
      const res = await fetch('/api/settings/wishlist-preferences')
      if (res.ok) {
        const data = await res.json()
        setWishlistPrefs({
          notifyOnSale: data.notificationPreferences?.notifyOnSale ?? false,
          notifyOnPriceDrop: data.notificationPreferences?.notifyOnPriceDrop ?? false,
          notifyOnStock: data.notificationPreferences?.notifyOnStock ?? false,
          publicWishlist: data.privacyPreferences?.publicWishlist ?? false,
          showOnProfile: data.privacyPreferences?.showOnProfile ?? false,
          allowRecommendations: data.recommendationPreferences?.allowRecommendations ?? false,
        })
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchAddresses()
    fetchPaymentMethods()
    fetchWishlistPrefs()
  }, [])

  const handleSaveWishlist = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/settings/wishlist-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPreferences: {
            notifyOnSale: wishlistPrefs.notifyOnSale,
            notifyOnPriceDrop: wishlistPrefs.notifyOnPriceDrop,
            notifyOnStock: wishlistPrefs.notifyOnStock,
          },
          privacyPreferences: {
            publicWishlist: wishlistPrefs.publicWishlist,
            showOnProfile: wishlistPrefs.showOnProfile,
          },
          recommendationPreferences: {
            allowRecommendations: wishlistPrefs.allowRecommendations,
          },
        }),
      })
      if (res.ok) {
        setMessage('Wishlist preferences saved')
        setTimeout(() => setMessage(null), 3000)
      } else {
        setError('Failed to save wishlist preferences')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAddress = async () => {
    if (!addressForm.street.trim() || !addressForm.region.trim() || !addressForm.city.trim()) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      let res
      if (editingAddressId) {
        res = await fetch(`/api/settings/addresses/${editingAddressId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addressForm),
        })
      } else {
        res = await fetch('/api/settings/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addressForm),
        })
      }

      if (res.ok) {
        setAddressForm({ label: '', street: '', region: '', city: '', isDefault: false })
        setEditingAddressId(null)
        fetchAddresses()
        setMessage('Address saved')
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save address')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAddress = async (id: string) => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/settings/addresses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchAddresses()
        setMessage('Address deleted')
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete address')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefaultAddress = async (id: string) => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/settings/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        fetchAddresses()
        setMessage('Default address updated')
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update default address')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePayment = async () => {
    if (!paymentForm.type) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      let res
      if (editingPaymentId) {
        res = await fetch(`/api/settings/payment-methods/${editingPaymentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentForm),
        })
      } else {
        res = await fetch('/api/settings/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentForm),
        })
      }

      if (res.ok) {
        setPaymentForm({ type: 'MOBILE_MONEY', details: { label: '', phoneNumber: '', last4: '', nameOnCard: '' }, isDefault: false })
        setEditingPaymentId(null)
        fetchPaymentMethods()
        setMessage('Payment method saved')
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save payment method')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async (id: string) => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/settings/payment-methods/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchPaymentMethods()
        setMessage('Payment method removed')
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to remove payment method')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Shipping Addresses" description="Manage your delivery addresses">
        <div className="space-y-4">
          {addresses.length === 0 && !addressLoading ? (
            <p className="text-sm text-slate-500">No saved addresses yet.</p>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{addr.street}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{addr.city}, {addr.region} {addr.label ? `• ${addr.label}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {addr.isDefault && <Badge variant="success" size="sm">Default</Badge>}
                    {!addr.isDefault && (
                      <Button variant="ghost" size="sm" onClick={() => handleSetDefaultAddress(addr.id)} disabled={saving}>Set Default</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setEditingAddressId(addr.id); setAddressForm({ label: addr.label || '', street: addr.street, region: addr.region, city: addr.city, isDefault: addr.isDefault }) }} disabled={saving}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteAddress(addr.id)} disabled={saving}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 rounded-2xl border border-slate-200 bg-white">
            <p className="text-sm font-medium text-slate-900 mb-3">{editingAddressId ? 'Edit Address' : 'Add New Address'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Label (e.g. Home, Work)" value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} placeholder="Optional" />
              <Input label="Street Address" value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} placeholder="123 Main St" />
              <Input label="City" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} placeholder="Accra" />
              <Input label="Region" value={addressForm.region} onChange={(e) => setAddressForm({ ...addressForm, region: e.target.value })} placeholder="Greater Accra" />
            </div>
            <div className="flex items-center justify-between mt-4">
              <Toggle label="Set as default" checked={addressForm.isDefault} onChange={() => setAddressForm({ ...addressForm, isDefault: !addressForm.isDefault })} disabled={saving} />
              <div className="flex gap-2">
                {editingAddressId && <Button variant="outline" size="sm" onClick={() => { setEditingAddressId(null); setAddressForm({ label: '', street: '', region: '', city: '', isDefault: false }) }} disabled={saving}>Cancel</Button>}
                <Button size="sm" onClick={handleSaveAddress} disabled={saving}>{saving ? 'Saving...' : editingAddressId ? 'Update' : 'Add Address'}</Button>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Saved Payment Methods" description="Your saved payment options">
        <div className="space-y-4">
          {paymentMethods.length === 0 && !paymentLoading ? (
            <p className="text-sm text-slate-500">No saved payment methods yet.</p>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{pm.type === 'MOBILE_MONEY' ? 'Mobile Money' : 'Visa/Mastercard'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{pm.isActive ? 'Active' : 'Inactive'} {pm.isDefault ? '• Default' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!pm.isDefault && (
                      <Button variant="ghost" size="sm" onClick={async () => { await handleSavePayment(); }} disabled={saving}>Set Default</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setEditingPaymentId(pm.id); setPaymentForm({ type: pm.type, details: pm.details || {}, isDefault: pm.isDefault }) }} disabled={saving}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(pm.id)} disabled={saving}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 rounded-2xl border border-slate-200 bg-white">
            <p className="text-sm font-medium text-slate-900 mb-3">{editingPaymentId ? 'Edit Payment Method' : 'Add New Payment Method'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <select value={paymentForm.type} onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value })} className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow">
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="VISA_MASTERCARD">Visa / Mastercard</option>
                </select>
              </div>
              {paymentForm.type === 'MOBILE_MONEY' ? (
                <Input label="Phone Number" value={paymentForm.details.phoneNumber || ''} onChange={(e) => setPaymentForm({ ...paymentForm, details: { ...paymentForm.details, phoneNumber: e.target.value } })} placeholder="+233 24 000 0000" />
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  <Input label="Name on Card" value={paymentForm.details.nameOnCard || ''} onChange={(e) => setPaymentForm({ ...paymentForm, details: { ...paymentForm.details, nameOnCard: e.target.value } })} placeholder="John Doe" />
                  <Input label="Last 4 Digits" value={paymentForm.details.last4 || ''} onChange={(e) => setPaymentForm({ ...paymentForm, details: { ...paymentForm.details, last4: e.target.value.slice(-4) } })} placeholder="1234" maxLength={4} />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-4">
              <Toggle label="Set as default" checked={paymentForm.isDefault} onChange={() => setPaymentForm({ ...paymentForm, isDefault: !paymentForm.isDefault })} disabled={saving} />
              <div className="flex gap-2">
                {editingPaymentId && <Button variant="outline" size="sm" onClick={() => { setEditingPaymentId(null); setPaymentForm({ type: 'MOBILE_MONEY', details: { label: '', phoneNumber: '', last4: '', nameOnCard: '' }, isDefault: false }) }} disabled={saving}>Cancel</Button>}
                <Button size="sm" onClick={handleSavePayment} disabled={saving}>{saving ? 'Saving...' : editingPaymentId ? 'Update' : 'Add Payment Method'}</Button>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Wishlist Preferences" description="Customize your wishlist experience">
        <div className="space-y-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notifications</p>
          <Toggle label="Price drop alerts" description="Get notified when an item goes on sale" checked={wishlistPrefs.notifyOnSale} onChange={() => setWishlistPrefs({ ...wishlistPrefs, notifyOnSale: !wishlistPrefs.notifyOnSale })} disabled={saving} />
          <Toggle label="Stock alerts" description="Notify me when wishlist items are back in stock" checked={wishlistPrefs.notifyOnStock} onChange={() => setWishlistPrefs({ ...wishlistPrefs, notifyOnStock: !wishlistPrefs.notifyOnStock })} disabled={saving} />
          <Toggle label="Price drop notifications" description="Get notified of price decreases" checked={wishlistPrefs.notifyOnPriceDrop} onChange={() => setWishlistPrefs({ ...wishlistPrefs, notifyOnPriceDrop: !wishlistPrefs.notifyOnPriceDrop })} disabled={saving} />

          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-4">Privacy</p>
          <Toggle label="Public wishlist" description="Allow others to view your wishlist" checked={wishlistPrefs.publicWishlist} onChange={() => setWishlistPrefs({ ...wishlistPrefs, publicWishlist: !wishlistPrefs.publicWishlist })} disabled={saving} />
          <Toggle label="Show on profile" description="Display your wishlist on your public profile" checked={wishlistPrefs.showOnProfile} onChange={() => setWishlistPrefs({ ...wishlistPrefs, showOnProfile: !wishlistPrefs.showOnProfile })} disabled={saving} />

          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-4">Recommendations</p>
          <Toggle label="Recommendations" description="Use wishlist data to suggest products" checked={wishlistPrefs.allowRecommendations} onChange={() => setWishlistPrefs({ ...wishlistPrefs, allowRecommendations: !wishlistPrefs.allowRecommendations })} disabled={saving} />

          <div className="mt-4">
            <Button onClick={handleSaveWishlist} disabled={saving} size="md">{saving ? 'Saving...' : 'Save Preferences'}</Button>
          </div>
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
    </div>
  )
}
