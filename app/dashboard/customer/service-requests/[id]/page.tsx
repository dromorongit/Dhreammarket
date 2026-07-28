'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { ServiceRequestTimeline } from '@/components/ServiceRequestTimeline'
import { formatPrice } from '@/lib/currency'
import { getStatusBadgeVariant } from '@/lib/service-request-utils'

interface ServiceRequestDetail {
  id: string
  title: string
  description: string | null
  status: string
  quotedPrice: number | null
  estimatedDuration: string | null
  quotationNotes: string | null
  preferredCompletionDate: string | null
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

export default function CustomerServiceRequestDetail({ params }: { params: { id: string } }) {
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'attachments'>('details')

  useEffect(() => {
    fetchRequest()
  }, [])

  const fetchRequest = async () => {
    try {
      const res = await fetch(`/api/service-requests/${params.id}`)
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

  const handleAcceptQuote = async (quotationId: string) => {
    try {
      const res = await fetch(`/api/service-requests/${params.id}/accept-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId }),
      })

      if (res.ok) {
        fetchRequest()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to accept quotation')
      }
    } catch (err) {
      setError('An error occurred')
    }
  }

  const handleRejectQuote = async (quotationId: string) => {
    if (!confirm('Are you sure you want to reject this quotation?')) return

    try {
      const res = await fetch(`/api/service-requests/${params.id}/reject-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId }),
      })

      if (res.ok) {
        fetchRequest()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to reject quotation')
      }
    } catch (err) {
      setError('An error occurred')
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this request?')) return

    try {
      const res = await fetch(`/api/service-requests/${params.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', notes: 'Customer cancelled the request' }),
      })

      if (res.ok) {
        fetchRequest()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to cancel request')
      }
    } catch (err) {
      setError('An error occurred')
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
          <Link href="/dashboard/customer/service-requests" className="text-royal-blue hover:underline mt-4 inline-block">
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
        <Link href="/dashboard/customer/service-requests" className="text-royal-blue hover:underline text-sm mb-4 inline-block">
          &larr; Back to requests
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{request.title}</h1>
            <p className="text-slate-500 mt-1">Service: {request.service.title}</p>
          </div>
          <Badge variant={getStatusBadgeVariant(request.status) as any} size="lg">
            {statusLabels[request.status] || request.status}
          </Badge>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {(['details', 'timeline', 'attachments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-royal-blue text-royal-blue'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'details' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Project Description</h2>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-wrap">{request.description || 'No description provided.'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Service Details</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Category</span>
                    <p className="font-medium">{request.service.category.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Vendor</span>
                    <p className="font-medium">{request.store.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Service Price</span>
                    <p className="font-medium">{formatPrice(request.service.startingPrice)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Delivery Type</span>
                    <p className="font-medium">{request.service.deliveryType}</p>
                  </div>
                  {request.service.estimatedDeliveryTime && (
                    <div>
                      <span className="text-slate-500">Est. Delivery</span>
                      <p className="font-medium">{request.service.estimatedDeliveryTime}</p>
                    </div>
                  )}
                  {request.preferredCompletionDate && (
                    <div>
                      <span className="text-slate-500">Preferred Date</span>
                      <p className="font-medium">{new Date(request.preferredCompletionDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {request.quotations.length > 0 && (
              <Card>
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
                      {request.status === 'QUOTED' && q.status === 'PENDING' && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleAcceptQuote(q.id)}
                          >
                            Accept Quotation
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRejectQuote(q.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {request.status === 'QUOTED' && (
              <div className="flex gap-4">
                <Button variant="danger" onClick={handleCancel}>
                  Cancel Request
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <Card>
            <CardContent className="p-6">
              <ServiceRequestTimeline history={request.statusHistory} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'attachments' && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">Attachments</h2>
            </CardHeader>
            <CardContent>
              {request.attachments.length === 0 ? (
                <p className="text-slate-500">No attachments uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {request.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-700">{att.fileName}</span>
                        <span className="text-xs text-slate-400">
                          ({(att.fileSize / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-royal-blue hover:underline text-sm"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className || ''}`} />
}