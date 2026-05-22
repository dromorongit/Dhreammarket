'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  slug: string
  parentId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  children?: Category[]
  _count?: {
    products: number
  }
}

interface CategoryFormData {
  name: string
  parentId: string
  isActive: boolean
}

const initialFormData: CategoryFormData = {
  name: '',
  parentId: '',
  isActive: true,
}

export default function SuperAdminProductCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; hasProducts: boolean; productCount: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  // Expandable hierarchy: tracks which parent category IDs are currently expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ includeChildren: 'true', includeInactive: 'true' })
      const response = await fetch(`/api/super-admin/categories?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to load categories')
        return
      }

      setCategories(data.categories || [])
    } catch (err) {
      setError('Failed to fetch categories')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Category name is required')
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: formData.name.trim(),
        parentId: formData.parentId || null,
        isActive: formData.isActive,
      }

      const url = editingCategory
        ? '/api/super-admin/categories'
        : '/api/super-admin/categories'

      const response = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: editingCategory
          ? JSON.stringify({ id: editingCategory.id, ...payload })
          : JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to save category')
        return
      }

      setShowForm(false)
      setEditingCategory(null)
      setFormData(initialFormData)
      fetchCategories()
    } catch (err) {
      alert('Failed to save category')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      parentId: category.parentId || '',
      isActive: category.isActive,
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCategory(null)
    setFormData(initialFormData)
  }

  const handleToggleStatus = async (category: Category) => {
    try {
      setToggling(category.id)
      const response = await fetch('/api/super-admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: category.id,
          name: category.name,
          isActive: !category.isActive,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to update category status')
        return
      }

      fetchCategories()
    } catch (err) {
      alert('Failed to update category status')
      console.error(err)
    } finally {
      setToggling(null)
    }
  }

  const handleDeleteClick = (category: Category) => {
    const productCount = category._count?.products || 0
    setDeleteConfirm({
      id: category.id,
      name: category.name,
      hasProducts: productCount > 0,
      productCount,
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    try {
      setDeleting(deleteConfirm.id)
      const force = deleteConfirm.hasProducts
      const response = await fetch(`/api/super-admin/categories?id=${deleteConfirm.id}${force ? '&force=true' : ''}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to delete category')
        return
      }

      setDeleteConfirm(null)
      fetchCategories()
    } catch (err) {
      alert('Failed to delete category')
      console.error(err)
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Toggle expand/collapse for a parent category
  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Flatten categories for parent selection (exclude self and descendants)
  const getFlatCategories = (cats: Category[], excludeId?: string): Category[] => {
    const result: Category[] = []
    const flatten = (items: Category[]) => {
      for (const cat of items) {
        if (cat.id !== excludeId) {
          result.push(cat)
          if (cat.children && cat.children.length > 0) {
            flatten(cat.children)
          }
        }
      }
    }
    flatten(cats)
    return result
  }

  // Get all child category IDs recursively
  const getChildIds = (cats: Category[]): Set<string> => {
    const ids = new Set<string>()
    const collect = (items: Category[]) => {
      for (const cat of items) {
        if (cat.children && cat.children.length > 0) {
          for (const child of cat.children) {
            ids.add(child.id)
            if (child.children) {
              collect(child.children)
            }
          }
        }
      }
    }
    collect(cats)
    return ids
  }

  // Filter categories for display - only show top-level categories (no parent)
  const getFilteredCategories = (cats: Category[]): Category[] => {
    // First, get all child IDs to exclude them from top-level
    const childIds = getChildIds(cats)

    // Filter to only top-level categories (parentId is null)
    let filtered = cats.filter(c => c.parentId === null)

    if (statusFilter === 'active') {
      filtered = filtered.filter(c => c.isActive)
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(c => !c.isActive)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const filterRecursive = (items: Category[]): Category[] => {
        return items.filter(cat => {
          const matchesSelf = cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q)
          const filteredChildren = cat.children ? filterRecursive(cat.children) : []
          if (filteredChildren.length > 0) {
            return matchesSelf || filteredChildren.length > 0
          }
          return matchesSelf
        }).map(cat => ({
          ...cat,
          children: cat.children ? filterRecursive(cat.children) : undefined,
        }))
      }
      filtered = filterRecursive(filtered)
    }

    return filtered
  }

  // ─── MOBILE CARD RENDERER ───────────────────────────────────────────────
  // Renders a category as a premium stacked card on mobile.
  // Parent categories with children get an expand/collapse chevron.
  // Subcategories render as nested indented cards when the parent is expanded.
  const renderMobileCategoryCard = (category: Category, level = 0): React.ReactNode => {
    const hasChildren = category.children && category.children.length > 0
    const isExpanded = expandedCategories.has(category.id)
    const productCount = category._count?.products || 0

    return (
      <div key={category.id}>
        {/* Category Card */}
        <div
          className={`
            relative rounded-2xl border transition-all duration-200
            ${level === 0
              ? 'bg-white border-slate-200 shadow-sm'
              : 'bg-slate-50/80 border-slate-200/80 shadow-none ml-3 sm:ml-4'
            }
            ${level > 0 ? 'border-l-2 border-l-royal-blue/30' : ''}
          `}
        >
          {/* Expand/Collapse Row — only for parents with children */}
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(category.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${category.name}` : `Expand ${category.name}`}
            >
              {/* Chevron icon — rotates 90° when expanded */}
              <svg
                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ease-in-out ${
                  isExpanded ? 'rotate-90 text-royal-blue' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              {/* Category name */}
              <span className="flex-1 min-w-0 text-sm font-semibold text-slate-900 truncate">
                {category.name}
              </span>

              {/* Subcategory count badge */}
              <span className="flex-shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {category.children!.length} sub
              </span>
            </button>
          ) : (
            /* Leaf category — no expand control, just display the name */
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Spacer to align with chevron position of parent rows */}
              <div className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 min-w-0 text-sm font-semibold text-slate-900 truncate">
                {category.name}
              </span>
            </div>
          )}

          {/* Divider between name row and details row */}
          <div className="h-px bg-slate-100" />

          {/* Details Row: product count, status, date, actions */}
          <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Product count */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="font-medium text-slate-700">{productCount}</span>
              <span>products</span>
            </div>

            {/* Status badge */}
            <div className="flex-shrink-0">
              {category.isActive ? (
                <Badge variant="success" className="text-[10px] px-2 py-0.5">Active</Badge>
              ) : (
                <Badge variant="default" className="text-[10px] px-2 py-0.5">Disabled</Badge>
              )}
            </div>

            {/* Created date */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDate(category.createdAt)}</span>
            </div>

            {/* Spacer pushes actions to the right */}
            <div className="flex-1" />

            {/* Action buttons — touch-friendly 44×44px targets */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleToggleStatus(category)}
                disabled={toggling === category.id}
                className={`
                  p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center
                  ${category.isActive
                    ? 'text-amber-600 hover:bg-amber-50 active:bg-amber-100'
                    : 'text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100'
                  }
                  ${toggling === category.id ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={category.isActive ? 'Disable category' : 'Enable category'}
                aria-label={category.isActive ? 'Disable category' : 'Enable category'}
              >
                {toggling === category.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : category.isActive ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => handleEdit(category)}
                className="p-2.5 rounded-xl text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Edit category"
                aria-label={`Edit ${category.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => handleDeleteClick(category)}
                className="p-2.5 rounded-xl text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Delete category"
                aria-label={`Delete ${category.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded subcategories — rendered recursively */}
        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-2">
            {category.children!.map((child) => renderMobileCategoryCard(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // ─── DESKTOP TABLE ROW RENDERER ─────────────────────────────────────────
  // Preserves the original executive table layout for desktop/tablet screens.
  // Uses flexbox row with proper column widths, hover states, and action icons.
  const renderDesktopCategoryRow = (category: Category, level = 0): React.ReactNode => {
    const hasChildren = category.children && category.children.length > 0
    const filteredChildren = getFilteredCategories(category.children || [])

    return (
      <div key={category.id}>
        <div className="flex items-center gap-4 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 border-b border-slate-100 transition-colors group">
          <div
            className="flex-1 flex items-center gap-2 min-w-0"
            style={{ paddingLeft: level * 28 }}
          >
            {level > 0 && (
              <div className="w-5 h-px bg-slate-300 flex-shrink-0"></div>
            )}
            <span className="text-sm font-medium text-slate-900 truncate">{category.name}</span>
            <span className="text-xs text-slate-400 truncate hidden sm:inline">({category.slug})</span>
            {hasChildren && (
              <span className="text-xs text-slate-400 flex-shrink-0">({category.children?.length} sub)</span>
            )}
          </div>
          <div className="text-sm text-slate-600 w-20 text-center flex-shrink-0">
            {category._count?.products || 0}
          </div>
          <div className="w-28 flex-shrink-0">
            {category.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="default">Disabled</Badge>
            )}
          </div>
          <div className="text-sm text-slate-500 w-28 flex-shrink-0 hidden md:block">
            {formatDate(category.createdAt)}
          </div>
          <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
            <button
              onClick={() => handleToggleStatus(category)}
              disabled={toggling === category.id}
              className={`p-1.5 rounded-lg transition-colors ${
                category.isActive
                  ? 'text-amber-600 hover:bg-amber-50'
                  : 'text-emerald-600 hover:bg-emerald-50'
              } ${toggling === category.id ? 'opacity-50' : ''}`}
              title={category.isActive ? 'Disable category' : 'Enable category'}
            >
              {toggling === category.id ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : category.isActive ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => handleEdit(category)}
              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
              title="Edit category"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => handleDeleteClick(category)}
              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              title="Delete category"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        {hasChildren && filteredChildren.length > 0 &&
          filteredChildren.map((child) => renderDesktopCategoryRow(child, level + 1))
        }
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-fade-in-up">
            <div className="h-10 bg-slate-200 rounded-lg w-64 mb-8"></div>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  if (error && !categories.length) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/dashboard/super-admin" className="text-royal-blue hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
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

  const flatCategories = getFlatCategories(categories)
  const displayCategories = getFilteredCategories(categories)
  const totalProducts = categories.reduce((sum, cat) => sum + (cat._count?.products || 0), 0)
  const activeCount = categories.filter(c => c.isActive).length
  const inactiveCount = categories.length - activeCount

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy via-purple-900 to-royal-blue py-12 lg:py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="mb-3">
                <Link href="/dashboard/super-admin" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Super Admin Dashboard
                </Link>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
                Product Categories
              </h1>
              <p className="text-slate-300 text-sm sm:text-base">
                Manage product categories across the entire marketplace
              </p>
            </div>
            {!showForm && (
              <Button
                variant="primary"
                onClick={() => setShowForm(true)}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Category
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-xl font-bold text-deep-navy">{categories.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Active</p>
                  <p className="text-xl font-bold text-deep-navy">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Disabled</p>
                  <p className="text-xl font-bold text-deep-navy">{inactiveCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Products</p>
                  <p className="text-xl font-bold text-deep-navy">{totalProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Form */}
        {showForm && (
          <Card variant="elevated" className="mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-royal-blue/5 to-purple-500/5 px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-deep-navy">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h2>
            </div>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Category Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Electronics, Fashion, Home & Garden"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Parent Category
                    </label>
                    <select
                      value={formData.parentId}
                      onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm bg-white"
                    >
                      <option value="">No parent (top-level category)</option>
                      {flatCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {editingCategory && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-royal-blue focus:ring-royal-blue"
                      />
                      <span className="text-sm font-medium text-slate-700">Category is active</span>
                    </label>
                    {!formData.isActive && (
                      <Badge variant="warning">Will be hidden from marketplace</Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-gradient-to-r from-royal-blue to-purple-600 text-white rounded-xl hover:from-royal-blue/90 hover:to-purple-600/90 transition-all text-sm font-medium disabled:opacity-50 shadow-md hover:shadow-lg"
                  >
                    {saving ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Categories Section */}
        <Card variant="elevated" className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-deep-navy">
                Category Directory
                <span className="text-sm font-normal text-slate-500 ml-2">({categories.length} total)</span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue w-full sm:w-48"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Disabled</option>
                </select>
              </div>
            </div>
          </CardHeader>

          {loading ? (
            <CardContent className="p-8">
              <div className="animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg"></div>
                ))}
              </div>
            </CardContent>
          ) : displayCategories.length === 0 ? (
            <CardContent className="p-12">
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                }
                title={searchQuery ? 'No matching categories' : 'No categories yet'}
                description={searchQuery ? 'Try adjusting your search or filter.' : 'Create your first product category to get started.'}
              >
                {!searchQuery && !showForm && (
                  <Button onClick={() => setShowForm(true)} variant="primary">
                    Create First Category
                  </Button>
                )}
              </EmptyState>
            </CardContent>
          ) : (
            <>
              {/* ── DESKTOP / TABLET: Executive Table Layout (md and up) ── */}
              <div className="hidden md:block">
                {/* Table Header */}
                <div className="flex items-center px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex-1">Name</div>
                  <div className="w-20 text-center">Products</div>
                  <div className="w-28 text-center">Status</div>
                  <div className="w-28 text-center hidden lg:block">Created</div>
                  <div className="w-36 text-right">Actions</div>
                </div>
                {/* Table Body */}
                <div>
                  {displayCategories.map((category) => renderDesktopCategoryRow(category))}
                </div>
              </div>

              {/* ── MOBILE: Premium Stacked Card Layout (below md) ── */}
              <div className="md:hidden p-4 space-y-3">
                {displayCategories.map((category) => renderMobileCategoryCard(category))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-premium-xl max-w-md w-full p-6 animate-fade-in-up">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Category</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-600 mb-2">
              Are you sure you want to delete <strong className="text-slate-900">"{deleteConfirm.name}"</strong>?
            </p>
            {deleteConfirm.hasProducts && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-amber-800">
                  This category has <strong>{deleteConfirm.productCount}</strong> product(s) assigned.
                  {deleting !== deleteConfirm.id && (
                    <span className="block mt-1 text-amber-700">
                      Products will be unassigned from this category if you proceed.
                    </span>
                  )}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting === deleteConfirm.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {deleting === deleteConfirm.id ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
