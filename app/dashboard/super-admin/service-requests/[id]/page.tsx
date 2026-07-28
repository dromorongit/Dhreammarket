'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { getStatusBadgeVariant } from '@/lib/service-request-utils'

interface ServiceRequestDetail {
  id: string
  referenceNumber: string
  title: string
  description: string | null
  status: string
  quotedPrice: number | null
  estimatedDuration: string | null
  quotationNotes: string | null
  preferredCompletionDate: string | null
  preferredBudget: number | null
  acceptedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  service: {
    id: string
    title: string
    slug: string
    description: string | null
    shortDescription: string | null
    startingPrice: number
    pricingType: string
    deliveryType: string
    estimatedDeliveryTime: string | null
    requirementsFromCustomer: string | null
    thumbnail: string | null
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
    logo: string | null
  }
  attachments: Array<{
    id: string
    fileName: string
    fileUrl: string
    fileType: string
    fileSize: number
    uploadedBy: string
    createdAt: string
  }>
  statusHistory: Array<{
    id: string
    status: string
    notes: string | null
    createdAt: string
    changer: {
      id: string
      profile: { firstName: string | null; lastName: string | null }
    }
  }>
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
    acceptedAt: string | null
    rejectedAt: string | null
  }>
}

export default function SuperAdminServiceRequestDetailPage({ params }: { params: { id: string } }) {
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRequest()
  }, [])

  const fetchRequest = async () => {
    try {
      const res = await fetch(`/api/admin/service-requests/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setRequest(data.request)
      } else {
        setError('Failed to load request')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full mb-4" />
        </div>
      </main>
    )
  }

  if (error || !request) {
    return (
      <main className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-slate-500">{error || 'Request not found'}</p>
          <Link href="/dashboard/super-admin/service-requests" className="text-royal-blue hover:underline mt-4 inline-block">
            Back to requests
          </Link>
        </div>
      </main>
    )
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

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard/super-admin/service-requests" className="text-royal-blue hover:underline text-sm mb-4 inline-block">
          &larr; Back to requests
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{request.title}</h1>
            <p className="text-slate-500 mt-1">Reference: {request.referenceNumber}</p>
          </div>
          <Badge variant={getStatusBadgeVariant(request.status) as any} size="lg">
            {statusLabels[request.status] || request.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">Customer Details</h2>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="text-slate-500">Name:</span> {request.customer.profile?.firstName} {request.customer.profile?.lastName}</p>
              <p><span className="text-slate-500">Email:</span> {request.customer.email}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">Vendor Details</h2>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="text-slate-500">Name:</span> {request.vendor.profile?.firstName} {request.vendor.profile?.lastName}</p>
              <p><span className="text-slate-500">Email:</span> {request.vendor.email}</p>
              <p><span className="text-slate-500">Store:</span> {request.store.name}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Project Details</h2>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500">Service</span>
                <p className="font-medium">{request.service.title}</p>
              </div>
              <div>
                <span className="text-slate-500">Category</span>
                <p className="font-medium">{request.service.category.name}</p>
              </div>
              <div>
                <span className="text-slate-500">Preferred Budget</span>
                <p className="font-medium">{request.preferredBudget ? formatPrice(request.preferredBudget) : 'Not specified'}</p>
              </div>
              <div>
                <span className="text-slate-500">Preferred Date</span>
                <p className="font-medium">{request.preferredCompletionDate ? new Date(request.preferredCompletionDate).toLocaleDateString() : 'Not specified'}</p>
              </div>
            </div>
            <div>
              <span className="text-slate-500">Description</span>
              <p className="font-medium whitespace-pre-wrap">{request.description || 'No description'}</p>
            </div>
          </CardContent>
        </Card>

        {request.quotations.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">Quotations</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {request.quotations.map((q) => (
                <div key={q.id} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{formatPrice(q.quotedPrice)}</p>
                      <p className="text-sm text-slate-500">
                        Est. duration: {q.estimatedDuration || 'Not specified'}
                      </p>
                    </div>
                    <Badge variant={q.status === 'ACCEPTED' ? 'success' : q.status === 'REJECTED' ? 'danger' : 'info'} size="sm">
                      {q.status}
                    </Badge>
                  </div>
                  {q.notes && (
                    <p className="text-sm text-slate-600 mb-3">{q.notes}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    Valid until {new Date(q.validUntil).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Status History</h2>
          </CardHeader>
          <CardContent>
            {request.statusHistory.length === 0 ? (
              <p className="text-slate-500 text-sm">No status history.</p>
            ) : (
              <div className="space-y-3">
                {request.statusHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 text-sm">
                    <Badge variant={getStatusBadgeVariant(entry.status) as any} size="sm">
                      {statusLabels[entry.status] || entry.status}
                    </Badge>
                    <span className="text-slate-500">{new Date(entry.createdAt).toLocaleString()}</span>
                    <span className="text-slate-400">
                      by {entry.changer.profile?.firstName} {entry.changer.profile?.lastName}
                    </span>
                    {entry.notes && <span className="text-slate-600">- {entry.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
