'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Input } from '@/components/Input'
import { formatPrice } from '@/lib/currency'
import { getStatusBadgeVariant } from '@/lib/service-request-utils'

interface ServiceRequest {
  id: string
  referenceNumber: string
  title: string
  description: string | null
  status: string
  quotedPrice: number | null
  estimatedDuration: string | null
  preferredCompletionDate: string | null
  preferredBudget: number | null
  createdAt: string
  updatedAt: string
  service: {
    id: string
    title: string
    slug: string
    thumbnail: string | null
    startingPrice: number
    category: { id: string; name: string; slug: string }
  }
  customer: {
    id: string
    email: string
    profile: { firstName: string | null; lastName: string | null }
  }
  vendor: {
    id: string
    email: string
    profile: { firstName: string | null; lastName: string | null }
  }
  store: {
    id: string
    name: string
    slug: string
    isVerified: boolean
  }
  quotations: Array<{
    id: string
    quotedPrice: number
    estimatedDuration: string | null
    notes: string | null
    validUntil: string
    status: string
    vendorId: string
    vendor: {
      id: string
      profile: { firstName: string | null; lastName: string | null }
    }
  }>
}

export default function SuperAdminServiceRequestsPageClient() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter) params.set('status', statusFilter)
      if (vendorFilter) params.set('vendorId', vendorFilter)
      if (customerFilter) params.set('customerId', customerFilter)
      if (categoryFilter) params.set('categoryId', categoryFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/service-requests?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
        setTotalPages(data.pagination.totalPages || 1)
      } else {
        setError('Failed to load service requests')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, vendorFilter, customerFilter, categoryFilter, startDate, endDate, search])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const statusLabels: Record<string, string> = {
    PENDING: 'Pending',
    UNDER_REVIEW: 'Under Review',
    QUOTED: 'Quoted',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  }

  const resetFilters = () => {
    setStatusFilter('')
    setVendorFilter('')
    setCustomerFilter('')
    setCategoryFilter('')
    setStartDate('')
    setEndDate('')
    setSearch('')
    setPage(1)
  }

  if (loading && requests.length === 0) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Service Requests</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-royal-blue"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="QUOTED">Quoted</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DECLINED">Declined</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendor ID</label>
              <Input
                value={vendorFilter}
                onChange={(e) => { setVendorFilter(e.target.value); setPage(1) }}
                placeholder="Filter by vendor ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer ID</label>
              <Input
                value={customerFilter}
                onChange={(e) => { setCustomerFilter(e.target.value); setPage(1) }}
                placeholder="Filter by customer ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <Input
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                placeholder="Filter by category ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by title, description, or reference number"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState
          title="No service requests found"
          description="Try adjusting your filters or check back later."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{req.title}</h3>
                      <Badge variant={getStatusBadgeVariant(req.status) as any} size="sm">
                        {statusLabels[req.status] || req.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 mb-1">Ref: {req.referenceNumber}</p>
                    <p className="text-sm text-slate-500 mb-2 line-clamp-2">
                      {req.description || 'No description provided'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Customer: {req.customer.profile?.firstName} {req.customer.profile?.lastName}</span>
                      <span>Vendor: {req.vendor.profile?.firstName} {req.vendor.profile?.lastName}</span>
                      <span>Service: {req.service.title}</span>
                      <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {req.quotedPrice && (
                      <p className="text-lg font-semibold text-royal-blue">
                        {formatPrice(req.quotedPrice)}
                      </p>
                    )}
                    {req.preferredBudget && (
                      <p className="text-xs text-slate-400 mt-1">
                        Budget: {formatPrice(req.preferredBudget)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/super-admin/service-requests/${req.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <Skeleton className="h-4 w-1/4 mb-3" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}
