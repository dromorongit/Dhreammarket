'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'

interface Supplier {
  id: string
  companyName: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  country: string | null
  notes: string | null
  status: string
  createdAt: string
  performance?: {
    totalOrders: number
    completedOrders: number
    cancelledOrders: number
    lateDeliveries: number
    averageLeadTime: number | null
    onTimePercentage: number | null
    reliabilityScore: number | null
  }
}

const SUPPLIER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
  INACTIVE: { label: 'Inactive', color: 'bg-slate-100 text-slate-800' },
  DISABLED: { label: 'Disabled', color: 'bg-red-100 text-red-800' },
}

export default function VendorSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    notes: '',
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vendor/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      } else {
        setError('Failed to fetch suppliers')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSupplier = async () => {
    if (!formData.companyName) {
      alert('Company name is required')
      return
    }

    try {
      const response = await fetch('/api/vendor/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setFormData({
          companyName: '',
          contactPerson: '',
          email: '',
          phone: '',
          address: '',
          country: '',
          notes: '',
        })
        await fetchSuppliers()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create supplier')
      }
    } catch (err) {
      alert('Failed to create supplier')
    }
  }

  const handleDisableSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to disable this supplier?')) return

    try {
      const response = await fetch(`/api/vendor/suppliers/${supplierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      })

      if (response.ok) {
        await fetchSuppliers()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to disable supplier')
      }
    } catch (err) {
      alert('Failed to disable supplier')
    }
  }

  if (loading && suppliers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/dashboard/vendor"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
              <p className="text-gray-600 mt-1">Manage your suppliers and procurement partners</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              + Add Supplier
            </Button>
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg mx-4">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Add New Supplier</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Company Name *</label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                      placeholder="Enter company name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                      placeholder="Enter contact person name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                        placeholder="+233..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Address</label>
                    <textarea
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                      placeholder="Enter address"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={e => setFormData({ ...formData, country: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                      placeholder="Enter country"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                      placeholder="Additional notes"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSupplier} className="flex-1">
                    Add Supplier
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {suppliers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 5h6m5 5l-3-3-3 3" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers added</h3>
              <p className="text-gray-600 mb-4">Add suppliers to manage your procurement process.</p>
              <Button onClick={() => setShowCreateModal(true)}>Add Your First Supplier</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {suppliers.map((supplier) => {
              const statusConfig = SUPPLIER_STATUS_CONFIG[supplier.status] || SUPPLIER_STATUS_CONFIG.ACTIVE

              return (
                <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{supplier.companyName}</h3>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {supplier.status !== 'DISABLED' && (
                          <button
                            onClick={() => handleDisableSupplier(supplier.id)}
                            className="p-1 text-red-600 hover:text-red-700"
                            title="Disable supplier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {supplier.contactPerson && (
                      <p className="text-sm text-gray-600 mb-1">{supplier.contactPerson}</p>
                    )}
                    {supplier.email && (
                      <p className="text-sm text-gray-600 mb-1">{supplier.email}</p>
                    )}
                    {supplier.phone && (
                      <p className="text-sm text-gray-600 mb-1">{supplier.phone}</p>
                    )}
                    {supplier.address && (
                      <p className="text-sm text-gray-500 mt-2">{supplier.address}</p>
                    )}

                    {supplier.performance && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-500">Total Orders</p>
                            <p className="font-medium">{supplier.performance.totalOrders}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Completed</p>
                            <p className="font-medium">{supplier.performance.completedOrders}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">On-Time %</p>
                            <p className="font-medium">{supplier.performance.onTimePercentage || 0}%</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Avg Lead Time</p>
                            <p className="font-medium">{supplier.performance.averageLeadTime ? `${supplier.performance.averageLeadTime}d` : 'N/A'}</p>
                          </div>
                        </div>
                        {supplier.performance.reliabilityScore !== null && (
                          <div className="mt-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Reliability Score</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-emerald-600 h-2 rounded-full"
                                  style={{ width: `${Math.min(supplier.performance.reliabilityScore, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{supplier.performance.reliabilityScore}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}