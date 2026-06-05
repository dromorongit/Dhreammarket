'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { formatPrice } from '@/lib/currency'
import Link from 'next/link'

interface VerificationDocument {
  id: string
  documentType: string
  documentUrl: string
  fileName: string
}

interface VerificationKYC {
  businessName: string
  businessType: string
  businessRegistrationNumber?: string
  tinNumber?: string
  fullName: string
  phoneNumber: string
  email: string
}

interface VerificationApplication {
  id: string
  store: {
    name: string
  }
  vendor: {
    email: string
    profile?: {
      firstName?: string
      lastName?: string
    }
  }
  status: string
  paymentStatus?: string
  paymentAmount?: number
  kycInfo?: VerificationKYC
  documents?: VerificationDocument[]
  createdAt: string
}

const statusColors: Record<string, string> = {
  NOT_APPLIED: 'bg-slate-100 text-slate-800',
  PAYMENT_PENDING: 'bg-yellow-100 text-yellow-800',
  PAYMENT_COMPLETED: 'bg-blue-100 text-blue-800',
  KYC_SUBMITTED: 'bg-purple-100 text-purple-800',
  UNDER_REVIEW: 'bg-indigo-100 text-indigo-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function AdminVerificationApplicationsPage() {
  const [applications, setApplications] = useState<VerificationApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({ status: '', search: '' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedApp, setSelectedApp] = useState<VerificationApplication | null>(null)

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/admin/verification?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to load applications')
        return
      }

      setApplications(data.applications || [])
    } catch (err) {
      setError('Failed to fetch applications')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.search])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const handleAction = async (applicationId: string, action: 'approve' | 'reject' | 'request_changes') => {
    if (actionLoading) return

    const confirmMessage = action === 'approve' 
      ? 'Are you sure you want to approve this vendor?' 
      : action === 'reject'
      ? 'Are you sure you want to reject this vendor? They can resubmit if allowed.'
      : 'Request changes to this application?'

    if (!confirm(confirmMessage)) return

    try {
      setActionLoading(applicationId)
      const response = await fetch(`/api/admin/verification?applicationId=${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to update application')
        return
      }

      fetchApplications()
    } catch (err) {
      alert('Failed to update application')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button onClick={fetchApplications} className="mt-2 text-sm text-red-600 hover:underline">
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/super-admin" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Verification Applications</h1>
            <p className="text-gray-600 mt-1">Review and manage vendor verification requests</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={(e) => { e.preventDefault(); fetchApplications(); }} className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by store name or email..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="NOT_APPLIED">Not Applied</option>
                <option value="PAYMENT_PENDING">Payment Pending</option>
                <option value="PAYMENT_COMPLETED">Payment Completed</option>
                <option value="KYC_SUBMITTED">KYC Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                Search
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Applications Table */}
        <Card>
          <CardHeader className="border-b">
            <h2 className="text-lg font-semibold">Application List</h2>
          </CardHeader>
          {loading ? (
            <CardContent className="p-8 text-center">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          ) : applications.length === 0 ? (
            <CardContent className="p-12 text-center">
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 0l3-3m-3 3l3 3M3 8a4 4 0 014-4 4v0a4 4 0 01-4 4H7a4 4 0 01-4-4V8a4 4 0 014-4z" />
                  </svg>
                }
                title="No applications found"
                description="Verification applications will appear here when vendors apply."
              />
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-505 uppercase">Submitted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{app.store?.name}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">
                          {app.vendor.profile?.firstName && app.vendor.profile?.lastName
                            ? `${app.vendor.profile.firstName} ${app.vendor.profile.lastName}`
                            : app.vendor.email}
                        </div>
                        <div className="text-xs text-gray-500">{app.vendor.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{app.paymentAmount ? formatPrice(app.paymentAmount) : '-'}</div>
                        <div className="text-xs text-gray-500">{app.paymentStatus || '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={statusColors[app.status] || 'bg-gray-100 text-gray-800'}>
                          {app.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        {actionLoading === app.id ? (
                          <span className="text-sm text-gray-500">Processing...</span>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setSelectedApp(app)}
                              className="text-sm text-blue-600 hover:text-blue-800 min-h-[44px]"
                              title="View Details"
                            >
                              View
                            </button>
                            {(app.status === 'KYC_SUBMITTED' || app.status === 'UNDER_REVIEW') && (
                              <>
                                <button
                                  onClick={() => handleAction(app.id, 'approve')}
                                  className="text-sm text-green-600 hover:text-green-800 min-h-[44px]"
                                  title="Approve"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(app.id, 'reject')}
                                  className="text-sm text-red-600 hover:text-red-800 min-h-[44px]"
                                  title="Reject"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleAction(app.id, 'request_changes')}
                                  className="text-sm text-amber-600 hover:text-amber-800 min-h-[44px]"
                                  title="Request Changes"
                                >
                                  Changes
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Details Modal */}
        {selectedApp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Application Details</h3>
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-700">Store Information</h4>
                    <p className="text-sm text-gray-600">{selectedApp.store?.name}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-700">Vendor Contact</h4>
                    <p className="text-sm text-gray-600">{selectedApp.vendor.email}</p>
                  </div>

                  {selectedApp.kycInfo && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">KYC Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Business Name</p>
                          <p>{selectedApp.kycInfo.businessName}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Business Type</p>
                          <p>{selectedApp.kycInfo.businessType}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Registration No.</p>
                          <p>{selectedApp.kycInfo.businessRegistrationNumber || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">TIN Number</p>
                          <p>{selectedApp.kycInfo.tinNumber || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Full Name</p>
                          <p>{selectedApp.kycInfo.fullName}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Phone Number</p>
                          <p>{selectedApp.kycInfo.phoneNumber}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Email</p>
                          <p>{selectedApp.kycInfo.email}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedApp.documents && selectedApp.documents.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Submitted Documents</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedApp.documents.map((doc) => (
                          <div key={doc.id} className="border border-gray-200 rounded p-2">
                            <p className="text-xs font-medium">{doc.documentType}</p>
                            <a
                              href={doc.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}