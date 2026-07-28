'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { formatPrice } from '@/lib/currency'
import { getStatusBadgeVariant } from '@/lib/service-request-utils'

interface ServiceRequest {
  id: string
  title: string
  description: string | null
  status: string
  quotedPrice: number | null
  estimatedDuration: string | null
  preferredCompletionDate: string | null
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    profile: { firstName: string | null; lastName: string | null }
  }
  service: {
    id: string
    title: string
    slug: string
    thumbnail: string | null
    startingPrice: number
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
  }>
}

export default function VendorServiceRequestsList() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchRequests()
  }, [statusFilter, search])

  const fetchRequests = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/service-requests?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
      }
    } catch (err) {
      console.error('Error fetching requests:', err)
    } finally {
      setLoading(false)
    }
  }

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

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200">
            <Skeleton className="h-4 w-1/4 mb-3" />
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search requests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-royal-blue"
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

      {requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-slate-500">No service requests found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Link key={req.id} href={`/dashboard/vendor/service-requests/${req.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 truncate">{req.title}</h3>
                        <Badge variant={getStatusBadgeVariant(req.status) as any} size="sm">
                          {statusLabels[req.status] || req.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500 mb-2 line-clamp-2">
                        {req.description || 'No description provided'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>From: {req.customer.profile?.firstName} {req.customer.profile?.lastName}</span>
                        <span>{req.service.title}</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {req.quotedPrice && (
                        <p className="text-lg font-semibold text-royal-blue">
                          {formatPrice(req.quotedPrice)}
                        </p>
                      )}
                      {req.quotations.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1">
                          {req.quotations.length} quotation(s)
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className || ''}`} />
}