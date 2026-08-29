'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'

const ALLOWED_SLOTS = [
  { value: 'after-quick-links', label: 'After Quick Links' },
  { value: 'after-official-stores', label: 'After Official Stores' },
  { value: 'after-sponsored', label: 'After Sponsored' },
  { value: 'before-service-showcase', label: 'Before Service Showcase' },
  { value: 'homepage-bottom', label: 'Homepage Bottom' },
] as const

interface VendorOption {
  id: string
  name: string
  userId: string
}

interface ProductOption {
  id: string
  name: string
  price: number
}

interface Advertisement {
  id: string
  slot: string
  slotLabel: string
  title: string
  imageUrl: string
  linkUrl: string
  vendorId: string | null
  productId: string | null
  startDate: string | null
  endDate: string | null
  isActive: boolean
  createdAt: string
  vendor?: { id: string; email: string } | null
  product?: { id: string; name: string } | null
}

export default function AdminAdvertisementsPage() {
  const [ads, setAds] = useState<Advertisement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loadingLookups, setLoadingLookups] = useState(false)

  const [formData, setFormData] = useState({
    slot: 'after-quick-links',
    title: '',
    imageUrl: '',
    linkUrl: '',
    vendorId: '',
    productId: '',
    startDate: '',
    endDate: '',
    isActive: true,
  })

  const fetchAds = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/advertisements')
      if (response.ok) {
        const data = await response.json()
        setAds(data.advertisements || [])
      } else {
        setError('Failed to load advertisements')
      }
    } catch (err) {
      setError('Failed to fetch advertisements')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true)
    try {
      const [vendorsRes, productsRes] = await Promise.all([
        fetch('/api/admin/vendors?limit=100'),
        fetch('/api/admin/products?limit=100'),
      ])
      if (vendorsRes.ok) {
        const data = await vendorsRes.json()
        const vendorList = (data.vendors || []) as Array<{ id: string; user?: { id: string }; name: string }>
        setVendors(
          vendorList.map((v) => ({
            id: v.id,
            name: v.name,
            userId: v.user?.id || v.id,
          }))
        )
      }
      if (productsRes.ok) {
        const data = await productsRes.json()
        const productList = (data.products || []) as Array<{ id: string; name: string; price: number }>
        setProducts(productList)
      }
    } catch (err) {
      console.error('Error loading lookups:', err)
    } finally {
      setLoadingLookups(false)
    }
  }, [])

  useEffect(() => {
    fetchAds()
  }, [fetchAds])

  const handleOpenCreate = () => {
    setEditingAd(null)
    setFormData({
      slot: 'after-quick-links',
      title: '',
      imageUrl: '',
      linkUrl: '',
      vendorId: '',
      productId: '',
      startDate: '',
      endDate: '',
      isActive: true,
    })
    setShowModal(true)
    loadLookups()
  }

  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad)
    setFormData({
      slot: ad.slot,
      title: ad.title,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl,
      vendorId: ad.vendorId ?? '',
      productId: ad.productId ?? '',
      startDate: ad.startDate ? ad.startDate.slice(0, 16) : '',
      endDate: ad.endDate ? ad.endDate.slice(0, 16) : '',
      isActive: ad.isActive,
    })
    setShowModal(true)
    loadLookups()
  }

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('folder', 'advertisements')
      const response = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Upload failed')
        return null
      }
      const data = await response.json()
      return data.urls?.[0]?.secureUrl || data.urls?.[0]?.url || null
    } catch (err) {
      console.error('Upload error:', err)
      alert('Failed to upload image')
      return null
    } finally {
      setUploading(false)
    }
  }

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Title is required'
    if (!formData.imageUrl.trim()) return 'Image URL is required'
    if (!formData.linkUrl.trim()) return 'Link URL is required'
    if (!formData.startDate || !formData.endDate) return 'Start and end dates are required'
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid date format'
    if (start >= end) return 'Start date must be before end date'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      alert(validationError)
      return
    }

    setSaving(true)
    try {
      const payload = {
        slot: formData.slot,
        title: formData.title.trim(),
        imageUrl: formData.imageUrl.trim(),
        linkUrl: formData.linkUrl.trim(),
        vendorId: formData.vendorId || null,
        productId: formData.productId || null,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        isActive: formData.isActive,
      }

      const url = editingAd ? `/api/admin/advertisements/${editingAd.id}` : '/api/admin/advertisements'
      const response = await fetch(url, {
        method: editingAd ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Failed to save advertisement')
        return
      }

      setShowModal(false)
      setEditingAd(null)
      fetchAds()
    } catch (err) {
      alert('Failed to save advertisement')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return
    try {
      const response = await fetch(`/api/admin/advertisements/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Failed to delete advertisement')
        return
      }
      fetchAds()
    } catch (err) {
      alert('Failed to delete advertisement')
      console.error(err)
    }
  }

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return 'No schedule'
    const s = start ? new Date(start).toLocaleDateString() : '...'
    const e = end ? new Date(end).toLocaleDateString() : '...'
    return `${s} — ${e}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Ad Banners</h1>
            <p className="text-slate-600 mt-1">Manage banner ads across homepage slots</p>
          </div>
          <Button onClick={handleOpenCreate}>+ Add Banner</Button>
        </div>

        {error && ads.length === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={fetchAds} className="mt-2 text-sm text-red-600 hover:underline">
              Try again
            </button>
          </div>
        )}

        {ads.length === 0 ? (
          <EmptyState
            title="No banners yet"
            description="Create your first banner ad to display on the homepage."
            actionLabel="Add Banner"
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="space-y-3">
            {ads.map((ad) => (
              <Card key={ad.id} variant="elevated" className={!ad.isActive ? 'opacity-60' : ''}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-20 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    {ad.imageUrl ? (
                      <Image
                        src={getOptimizedCloudinaryUrl(ad.imageUrl, 160)}
                        alt={ad.title}
                        width={160}
                        height={112}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-deep-navy truncate">{ad.title}</h3>
                      {!ad.isActive && <Badge variant="default" size="sm">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ad.slotLabel} · {formatDateRange(ad.startDate, ad.endDate)}
                    </p>
                    {ad.vendor && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Vendor: {ad.vendor.email}
                      </p>
                    )}
                    {ad.product && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Product: {ad.product.name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(ad)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(ad.id, ad.title)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card variant="elevated" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-6">
                  {editingAd ? 'Edit Banner' : 'Create Banner'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Slot Position</label>
                    <select
                      value={formData.slot}
                      onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      required
                    >
                      {ALLOWED_SLOTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Banner Image</label>
                    {formData.imageUrl && (
                      <div className="mb-2 w-40 h-24 rounded-xl overflow-hidden bg-slate-100">
                        <Image
                          src={getOptimizedCloudinaryUrl(formData.imageUrl, 320)}
                          alt="Preview"
                          width={320}
                          height={224}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const url = await handleUploadImage(file)
                        if (url) setFormData({ ...formData, imageUrl: url })
                        if (e.target.value) e.target.value = ''
                      }}
                      className="w-full text-sm"
                    />
                    {uploading && <p className="text-xs text-slate-500 mt-1">Uploading...</p>}
                    <input
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="Or paste image URL"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 mt-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Link URL</label>
                    <input
                      type="text"
                      value={formData.linkUrl}
                      onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Vendor (optional)</label>
                    <select
                      value={formData.vendorId}
                      onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      disabled={loadingLookups}
                    >
                      <option value="">None</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.userId}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Product (optional)</label>
                    <select
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      disabled={loadingLookups}
                    >
                      <option value="">None</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date</label>
                      <input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End Date</label>
                      <input
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                        required
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span className="text-sm">Active</span>
                  </label>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" loading={saving} className="flex-1">
                      {editingAd ? 'Save' : 'Create'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowModal(false)
                        setEditingAd(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
