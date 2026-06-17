'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatPrice } from '@/lib/currency'
import { getVendorBadgeInfo, BADGE_TIERS } from '@/lib/vendor-badge'
import { EmptyState } from '@/components/EmptyState'
import Link from 'next/link'

interface Vendor {
  id: string
  name: string
  description: string | null
  isVerified: boolean
  isFeatured: boolean
  badgeTier: string | null
  featuredUntil: string | null
  createdAt: string
  mobileNumber: string | null
  user: {
    id: string
    email: string
    role: string
    createdAt: string
  }
  _count: {
    products: number
  }
  grossRevenue?: number
  totalPayouts?: number
  outstandingBalance?: number
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ verified: '', search: '' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [badgeActionLoading, setBadgeActionLoading] = useState<string | null>(null)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)

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
    fetchUserRole()
  }, [fetchVendors])

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUserRole(data.user?.role || null)
      }
    } catch (e) {
      console.error('Failed to fetch user role:', e)
    }
  }

  const isSuperAdmin = userRole === 'SUPER_ADMIN'

  const handleBadgeAction = async (vendorId: string, badgeTier: string | null) => {
    if (!isSuperAdmin) {
      alert('Only SUPER_ADMIN can manage vendor badges')
      return
    }

    const tier = BADGE_TIERS.find(t => t.value === badgeTier)
    const confirmMessage = badgeTier
      ? `Assign ${tier?.label} badge to this vendor?`
      : 'Remove badge from this vendor?'

    if (!confirm(confirmMessage)) return

    try {
      setBadgeActionLoading(vendorId)
      const response = await fetch(`/api/admin/vendors/${vendorId}/badge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: badgeTier ? 'assign_badge' : 'remove_badge',
          badgeTier,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to update vendor badge')
        return
      }

      // Update vendors list
      setVendors(prev => prev.map(v =>
        v.id === vendorId ? { ...v, badgeTier } : v
      ))
    } catch (err) {
      console.error(err)
      alert('Failed to update vendor badge')
    } finally {
      setBadgeActionLoading(null)
    }
  }

  const handleVerify = async (vendorId: string, verify: boolean, badgeTier?: string | null) => {
    if (actionLoading) return
    
    if (verify && badgeTier === undefined && isSuperAdmin) {
      setSelectedVendorId(vendorId)
      setShowVerifyModal(true)
      return
    }
    
    const action = verify ? 'verify' : 'revoke'
    
    try {
      setActionLoading(vendorId)
      const body: any = { action, value: verify }
      if (badgeTier) body.badgeTier = badgeTier
      
      const response = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to update vendor')
        return
      }
      
      fetchVendors()
    } catch (err) {
      alert('Failed to update vendor')
      console.error(err)
    } finally {
      setActionLoading(null)
      setShowVerifyModal(false)
      setSelectedVendorId(null)
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
      handleFeature(vendorId, false, 0)
      return
    }
    
    const duration = prompt('Enter feature duration in days (e.g., 7, 30):', '7')
    if (duration === null) return
    
    const days = parseInt(duration)
    if (isNaN(days) || days <= 0) {
      alert('Please enter a valid number of days')
      return
    }
    
    handleFeature(vendorId, true, days)
  }

  const handleDeleteVendor = async (vendorId: string, vendorName: string) => {
    if (actionLoading) return

    if (!confirm(`Are you sure you want to delete vendor "${vendorName}"? This will permanently delete the vendor account and all associated data. This action cannot be undone.`)) {
      return
    }

    try {
      setActionLoading(vendorId)
      const response = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to delete vendor')
        return
      }

      fetchVendors()
    } catch (err) {
      alert('Failed to delete vendor')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                Search
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Vendors Table - Responsive */}
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
              {/* Mobile Card View */}
              <div className="block md:hidden">
                <div className="divide-y divide-gray-200">
                  {vendors.map((vendor) => (
                    <div key={vendor.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{vendor.name}</p>
                          <p className="text-sm text-gray-500">{vendor.user.email}</p>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${vendor.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {vendor.isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Phone:</span>
                        <span className="text-gray-900">{vendor.mobileNumber || '-'}</span>
                      </div>
<div className="flex justify-between text-sm">
                         <span className="text-gray-500">Products:</span>
                         <span className="text-gray-900">{vendor._count.products}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span className="text-gray-500">Gross Revenue:</span>
                         <span className="text-sm font-medium text-emerald-600">{formatPrice(vendor.grossRevenue || 0)}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span className="text-gray-500">Payouts:</span>
                         <span className="text-gray-900">{formatPrice(vendor.totalPayouts || 0)}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span className="text-gray-500">Balance:</span>
                         <span className={`text-sm font-medium ${(vendor.outstandingBalance || 0) > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                           {formatPrice(vendor.outstandingBalance || 0)}
                         </span>
                       </div>
<div className="flex flex-wrap gap-2 pt-2">
                        {vendor.isVerified ? (
                          <button
                            onClick={() => handleVerify(vendor.id, false)}
                            className="px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 min-h-[44px]"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerify(vendor.id, true)}
                            className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 min-h-[44px]"
                          >
                            Verify
                          </button>
                        )}
                        <button
                          onClick={() => handleDisable(vendor.id)}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 min-h-[44px]"
                        >
                          Disable
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
<thead className="bg-gray-50 border-b">
                     <tr>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Revenue</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payouts</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verification</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Badge</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Featured</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-505 uppercase">Actions</th>
                     </tr>
                   </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50">
<td className="px-4 py-4">
                           <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                           {vendor.description && (
                             <div className="text-sm text-gray-500 truncate max-w-xs">
                               {vendor.description}
                             </div>
                           )}
                         </td>
                         <td className="px-4 py-4">
                           <div className="text-sm text-gray-900">{vendor.user.email}</div>
                         </td>
                         <td className="px-4 py-4">
                           <span className="text-sm text-gray-600">{vendor.mobileNumber || '-'}</span>
                         </td>
                         <td className="px-4 py-4">
                           <span className="text-sm text-gray-600">{vendor._count.products}</span>
                         </td>
                         <td className="px-4 py-4">
                           <span className="text-sm font-medium text-emerald-600">{formatPrice(vendor.grossRevenue || 0)}</span>
                         </td>
                         <td className="px-4 py-4">
                           <span className="text-sm text-gray-600">{formatPrice(vendor.totalPayouts || 0)}</span>
                         </td>
                         <td className="px-4 py-4">
                           <span className={`text-sm font-medium ${(vendor.outstandingBalance || 0) > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                             {formatPrice(vendor.outstandingBalance || 0)}
                           </span>
                         </td>
<td className="px-4 py-4">
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
                          <td className="px-4 py-4">
                            {vendor.badgeTier ? (
                              <Badge variant={getVendorBadgeInfo(vendor.badgeTier as any)?.variant || 'default'} size="sm">
                                {getVendorBadgeInfo(vendor.badgeTier as any)?.displayLabel || 'Unknown'}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                           {vendor.isFeatured ? (
                             <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                               Featured
                             </span>
                           ) : (
                             <span className="text-sm text-gray-400">-</span>
                           )}
                         </td>
                         <td className="px-4 py-4 text-sm text-gray-500">
                           {new Date(vendor.createdAt).toLocaleDateString()}
                         </td>
                        <td className="px-4 py-4">
                          {actionLoading === vendor.id ? (
                            <span className="text-sm text-gray-500">Processing...</span>
                          ) : (
                            <div className="flex gap-2 flex-wrap">
                              {vendor.isVerified ? (
                                <button
                                  onClick={() => handleVerify(vendor.id, false)}
                                  className="text-sm text-yellow-600 hover:text-yellow-800 min-h-[44px]"
                                  title="Revoke verification"
                                >
                                  Revoke
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleVerify(vendor.id, true)}
                                  className="text-sm text-green-600 hover:text-green-800 min-h-[44px]"
                                  title="Verify vendor"
                                >
                                  Verify
                                </button>
                              )}
                              <button
                                onClick={() => handleDisable(vendor.id)}
                                className="text-sm text-red-600 hover:text-red-800 min-h-[44px]"
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
<button
                                 onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                                 className="text-sm text-red-600 hover:text-red-800 min-h-[44px]"
                                 title="Delete vendor"
                               >
                                 Delete
                               </button>
                               {isSuperAdmin && (
                                 <>
                                   {BADGE_TIERS.map((tier) => (
                                     <button
                                       key={tier.value}
                                       onClick={() => handleBadgeAction(vendor.id, tier.value)}
                                       disabled={badgeActionLoading === vendor.id}
                                       className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                         vendor.badgeTier === tier.value
                                           ? 'bg-slate-200 border-slate-300 text-slate-700 cursor-default'
                                           : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                                       }`}
                                       title={`Assign ${tier.label} badge`}
                                     >
                                       {tier.label.split(' ')[0]}
                                     </button>
                                   ))}
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

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
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
        </Card>

        {/* Verify Modal with Badge Selection (SUPER_ADMIN only) */}
        {showVerifyModal && selectedVendorId && isSuperAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Badge Tier (Optional)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose a badge tier to assign when verifying this vendor. You can also verify without assigning a badge.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleVerify(selectedVendorId, true, null)}
                  disabled={actionLoading === selectedVendorId}
                  className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Verify without badge
                </button>
                {BADGE_TIERS.map((tier) => (
                  <button
                    key={tier.value}
                    onClick={() => handleVerify(selectedVendorId, true, tier.value)}
                    disabled={actionLoading === selectedVendorId}
                    className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 flex flex-col items-start"
                  >
                    <span className="font-medium">{tier.label}</span>
                    <span className="text-xs text-gray-500">{tier.description}</span>
                  </button>
                ))}
                <button
                  onClick={() => { setShowVerifyModal(false); setSelectedVendorId(null) }}
                  className="w-full px-4 py-2 text-center text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}