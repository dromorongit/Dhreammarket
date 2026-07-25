'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'

interface VendorPayout {
  id: string
  vendorId: string
  storeId: string
  amount: number
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED'
  reference?: string
  note?: string
  paidAt?: string
  createdAt: string
  vendor: {
    id: string
    email: string
    profile?: {
      firstName?: string
      lastName?: string
    }
  }
  store: {
    id: string
    name: string
  }
}

interface Vendor {
  id: string
  email: string
  profile?: {
    firstName?: string
    lastName?: string
  }
  store?: {
    id: string
    name: string
  }
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<VendorPayout[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ status: '', vendorId: '' })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState('')
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutReference, setPayoutReference] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (filters.status) params.set('status', filters.status)
      if (filters.vendorId) params.set('vendorId', filters.vendorId)

      const response = await fetch(`/api/vendor/payouts?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to load payouts')
        return
      }
      
      setPayouts(data.payouts)
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (err) {
      setError('Failed to fetch payouts')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters.status, filters.vendorId])

  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/vendors')
      const data = await response.json()
      if (response.ok) {
        setVendors(data.vendors || [])
      }
    } catch (err) {
      console.error('Error fetching vendors:', err)
    }
  }, [])

  useEffect(() => {
    fetchPayouts()
    fetchVendors()
  }, [fetchPayouts, fetchVendors])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const handleCreatePayout = async () => {
    if (!selectedVendor || !payoutAmount) return

    const vendor = vendors.find(v => v.id === selectedVendor)
    if (!vendor?.store) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/vendor/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendor,
          storeId: vendor.store.id,
          amount: parseFloat(payoutAmount),
          reference: payoutReference,
          note: payoutNote,
        }),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setSelectedVendor('')
        setPayoutAmount('')
        setPayoutReference('')
        setPayoutNote('')
        fetchPayouts()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to create payout')
      }
    } catch (err) {
      console.error('Error creating payout:', err)
      alert('Failed to create payout')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (payoutId: string, status: string) => {
    try {
      const response = await fetch(`/api/vendor/payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        fetchPayouts()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update payout')
      }
    } catch (err) {
      console.error('Error updating payout:', err)
      alert('Failed to update payout')
    }
  }

  if (loading && payouts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SkeletonCard />
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
            title="Error Loading Payouts"
            description={error}
          >
            <Button onClick={fetchPayouts} variant="primary">
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Vendor Payouts</h1>
            <p className="text-slate-600 mt-1">Manage vendor payouts and track payment status</p>
          </div>
          <Button 
            variant="primary" 
            onClick={() => setShowCreateModal(true)}
            className="mt-4 sm:mt-0"
          >
            Create Payout
          </Button>
        </div>

        {/* Filters */}
        <Card variant="elevated" className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={filters.vendorId}
                onChange={(e) => setFilters(prev => ({ ...prev, vendorId: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
              >
                <option value="">All Vendors</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.profile?.firstName || vendor.email} ({vendor.store?.name || 'No Store'})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Payouts Table */}
        <Card variant="elevated">
          <CardContent className="p-0">
            {payouts.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6m5 4h6" />
                  </svg>
                }
                title="No Payouts Found"
                description="No payouts match your current filters."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vendor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="font-medium text-deep-navy">
                              {payout.vendor.profile?.firstName || payout.vendor.email}
                            </p>
                            <p className="text-sm text-slate-500">{payout.store.name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-deep-navy">{formatCurrency(payout.amount)}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStatusBadge(payout.status)}>
                            {payout.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          {formatDate(payout.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {payout.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(payout.id, 'PROCESSING')}
                              >
                                Process
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleUpdateStatus(payout.id, 'PAID')}
                              >
                                Mark Paid
                              </Button>
                            </div>
                          )}
                          {payout.status === 'PROCESSING' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleUpdateStatus(payout.id, 'PAID')}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Payout Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card variant="elevated" className="w-full max-w-md">
              <CardHeader>
                <h2 className="text-xl font-bold text-deep-navy">Create New Payout</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                  <select
                    value={selectedVendor}
                    onChange={(e) => setSelectedVendor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                  >
                    <option value="">Select a vendor</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.profile?.firstName || vendor.email} - {vendor.store?.name || 'No Store'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reference (Optional)</label>
                  <input
                    type="text"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    placeholder="Payment reference or note"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Note (Optional)</label>
                  <textarea
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    placeholder="Additional notes"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCreatePayout}
                    disabled={submitting || !selectedVendor || !payoutAmount}
                    className="flex-1"
                  >
                    {submitting ? 'Creating...' : 'Create Payout'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}