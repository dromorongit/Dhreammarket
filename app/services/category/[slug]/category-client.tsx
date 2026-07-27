'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import ServiceCard from '@/components/ServiceCard'
import { formatPrice } from '@/lib/currency'

interface CategoryService {
  id: string
  slug: string
  title: string
  shortDescription: string | null
  startingPrice: number
  pricingType: string
  thumbnail: string | null
  images: Array<{ id: string; imageUrl: string; displayOrder: number }>
  store: { id: string; name: string; slug: string; isVerified: boolean; badgeTier: string | null }
}

interface CategoryData {
  id: string
  name: string
  slug: string
  description: string | null
}

interface CategoryPageClientProps {
  params: { slug: string }
}

export default function CategoryPageClient({ params }: CategoryPageClientProps) {
  const [services, setServices] = useState<CategoryService[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryTitle, setCategoryTitle] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 })

  useEffect(() => {
    fetchCategory()
    fetchServices()
  }, [])

  const fetchCategory = async () => {
    try {
      const response = await fetch('/api/service-categories')
      if (response.ok) {
        const data = await response.json()
        const cat = data.categories?.find((c: any) => c.slug === params.slug)
        if (cat) setCategoryTitle(cat.name)
      }
    } catch (error) {
      console.error('Error fetching category:', error)
    }
  }

  const fetchServices = async () => {
    try {
      setLoading(true)
      const params2 = new URLSearchParams()
      params2.set('page', '1')
      params2.set('limit', '12')
      params2.set('categoryId', params.slug)
      params2.set('sortBy', 'createdAt')
      params2.set('sortOrder', 'desc')
      const response = await fetch(`/api/services?${params2.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setServices(data.services || [])
        setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 0 })
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative bg-gradient-to-br from-deep-navy to-royal-blue py-16 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <Badge variant="premium">Services</Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              {categoryTitle || 'Services Category'}
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Browse professional services in this category from verified vendors.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            title="No services in this category yet"
            description="Check back later for new services in this category."
            actionLabel="Browse All Services"
            onAction={() => window.location.href = '/services'}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service as any} />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between border-t pt-6">
                <div className="text-sm text-slate-600">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const prevPage = pagination.page - 1
                      window.history.pushState(null, '', `?page=${prevPage}`)
                      fetchServices()
                    }}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      const nextPage = pagination.page + 1
                      window.history.pushState(null, '', `?page=${nextPage}`)
                      fetchServices()
                    }}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

