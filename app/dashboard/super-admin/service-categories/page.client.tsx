'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import ImageUpload from '@/components/ImageUpload'
import Link from 'next/link'

interface ServiceCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  banner: string | null
  displayOrder: number
  isActive: boolean
  isFeatured: boolean
  metaTitle: string | null
  metaDescription: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    services: number
  }
}

interface CategoryFormData {
  name: string
  slug: string
  description: string
  icon: string
  banner: string
  displayOrder: number
  isActive: boolean
  isFeatured: boolean
  metaTitle: string
  metaDescription: string
}

const initialFormData: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  banner: '',
  displayOrder: 0,
  isActive: true,
  isFeatured: false,
  metaTitle: '',
  metaDescription: '',
}

export default function SuperAdminServiceCategoriesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('limit', '20')
      params.set('includeInactive', 'true')
      if (searchQuery.trim()) params.set('search', searchQuery.trim())

      const response = await fetch(`/api/admin/service-categories?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch categories')
        return
      }

      setCategories(data.categories || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      setError('Failed to fetch categories')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchQuery])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingCategory
        ? `/api/admin/service-categories/${editingCategory.id}`
        : '/api/admin/service-categories'
      const method = editingCategory ? 'PUT' : 'POST'

      const payload = {
        ...formData,
        slug: formData.slug.toLowerCase().trim(),
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to save category')
        return
      }

      await fetchCategories()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (category: ServiceCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || '',
      banner: category.banner || '',
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      isFeatured: category.isFeatured,
      metaTitle: category.metaTitle || '',
      metaDescription: category.metaDescription || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(id)
    try {
      const response = await fetch(`/api/admin/service-categories/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to delete category')
        return
      }

      await fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Failed to delete category')
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleActive = async (category: ServiceCategory) => {
    setToggling(category.id)
    try {
      const response = await fetch(`/api/admin/service-categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to update category')
        return
      }

      await fetchCategories()
    } catch (error) {
      console.error('Error toggling category:', error)
      alert('Failed to update category')
    } finally {
      setToggling(null)
    }
  }

  const handleToggleFeatured = async (category: ServiceCategory) => {
    setToggling(category.id)
    try {
      const response = await fetch(`/api/admin/service-categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !category.isFeatured }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to update category')
        return
      }

      await fetchCategories()
    } catch (error) {
      console.error('Error toggling featured:', error)
      alert('Failed to update category')
    } finally {
      setToggling(null)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData(initialFormData)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : generateSlug(name),
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
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
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Error Loading Categories"
            description={error}
          >
            <Button onClick={fetchCategories} variant="primary">
              Try Again
            </Button>
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Service Categories</h1>
            <p className="text-slate-600 mt-1">Manage service categories for vendors and customers</p>
          </div>
          <Button onClick={() => setShowModal(true)} variant="primary">
            + Add Category
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                />
              </div>
              <span className="text-sm text-slate-500">
                {total} category{total !== 1 ? 's' : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        {categories.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            title="No service categories"
            description="Create your first service category to get started."
          >
            <Button onClick={() => setShowModal(true)} variant="primary">
              + Add Category
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <Card key={category.id} variant="elevated" className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-deep-navy">{category.name}</h3>
                        <p className="text-sm text-slate-500">/{category.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={category.isActive ? 'verified' : 'default'}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {category.isFeatured && (
                          <Badge variant="premium">Featured</Badge>
                        )}
                      </div>
                    </div>

                    {category.description && (
                      <p className="text-sm text-slate-600 mb-4 line-clamp-2">{category.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <span className="text-sm text-slate-600">
                        {category._count?.services || 0} service{category._count?.services !== 1 ? 's' : ''}
                      </span>
                      <span className="text-sm text-slate-500">
                        Order: {category.displayOrder}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-3">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(category)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(category)}
                        disabled={toggling === category.id}
                      >
                        {toggling === category.id ? '...' : category.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleFeatured(category)}
                        disabled={toggling === category.id}
                      >
                        {toggling === category.id ? '...' : category.isFeatured ? 'Unfeature' : 'Feature'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(category.id, category.name)}
                        disabled={deleting === category.id}
                        className="text-red-600 hover:text-red-800"
                      >
                        {deleting === category.id ? '...' : 'Delete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between border-t pt-6">
                <div className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages} ({total} categories)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold text-deep-navy mb-6">
                {editingCategory ? 'Edit Service Category' : 'Create Service Category'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={handleNameChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      placeholder="e.g., Web Development, Graphic Design"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Slug *
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      placeholder="auto-generated-from-name"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Used in URLs. Lowercase, no spaces.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    placeholder="Brief description of this service category"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Icon URL
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      placeholder="https://example.com/icon.png"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Banner URL
                    </label>
                    <input
                      type="text"
                      value={formData.banner}
                      onChange={(e) => setFormData(prev => ({ ...prev, banner: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      placeholder="https://example.com/banner.png"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Meta Title
                    </label>
                    <input
                      type="text"
                      value={formData.metaTitle}
                      onChange={(e) => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      placeholder="SEO meta title"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Meta Description
                  </label>
                  <textarea
                    value={formData.metaDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    placeholder="SEO meta description"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 text-royal-blue rounded"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                      Active (visible to vendors and customers)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isFeatured"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                      className="w-4 h-4 text-royal-blue rounded"
                    />
                    <label htmlFor="isFeatured" className="text-sm font-medium text-slate-700">
                      Featured (display prominently)
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={handleCloseModal} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={saving} className="flex-1">
                    {saving ? 'Saving...' : (editingCategory ? 'Update' : 'Create')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}