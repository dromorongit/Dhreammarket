'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import Link from 'next/link'

interface Vendor {
  id: string
  name: string
  description: string | null
  isVerified: boolean
  isFeatured: boolean
  featuredUntil: string | null
  createdAt: string
  user: {
    id: string
    email: string
    role: string
    createdAt: string
  }
  _count: {
    products: number
  }
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ verified: '', search: '' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (filters.verified) params.set('verified', filters.verified)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/admin/vendors?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to load vendors')
        return
      }
      
      setVendors(data.vendors)
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (err) {
      setError('Failed to fetch vendors')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters.verified, filters.search])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  const handleVerify = async (vendorId: string, verify: boolean) => {
    if (actionLoading) return
    
    try {
      setActionLoading(vendorId)
      const response = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: verify ? 'verify' : 'verify', value: verify }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to update vendor')
        return
      }
      
      // Refresh the list
      fetchVendors()
    } catch (err) {
      alert('Failed to update vendor')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisable = async (vendorId: string) => {
    if (!confirm('Are you sure you want to disable this vendor? Their store will be unverified and they will lose vendor privileges.')) {
      return
    }
    
    if (actionLoading) return
    
    try {
      setActionLoading(vendorId)
      const response = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to disable vendor')
        return
      }
      
      // Refresh the list
      fetchVendors()
    } catch (err) {
      alert('Failed to disable vendor')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleEnable = async (vendorId: string) => {
    if (!confirm('Are you sure you want to re-enable this vendor?')) {
      return
    }
    
    if (actionLoading) return
    
    try {
      setActionLoading(vendorId)
      const response = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to enable vendor')
        return
      }
      
      // Refresh the list
      fetchVendors()
    } catch (err) {
      alert('Failed to enable vendor')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleFeature = async (vendorId: string, feature: boolean, duration: number) => {
    if (actionLoading) return
    
    const action = feature ? 'Feature vendor' : 'Remove from featured'
    if (!confirm(`Are you sure you want to ${action.toLowerCase()}?`)) {
      return
    }
    
    try {
      setActionLoading(vendorId)
      const response = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feature', value: feature, duration }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to update vendor feature status')
        return
      }
      
      // Refresh the list
      fetchVendors()
    } catch (err) {
      alert('Failed to update vendor feature status')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleFeatureWithDuration = (vendorId: string, feature: boolean) => {
    if (!feature) {
      // If unfeaturing, no duration needed
      handleFeature(vendorId, false, 0)
      return
    }
    
    // Show prompt for duration
    const duration = prompt('Enter feature duration in days (e.g., 7, 30):', '7')
    if (duration === null) return
    
    const days = parseInt(duration)
    if (isNaN(days) || days <= 0) {
      alert('Please enter a valid number of days')
      return
    }
    
    handleFeature(vendorId, true, days)
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
            <button onClick={fetchVendors} className="mt-2 text-sm text-red-600 hover:underline">
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
          <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
            <p className="text-gray-600 mt-1">Verify and manage vendor stores</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={(e) => { e.preventDefault(); setPagination(prev => ({ ...prev, page: 1 })); fetchVendors(); }} className="flex flex-wrap gap-4">
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
                value={filters.verified}
                onChange={(e) => setFilters(prev => ({ ...prev, verified: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Vendors</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Vendors Table */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Vendor List</h2>
              <span className="text-sm text-gray-600">{pagination.total} vendors</span>
            </div>
          </CardHeader>
          {loading ? (
            <CardContent className="p-8 text-center">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          ) : vendors.length === 0 ? (
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No vendors yet</h3>
              <p className="text-gray-500">Vendors will appear here when they register their stores.</p>
            </CardContent>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verification</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Featured</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                          {vendor.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {vendor.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{vendor.user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{vendor._count.products}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {vendor.isVerified ? (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {vendor.isFeatured ? (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              Featured
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(vendor.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {actionLoading === vendor.id ? (
                              <span className="text-sm text-gray-500">Processing...</span>
                            ) : (
                              <>
                                {vendor.isVerified ? (
                                  <button
                                    onClick={() => handleVerify(vendor.id, false)}
                                    className="text-sm text-yellow-600 hover:text-yellow-800"
                                    title="Revoke verification"
                                  >
                                    Revoke
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleVerify(vendor.id, true)}
                                    className="text-sm text-green-600 hover:text-green-800"
                                    title="Verify vendor"
                                  >
                                    Verify
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDisable(vendor.id)}
                                  className="text-sm text-red-600 hover:text-red-800"
                                  title="Disable vendor"
                                >
                                  Disable
                                </button>
                                <button
                                  onClick={() => handleFeatureWithDuration(vendor.id, !vendor.isFeatured)}
                                  className={`text-sm ${vendor.isFeatured ? 'text-purple-600 hover:text-purple-800' : 'text-blue-600 hover:text-blue-800'}`}
                                  title={vendor.isFeatured ? 'Remove from featured' : 'Feature vendor with custom duration'}
                                >
                                  {vendor.isFeatured ? 'Unfeature' : 'Feature'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}