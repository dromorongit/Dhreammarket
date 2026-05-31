'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'

interface Brand {
  id: string
  name: string
  slug: string
  logo: string | null
  description: string | null
  isActive: boolean
  displayOrder: number
  _count?: { products: number }
}

interface Product {
  id: string
  name: string
  price: number
  stock: number
  images: Array<{ url: string; alt: string | null }>
  store?: { name: string }
}

export default function SuperAdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [managingBrand, setManagingBrand] = useState<Brand | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [productTotalPages, setProductTotalPages] = useState(1)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [assignedProducts, setAssignedProducts] = useState<Product[]>([])

  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/super-admin/brands?includeInactive=true')
      if (response.ok) {
        const data = await response.json()
        setBrands(data.brands || [])
      }
    } catch (err) {
      console.error('Error fetching brands:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async (page = 1, search = '') => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24' })
      if (search) params.set('search', search)
      const response = await fetch(`/api/admin/products?${params}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
        setProductTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }, [])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  useEffect(() => {
    if (managingBrand) {
      fetchProducts(productPage, productSearch)
      fetch(`/api/super-admin/brands/${managingBrand.id}`)
        .then((r) => r.json())
        .then((data) => setAssignedProducts(data.brand?.products || []))
        .catch(console.error)
    }
  }, [managingBrand, productPage, productSearch, fetchProducts])

  const handleSaveBrand = async (data: {
    name: string
    slug: string
    description?: string
    logo?: string | null
    isActive?: boolean
  }) => {
    setSaving(true)
    try {
      const url = editingBrand
        ? `/api/super-admin/brands/${editingBrand.id}`
        : '/api/super-admin/brands'
      const response = await fetch(url, {
        method: editingBrand ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (response.ok) {
        await fetchBrands()
        setShowModal(false)
        setEditingBrand(null)
      }
    } catch (err) {
      console.error('Error saving brand:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleUploadLogo = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('files', file)
    formData.append('folder', 'brands')
    const response = await fetch('/api/super-admin/upload', { method: 'POST', body: formData })
    if (!response.ok) return null
    const data = await response.json()
    return data.urls?.[0]?.secureUrl || data.urls?.[0]?.url || null
  }

  const handleAssignProducts = async () => {
    if (!managingBrand || selectedProducts.size === 0) return
    setSaving(true)
    try {
      const response = await fetch(`/api/super-admin/brands/${managingBrand.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selectedProducts) }),
      })
      if (response.ok) {
        const data = await response.json()
        setAssignedProducts(data.products || [])
        setSelectedProducts(new Set())
        await fetchBrands()
      }
    } catch (err) {
      console.error('Error assigning products:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveProduct = async (productId: string) => {
    if (!managingBrand) return
    await fetch(`/api/super-admin/brands/${managingBrand.id}/products?productId=${productId}`, {
      method: 'DELETE',
    })
    setAssignedProducts((prev) => prev.filter((p) => p.id !== productId))
    await fetchBrands()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brand? Products will be unlinked but not deleted.')) return
    await fetch(`/api/super-admin/brands/${id}`, { method: 'DELETE' })
    await fetchBrands()
  }

  const filteredBrands = brands.filter(
    (b) =>
      (b.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.slug ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
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
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard/super-admin/homepage" className="text-sm text-royal-blue hover:underline">
                ← Homepage Sections
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-deep-navy">Brand Management</h1>
            <p className="text-slate-600 mt-1">Create brands, upload logos, and assign products for the Brand Store</p>
          </div>
          <Button onClick={() => { setEditingBrand(null); setShowModal(true) }}>+ Add Brand</Button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brands..."
            className="w-full max-w-md px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue outline-none"
          />
        </div>

        {filteredBrands.length === 0 ? (
          <EmptyState
            title="No brands yet"
            description="Create your first brand to populate the Brand Store section."
            actionLabel="Add Brand"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div className="space-y-3">
            {filteredBrands.map((brand) => (
              <Card key={brand.id} variant="elevated" className={!brand.isActive ? 'opacity-60' : ''}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {brand.logo ? (
                      <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-royal-blue">{brand.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-deep-navy">{brand.name}</h3>
                      {!brand.isActive && <Badge variant="default" size="sm">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Slug: {brand.slug} · {brand._count?.products ?? 0} products · Order: {brand.displayOrder}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setManagingBrand(brand)}>Products</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingBrand(brand); setShowModal(true) }}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(brand.id)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showModal && (
          <BrandModal
            brand={editingBrand}
            saving={saving}
            onUploadLogo={handleUploadLogo}
            onSave={handleSaveBrand}
            onClose={() => { setShowModal(false); setEditingBrand(null) }}
          />
        )}

        {managingBrand && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card variant="elevated" className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex justify-between mb-4">
                  <h2 className="text-xl font-bold">Assign Products: {managingBrand.name}</h2>
                  <button onClick={() => setManagingBrand(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                {assignedProducts.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">Assigned ({assignedProducts.length})</p>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                      {assignedProducts.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs">
                          {p.name}
                          <button onClick={() => handleRemoveProduct(p.id)} className="text-rose-500 hover:text-rose-700">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setProductPage(1) }}
                  placeholder="Search products..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 mb-4"
                />

                <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 min-h-[200px]">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedProducts((prev) => {
                          const next = new Set(prev)
                          if (next.has(product.id)) next.delete(product.id)
                          else next.add(product.id)
                          return next
                        })
                      }}
                      className={`cursor-pointer rounded-xl border-2 p-2 ${selectedProducts.has(product.id) ? 'border-royal-blue bg-royal-blue/5' : 'border-slate-200'}`}
                    >
                      <p className="text-xs font-medium line-clamp-2">{product.name}</p>
                      <p className="text-[10px] text-royal-blue font-bold">GH₵ {product.price.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={productPage <= 1} onClick={() => setProductPage((p) => p - 1)}>Prev</Button>
                    <span className="text-sm text-slate-500 self-center">Page {productPage} / {productTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={productPage >= productTotalPages} onClick={() => setProductPage((p) => p + 1)}>Next</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAssignProducts} loading={saving} disabled={selectedProducts.size === 0}>
                      Assign {selectedProducts.size} Product{selectedProducts.size !== 1 ? 's' : ''}
                    </Button>
                    <Button variant="outline" onClick={() => setManagingBrand(null)}>Close</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function BrandModal({
  brand,
  saving,
  onUploadLogo,
  onSave,
  onClose,
}: {
  brand: Brand | null
  saving: boolean
  onUploadLogo: (file: File) => Promise<string | null>
  onSave: (data: { name: string; slug: string; description?: string; logo?: string | null; isActive?: boolean }) => void
  onClose: () => void
}) {
  const [name, setName] = useState(brand?.name || '')
  const [slug, setSlug] = useState(brand?.slug || '')
  const [description, setDescription] = useState(brand?.description || '')
  const [logo, setLogo] = useState(brand?.logo || '')
  const [isActive, setIsActive] = useState(brand?.isActive ?? true)
  const [uploading, setUploading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-'),
      description: description.trim() || undefined,
      logo: logo || null,
      isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card variant="elevated" className="w-full max-w-lg">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-6">{brand ? 'Edit Brand' : 'Create Brand'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!brand) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Logo</label>
              {logo && <img src={logo} alt="Logo" className="w-16 h-16 rounded-xl object-cover mb-2" />}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  const url = await onUploadLogo(file)
                  if (url) setLogo(url)
                  setUploading(false)
                }}
                className="w-full text-sm"
              />
              {uploading && <p className="text-xs text-slate-500 mt-1">Uploading...</p>}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span className="text-sm">Active on homepage</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving} className="flex-1">{brand ? 'Save' : 'Create'}</Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
