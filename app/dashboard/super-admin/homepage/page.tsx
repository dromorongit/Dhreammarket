'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'

interface HomepageSection {
  id: string
  name: string
  slug: string
  isEnabled: boolean
  displayOrder: number
  type: string
  subtitle: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    products: number
    vendors: number
  }
}

interface Product {
  id: string
  name: string
  price: number
  stock: number
  images: Array<{ id: string; url: string; alt: string | null }>
  store?: { id: string; name: string }
  category?: { id: string; name: string }
}

interface Vendor {
  id: string
  email: string
  profile?: { firstName: string; lastName: string }
  store?: { id: string; name: string; isVerified: boolean; isFeatured: boolean }
}

const SECTION_TYPES = [
  { value: 'PRODUCT_GRID', label: 'Product Grid' },
  { value: 'QUICKLINK_CARD_GRID', label: 'Quicklink Cards' },
  { value: 'LARGE_FEATURE_CARDS', label: 'Large Feature Cards' },
  { value: 'BRAND_GRID', label: 'Brand Grid' },
  { value: 'SERVICE_GRID', label: 'Service Grid' },
]

const DEFAULT_SECTIONS = [
  { name: 'Flash Sales', slug: 'flash-sales', type: 'PRODUCT_GRID', subtitle: 'Limited time offers' },
  { name: 'Sponsored Products', slug: 'sponsored-products', type: 'PRODUCT_GRID', subtitle: 'Featured by vendors' },
  { name: 'Quicklinks', slug: 'quicklinks', type: 'QUICKLINK_CARD_GRID', subtitle: null },
  { name: 'Gadget Display', slug: 'gadget-display', type: 'LARGE_FEATURE_CARDS', subtitle: 'Premium tech deals' },
  { name: 'Top-selling Items', slug: 'top-selling', type: 'PRODUCT_GRID', subtitle: 'Most popular' },
  { name: 'Deals You Won\'t Miss', slug: 'deals-you-wont-miss', type: 'PRODUCT_GRID', subtitle: 'Up to 60% Off' },
  { name: 'Big Top Deals', slug: 'big-top-deals', type: 'PRODUCT_GRID', subtitle: null },
  { name: 'Brand Store', slug: 'brand-store', type: 'BRAND_GRID', subtitle: null },
  { name: 'Home Theatre', slug: 'home-theatre', type: 'PRODUCT_GRID', subtitle: null },
  { name: 'Top Express Offers', slug: 'top-express-offers', type: 'PRODUCT_GRID', subtitle: 'Fast delivery' },
  { name: 'Services', slug: 'services', type: 'SERVICE_GRID', subtitle: 'Book local services' },
]

export default function SuperAdminHomepagePage() {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null)
  const [managingSection, setManagingSection] = useState<HomepageSection | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const fetchSections = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/homepage-sections')
      if (response.ok) {
        const data = await response.json()
        setSections(data.sections || [])
      } else {
        setError('Failed to load sections')
      }
    } catch (err) {
      setError('Failed to load sections')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }, [])

  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch('/api/vendors?limit=100')
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
      }
    } catch (err) {
      console.error('Error fetching vendors:', err)
    }
  }, [])

  useEffect(() => {
    fetchSections()
    fetchProducts()
    fetchVendors()
  }, [fetchSections, fetchProducts, fetchVendors])

  const handleToggle = async (section: HomepageSection) => {
    try {
      const response = await fetch(`/api/homepage-sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !section.isEnabled }),
      })
      if (response.ok) {
        setSections((prev) =>
          prev.map((s) => (s.id === section.id ? { ...s, isEnabled: !s.isEnabled } : s))
        )
      }
    } catch (err) {
      console.error('Error toggling section:', err)
    }
  }

  const handleCreate = async (data: {
    name: string
    slug: string
    type: string
    subtitle?: string
  }) => {
    setSaving(true)
    try {
      const response = await fetch('/api/homepage-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (response.ok) {
        await fetchSections()
        setShowCreateModal(false)
      }
    } catch (err) {
      console.error('Error creating section:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (data: {
    name?: string
    slug?: string
    type?: string
    subtitle?: string | null
  }) => {
    if (!editingSection) return
    setSaving(true)
    try {
      const response = await fetch(`/api/homepage-sections/${editingSection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (response.ok) {
        await fetchSections()
        setEditingSection(null)
      }
    } catch (err) {
      console.error('Error updating section:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return
    try {
      const response = await fetch(`/api/homepage-sections/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setSections((prev) => prev.filter((s) => s.id !== id))
      }
    } catch (err) {
      console.error('Error deleting section:', err)
    }
  }

  const handleReorder = async () => {
    if (draggedIndex === null) return
    const orders = sections.map((s, i) => ({ id: s.id, displayOrder: i }))
    try {
      const response = await fetch('/api/homepage-sections/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      })
      if (response.ok) {
        await fetchSections()
      }
    } catch (err) {
      console.error('Error reordering sections:', err)
    } finally {
      setDraggedIndex(null)
    }
  }

  const handleAssignProducts = async () => {
    if (!managingSection) return
    setSaving(true)
    try {
      const response = await fetch(`/api/homepage-sections/${managingSection.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selectedProducts) }),
      })
      if (response.ok) {
        await fetchSections()
        setManagingSection(null)
        setSelectedProducts(new Set())
      }
    } catch (err) {
      console.error('Error assigning products:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAssignVendors = async () => {
    if (!managingSection) return
    setSaving(true)
    try {
      const response = await fetch(`/api/homepage-sections/${managingSection.id}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorIds: Array.from(selectedVendors) }),
      })
      if (response.ok) {
        await fetchSections()
        setManagingSection(null)
        setSelectedVendors(new Set())
      }
    } catch (err) {
      console.error('Error assigning vendors:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveProduct = async (sectionId: string, productId: string) => {
    try {
      await fetch(`/api/homepage-sections/${sectionId}/products?productId=${productId}`, {
        method: 'DELETE',
      })
      await fetchSections()
    } catch (err) {
      console.error('Error removing product:', err)
    }
  }

  const handleRemoveVendor = async (sectionId: string, vendorId: string) => {
    try {
      await fetch(`/api/homepage-sections/${sectionId}/vendors?vendorId=${vendorId}`, {
        method: 'DELETE',
      })
      await fetchSections()
    } catch (err) {
      console.error('Error removing vendor:', err)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    const newSections = [...sections]
    const [dragged] = newSections.splice(draggedIndex, 1)
    newSections.splice(index, 0, dragged)
    setSections(newSections)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      handleReorder()
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.store?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredVendors = vendors.filter(
    (v) =>
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.profile?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.profile?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.store?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            title="Error loading sections"
            description={error}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Homepage Sections</h1>
            <p className="text-slate-600 mt-1">
              Manage homepage sections, toggle visibility, assign products and vendors
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            + Add Section
          </Button>
        </div>

        {/* Sections List */}
        {sections.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            title="No sections yet"
            description="Create your first homepage section to get started."
            actionLabel="Create First Section"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <Card
                key={section.id}
                variant="elevated"
                className={`transition-all duration-200 ${
                  draggedIndex === index ? 'opacity-50 ring-2 ring-royal-blue' : ''
                } ${!section.isEnabled ? 'opacity-60' : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Drag Handle */}
                    <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(section)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        section.isEnabled ? 'bg-royal-blue' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          section.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    {/* Section Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-deep-navy truncate">
                          {section.name}
                        </h3>
                        <Badge variant="default" size="sm">
                          {section.type.replace(/_/g, ' ')}
                        </Badge>
                        {section.subtitle && (
                          <span className="text-xs text-slate-500 truncate">
                            — {section.subtitle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>Slug: {section.slug}</span>
                        <span>Order: {section.displayOrder}</span>
                        {section._count && (
                          <>
                            <span>{section._count.products} products</span>
                            <span>{section._count.vendors} vendors</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setManagingSection(section)}
                      >
                        Manage
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSection(section)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(section.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Section Modal */}
        {showCreateModal && (
          <SectionModal
            title="Create Section"
            onSubmit={handleCreate}
            onClose={() => setShowCreateModal(false)}
            saving={saving}
          />
        )}

        {/* Edit Section Modal */}
        {editingSection && (
          <SectionModal
            title="Edit Section"
            initialData={{
              name: editingSection.name,
              slug: editingSection.slug,
              type: editingSection.type,
              subtitle: editingSection.subtitle || '',
            }}
            onSubmit={handleUpdate}
            onClose={() => setEditingSection(null)}
            saving={saving}
          />
        )}

        {/* Manage Section Modal */}
        {managingSection && (
          <ManageSectionModal
            section={managingSection}
            products={products}
            vendors={vendors}
            selectedProducts={selectedProducts}
            selectedVendors={selectedVendors}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onProductToggle={(id) => {
              setSelectedProducts((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onVendorToggle={(id) => {
              setSelectedVendors((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onAssignProducts={handleAssignProducts}
            onAssignVendors={handleAssignVendors}
            onRemoveProduct={handleRemoveProduct}
            onRemoveVendor={handleRemoveVendor}
            onClose={() => {
              setManagingSection(null)
              setSelectedProducts(new Set())
              setSelectedVendors(new Set())
            }}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}

// Section Create/Edit Modal
function SectionModal({
  title,
  initialData,
  onSubmit,
  onClose,
  saving,
}: {
  title: string
  initialData?: { name: string; slug: string; type: string; subtitle: string }
  onSubmit: (data: { name: string; slug: string; type: string; subtitle?: string }) => void
  onClose: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initialData?.name || '')
  const [slug, setSlug] = useState(initialData?.slug || '')
  const [type, setType] = useState(initialData?.type || 'PRODUCT_GRID')
  const [subtitle, setSubtitle] = useState(initialData?.subtitle || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    onSubmit({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
      subtitle: subtitle.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card variant="elevated" className="w-full max-w-lg">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold text-deep-navy mb-6">{title}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Section Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!initialData) {
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none"
                placeholder="e.g. Flash Sales"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none"
                placeholder="e.g. flash-sales"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none"
              >
                {SECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Subtitle (optional)
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none"
                placeholder="e.g. Up to 60% Off"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving} className="flex-1">
                {initialData ? 'Save Changes' : 'Create Section'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Manage Section Modal (assign products/vendors)
function ManageSectionModal({
  section,
  products,
  vendors,
  selectedProducts,
  selectedVendors,
  searchQuery,
  onSearchChange,
  onProductToggle,
  onVendorToggle,
  onAssignProducts,
  onAssignVendors,
  onRemoveProduct,
  onRemoveVendor,
  onClose,
  saving,
}: {
  section: HomepageSection
  products: Product[]
  vendors: Vendor[]
  selectedProducts: Set<string>
  selectedVendors: Set<string>
  searchQuery: string
  onSearchChange: (q: string) => void
  onProductToggle: (id: string) => void
  onVendorToggle: (id: string) => void
  onAssignProducts: () => void
  onAssignVendors: () => void
  onRemoveProduct: (sectionId: string, productId: string) => void
  onRemoveVendor: (sectionId: string, vendorId: string) => void
  onClose: () => void
  saving: boolean
}) {
  const [activeTab, setActiveTab] = useState<'products' | 'vendors'>('products')

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.store?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredVendors = vendors.filter(
    (v) =>
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.profile?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.profile?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.store?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card variant="elevated" className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-deep-navy">Manage: {section.name}</h2>
              <p className="text-sm text-slate-500 mt-1">
                Assign products and vendors to this section
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-slate-200 pb-3">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'products'
                  ? 'bg-royal-blue text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Products ({selectedProducts.size} selected)
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'vendors'
                  ? 'bg-royal-blue text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Vendors ({selectedVendors.size} selected)
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none"
            />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {activeTab === 'products' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => onProductToggle(product.id)}
                    className={`relative cursor-pointer rounded-xl border-2 transition-all ${
                      selectedProducts.has(product.id)
                        ? 'border-royal-blue bg-royal-blue/5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="aspect-square bg-slate-100 rounded-t-xl overflow-hidden">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].alt || product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-deep-navy line-clamp-2 leading-tight">
                        {product.name}
                      </p>
                      <p className="text-[10px] font-bold text-royal-blue mt-1">
                        GH₵ {product.price.toFixed(2)}
                      </p>
                    </div>
                    {selectedProducts.has(product.id) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-royal-blue rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    onClick={() => onVendorToggle(vendor.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedVendors.has(vendor.id)
                        ? 'border-royal-blue bg-royal-blue/5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {vendor.profile?.firstName?.[0] || vendor.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-deep-navy truncate">
                        {vendor.profile?.firstName} {vendor.profile?.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{vendor.email}</p>
                      {vendor.store && (
                        <p className="text-xs text-slate-400 truncate">{vendor.store.name}</p>
                      )}
                    </div>
                    {selectedVendors.has(vendor.id) && (
                      <div className="w-5 h-5 bg-royal-blue rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 mt-4 border-t border-slate-200">
            {activeTab === 'products' ? (
              <Button
                onClick={onAssignProducts}
                loading={saving}
                disabled={selectedProducts.size === 0}
                className="flex-1"
              >
                Assign {selectedProducts.size} Product{selectedProducts.size !== 1 ? 's' : ''}
              </Button>
            ) : (
              <Button
                onClick={onAssignVendors}
                loading={saving}
                disabled={selectedVendors.size === 0}
                className="flex-1"
              >
                Assign {selectedVendors.size} Vendor{selectedVendors.size !== 1 ? 's' : ''}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
