'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import Link from 'next/link'

interface Campaign {
  id: string
  title: string
  campaignType: string
  campaignStatus: string
  paymentStatus: string
  price: number
  duration: number
  vendorId: string
  vendor?: { id: string; email: string; profile?: { firstName: string | null; lastName: string | null } }
  product?: { id: string; name: string; slug: string; price: number } | null
  service?: { id: string; title: string; slug: string; startingPrice: number } | null
  views: number
  clicks: number
  ordersGenerated: number
  revenueGenerated: number
  startDate: string | null
  endDate: string | null
  payments: Array<{ id: string; amount: number; status: string; paystackRef: string | null; createdAt: string }>
  invoice?: { id: string; invoiceNumber: string; amount: number; status: string; periodStart: string; periodEnd: string } | null
  analytics: Array<{ id: string; date: string; views: number; clicks: number; ctr: number; revenueGenerated: number; roi: number }>
  history: Array<{ id: string; action: string; performedBy: string; performedByRole: string; details: any; createdAt: string }>
}

const campaignTypeLabels: Record<string, string> = {
  SPONSORED_PRODUCT: 'Sponsored Product',
  SPONSORED_SERVICE: 'Sponsored Service',
  TRENDING_NOW_BOOST: 'Trending Now Boost',
  TRENDING_SERVICE_BOOST: 'Trending Service Boost',
  FEATURED_PRODUCT_PLACEMENT: 'Featured Product Placement',
  FEATURED_SERVICE_PLACEMENT: 'Featured Service Placement',
  SEARCH_RESULT_BOOST: 'Search Result Boost',
  CATEGORY_BOOST: 'Category Boost',
  VENDOR_SPOTLIGHT: 'Vendor Spotlight',
}

const statusColors: Record<string, string> = {
  ACTIVE: 'success',
  PENDING_PAYMENT: 'secondary',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'default',
  REJECTED: 'destructive',
  EXPIRED: 'outline',
  CANCELLED: 'outline',
  SUSPENDED: 'destructive',
}

const homepageSections = [
  { slug: 'Sponsored', label: 'Sponsored' },
  { slug: 'Trending Now', label: 'Trending Now' },
  { slug: 'Trending Services', label: 'Trending Services' },
  { slug: 'Featured Products', label: 'Featured Products' },
  { slug: 'Featured Services', label: 'Featured Services' },
  { slug: 'Flash Sales', label: 'Flash Sales' },
  { slug: 'Big Top Deals', label: 'Big Top Deals' },
  { slug: 'Gadget Display', label: 'Gadget Display' },
]

export default function SuperAdminAdvertisingClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortField, setSortField] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [vendors, setVendors] = useState<Array<{ id: string; email: string; profile?: { firstName: string | null; lastName: string | null }; store?: { name: string } }>>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([])
  const [services, setServices] = useState<Array<{ id: string; title: string; startingPrice: number }>>([])
  const [loadingLookups, setLoadingLookups] = useState(false)
  const [lookupsError, setLookupsError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    vendorId: '',
    title: '',
    campaignType: 'SPONSORED_PRODUCT',
    selectedProductId: '',
    selectedServiceId: '',
    homepageSection: 'Sponsored',
    duration: 7,
    price: 100,
    maxSlots: 1,
    campaignStatus: 'PENDING_APPROVAL',
    startDate: '',
    endDate: '',
  })
  const [createLoading, setCreateLoading] = useState(false)

  const loadLookups = async () => {
    setLoadingLookups(true)
    setLookupsError(null)
    try {
      const [vendorsRes, productsRes, servicesRes] = await Promise.all([
        fetch('/api/super-admin/advertising/vendors?limit=100'),
        fetch('/api/products?limit=100'),
        fetch('/api/vendor/services?limit=100'),
      ])
      if (vendorsRes.ok) {
        const data = await vendorsRes.json()
        setVendors(Array.isArray(data?.vendors) ? data.vendors : [])
      }
      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(Array.isArray(data?.products) ? data.products : [])
      }
      if (servicesRes.ok) {
        const data = await servicesRes.json()
        setServices(Array.isArray(data?.services) ? data.services : [])
      }
    } catch (err) {
      setLookupsError(err instanceof Error ? err.message : 'Failed to load form data')
    } finally {
      setLoadingLookups(false)
    }
  }

  const handleOpenCreate = () => {
    setShowCreateModal(true)
    loadLookups()
  }

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', '1')
      params.set('limit', '50')

      const response = await fetch(`/api/super-admin/advertising?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch campaigns')
      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleStatusUpdate = async (campaignId: string, campaignStatus: string, extra?: any) => {
    setActionLoading(campaignId)
    try {
      const response = await fetch(`/api/advertising/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignStatus, ...extra }),
      })
      if (!response.ok) throw new Error('Failed to update campaign')
      await fetchCampaigns()
      setSelectedCampaign(null)
    } catch (err) {
      console.error('Status update error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTargetId) return
    await handleStatusUpdate(rejectTargetId, 'REJECTED', { rejectedReason: rejectReason })
    setShowRejectModal(false)
    setRejectReason('')
    setRejectTargetId('')
  }

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to cancel/delete this campaign? This action cannot be undone.')) return
    await handleStatusUpdate(campaignId, 'CANCELLED')
  }

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)
    try {
      const payload: any = {
        title: createForm.title,
        campaignType: createForm.campaignType,
        selectedProductId: createForm.selectedProductId || undefined,
        selectedServiceId: createForm.selectedServiceId || undefined,
        homepageSection: createForm.homepageSection,
        duration: createForm.duration,
        price: createForm.price,
        maxSlots: createForm.maxSlots,
        vendorId: createForm.vendorId,
      }
      if (createForm.campaignStatus === 'ACTIVE' && createForm.startDate && createForm.endDate) {
        payload.campaignStatus = 'ACTIVE'
      } else if (createForm.campaignStatus === 'APPROVED') {
        payload.campaignStatus = 'APPROVED'
      } else {
        payload.campaignStatus = 'PENDING_APPROVAL'
      }

      const response = await fetch('/api/advertising/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create campaign')
      }
      setShowCreateModal(false)
      setCreateForm({
        vendorId: '',
        title: '',
        campaignType: 'SPONSORED_PRODUCT',
        selectedProductId: '',
        selectedServiceId: '',
        homepageSection: 'Sponsored',
        duration: 7,
        price: 100,
        maxSlots: 1,
        campaignStatus: 'PENDING_APPROVAL',
        startDate: '',
        endDate: '',
      })
      await fetchCampaigns()
    } catch (err) {
      console.error('Create campaign error:', err)
      alert(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setCreateLoading(false)
    }
  }

  const filteredCampaigns = campaigns
    .filter((c) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        c.title.toLowerCase().includes(q) ||
        c.vendor?.email?.toLowerCase().includes(q) ||
        c.product?.name?.toLowerCase().includes(q) ||
        c.service?.title?.toLowerCase().includes(q) ||
        campaignTypeLabels[c.campaignType]?.toLowerCase().includes(q)
      )
    })
    .filter((c) => {
      if (!statusFilter) return true
      return c.campaignStatus === statusFilter
    })
    .filter((c) => {
      if (!typeFilter) return true
      return c.campaignType === typeFilter
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (sortField === 'createdAt' || sortField === 'startDate' || sortField === 'endDate') {
        const aTime = aVal ? new Date(aVal).getTime() : 0
        const bTime = bVal ? new Date(bVal).getTime() : 0
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })

  const revenue = campaigns.reduce((sum, c) => sum + (c.revenueGenerated || 0), 0)
  const activeCampaigns = campaigns.filter((c) => c.campaignStatus === 'ACTIVE').length
  const pendingApprovals = campaigns.filter((c) => c.campaignStatus === 'PENDING_APPROVAL').length
  const expiredCampaigns = campaigns.filter((c) => c.campaignStatus === 'EXPIRED').length
  const totalPaid = campaigns.reduce((sum, c) => {
    return sum + (c.payments?.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0) || 0)
  }, 0)

  const topCampaigns = [...campaigns]
    .filter((c) => c.campaignStatus === 'ACTIVE')
    .sort((a, b) => (b.revenueGenerated || 0) - (a.revenueGenerated || 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-deep-navy">Advertising & Promotional Marketplace</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/super-admin">Back to Dashboard</Link>
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            Create Advertising Campaign
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Total Revenue</div>
            <div className="text-2xl font-bold text-deep-navy">GH₵ {totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Active Campaigns</div>
            <div className="text-2xl font-bold text-emerald-600">{activeCampaigns}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Pending Approvals</div>
            <div className="text-2xl font-bold text-amber-600">{pendingApprovals}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Expired Campaigns</div>
            <div className="text-2xl font-bold text-slate-600">{expiredCampaigns}</div>
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Top Performing Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <EmptyState title="No active campaigns yet" description="Campaigns will appear here once they are approved and activated." />
          ) : (
            <div className="space-y-3">
              {topCampaigns.map((campaign, idx) => (
              <div key={campaign.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-deep-navy truncate">{idx + 1}. {campaign.title}</div>
                  <div className="text-sm text-slate-500 truncate">
                    {campaignTypeLabels[campaign.campaignType] || campaign.campaignType}
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    {campaign.vendor?.profile ? `${campaign.vendor.profile.firstName || ''} ${campaign.vendor.profile.lastName || ''}`.trim() : campaign.vendor?.email}
                  </div>
                </div>
                <div className="text-right sm:ml-4 flex-shrink-0">
                  <div className="font-semibold text-deep-navy">GH₵ {campaign.revenueGenerated.toFixed(2)}</div>
                  <div className="text-sm text-slate-500 truncate">
                    {campaign.views} views | {campaign.clicks} clicks
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Campaign Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Search campaigns, vendors, products, services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 w-full md:w-auto rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="PENDING_PAYMENT">Pending Payment</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full md:w-auto rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
            >
              <option value="">All Types</option>
              {Object.entries(campaignTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={`${sortField}:${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split(':')
                setSortField(field)
                setSortOrder(order)
              }}
              className="w-full md:w-auto rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="price:desc">Price: High to Low</option>
              <option value="price:asc">Price: Low to High</option>
              <option value="revenueGenerated:desc">Revenue: High to Low</option>
              <option value="views:desc">Views: High to Low</option>
              <option value="clicks:desc">Clicks: High to Low</option>
            </select>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-4">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <EmptyState title="No campaigns found" description="No campaigns match the current filters." />
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => {
                const vendorName = campaign.vendor?.profile
                  ? `${campaign.vendor.profile.firstName || ''} ${campaign.vendor.profile.lastName || ''}`.trim()
                  : campaign.vendor?.email || 'Unknown'
                const entityName = campaign.product?.name || campaign.service?.title || 'Unknown'

                return (
                  <Card key={campaign.id} variant="outline">
                    <CardContent className="pt-4">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 min-w-0">
                            <h3 className="font-semibold text-deep-navy truncate min-w-0">{campaign.title}</h3>
                            <Badge variant={statusColors[campaign.campaignStatus] as any || 'default'} size="sm" className="flex-shrink-0">
                              {campaign.campaignStatus.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500">
                            {campaignTypeLabels[campaign.campaignType] || campaign.campaignType}
                          </p>
                          <p className="text-sm text-slate-500 break-words">
                            Vendor: {vendorName}
                            {campaign.vendor?.id && (
                              <Link href={`/dashboard/admin/vendors?vendorId=${campaign.vendor.id}`} className="text-royal-blue hover:underline ml-1">
                                View Vendor
                              </Link>
                            )}
                          </p>
                          <p className="text-sm text-slate-500 break-words">
                            Entity: {entityName}
                            {campaign.product?.id && (
                              <Link href={`/marketplace/product/${campaign.product.slug || campaign.product.id}`} className="text-royal-blue hover:underline ml-1">
                                View Product
                              </Link>
                            )}
                            {campaign.service?.id && (
                              <Link href={`/marketplace/service/${campaign.service.slug || campaign.service.id}`} className="text-royal-blue hover:underline ml-1">
                                View Service
                              </Link>
                            )}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                            <span>Price: GH₵ {campaign.price.toFixed(2)}</span>
                            <span>Views: {campaign.views.toLocaleString()}</span>
                            <span>Clicks: {campaign.clicks.toLocaleString()}</span>
                            <span>Orders: {campaign.ordersGenerated}</span>
                            <span>Revenue: GH₵ {campaign.revenueGenerated.toFixed(2)}</span>
                          </div>
                          {campaign.startDate && campaign.endDate && (
                            <div className="mt-1 text-xs text-slate-400">
                              {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedCampaign(campaign)}>
                            View Details
                          </Button>
                          {campaign.campaignStatus === 'PENDING_APPROVAL' && (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                loading={actionLoading === campaign.id}
                                onClick={() => handleStatusUpdate(campaign.id, 'APPROVED')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                loading={actionLoading === campaign.id}
                                onClick={() => {
                                  setRejectTargetId(campaign.id)
                                  setShowRejectModal(true)
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {campaign.campaignStatus === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="primary"
                              loading={actionLoading === campaign.id}
                              onClick={() => handleStatusUpdate(campaign.id, 'ACTIVE')}
                            >
                              Activate
                            </Button>
                          )}
                          {campaign.campaignStatus === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="danger"
                              loading={actionLoading === campaign.id}
                              onClick={() => handleStatusUpdate(campaign.id, 'SUSPENDED')}
                            >
                              Suspend
                            </Button>
                          )}
                          {campaign.campaignStatus === 'SUSPENDED' && (
                            <Button
                              size="sm"
                              variant="success"
                              loading={actionLoading === campaign.id}
                              onClick={() => handleStatusUpdate(campaign.id, 'ACTIVE')}
                            >
                              Reactivate
                            </Button>
                          )}
                          {['PENDING_PAYMENT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'EXPIRED'].includes(campaign.campaignStatus) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(campaign.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Campaign Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-slate-500">Status</div>
                  <Badge variant={statusColors[selectedCampaign.campaignStatus] as any || 'default'}>
                    {selectedCampaign.campaignStatus.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Type</div>
                  <div className="font-medium text-deep-navy">{campaignTypeLabels[selectedCampaign.campaignType] || selectedCampaign.campaignType}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Price</div>
                  <div className="font-medium text-deep-navy">GH₵ {selectedCampaign.price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Duration</div>
                  <div className="font-medium text-deep-navy">{selectedCampaign.duration} days</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-slate-500">Views</div>
                  <div className="font-medium text-deep-navy">{selectedCampaign.views.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Clicks</div>
                  <div className="font-medium text-deep-navy">{selectedCampaign.clicks.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Orders</div>
                  <div className="font-medium text-deep-navy">{selectedCampaign.ordersGenerated}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Revenue</div>
                  <div className="font-medium text-deep-navy">GH₵ {selectedCampaign.revenueGenerated.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-deep-navy mb-2">Payment History</h4>
                {selectedCampaign.payments && selectedCampaign.payments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCampaign.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl text-sm">
                        <div>
                          <span className="font-medium">GH₵ {payment.amount.toFixed(2)}</span>
                          <span className="text-slate-500 ml-2">{payment.status}</span>
                        </div>
                        <div className="text-slate-500">
                          {payment.paystackRef && <span className="mr-2">Ref: {payment.paystackRef}</span>}
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No payments recorded</p>
                )}
              </div>

              {selectedCampaign.invoice && (
                <div>
                  <h4 className="font-semibold text-deep-navy mb-2">Invoice</h4>
                  <div className="p-3 border border-slate-200 rounded-xl text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-500">Invoice Number</span>
                      <span className="font-medium">{selectedCampaign.invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-500">Amount</span>
                      <span className="font-medium">GH₵ {selectedCampaign.invoice.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-500">Period</span>
                      <span className="font-medium">
                        {new Date(selectedCampaign.invoice.periodStart).toLocaleDateString()} - {new Date(selectedCampaign.invoice.periodEnd).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <Badge variant={selectedCampaign.invoice.status === 'PAID' ? 'success' : 'secondary'} size="sm">
                        {selectedCampaign.invoice.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-deep-navy mb-2">Analytics (Last 7 Days)</h4>
                {selectedCampaign.analytics && selectedCampaign.analytics.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCampaign.analytics.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl text-sm">
                        <div>
                          <span className="font-medium">{new Date(a.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-4 text-slate-600">
                          <span>{a.views} views</span>
                          <span>{a.clicks} clicks</span>
                          <span>{a.ctr.toFixed(2)}% CTR</span>
                          <span>GH₵ {a.revenueGenerated.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No analytics data yet</p>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-deep-navy mb-2">History</h4>
                {selectedCampaign.history && selectedCampaign.history.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedCampaign.history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between p-2 border border-slate-100 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{h.action.replace(/_/g, ' ')}</span>
                          <span className="text-slate-500 ml-2">by {h.performedByRole}</span>
                        </div>
                        <div className="text-slate-400">{new Date(h.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No history yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md" variant="elevated">
            <CardHeader>
              <CardTitle>Reject Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                  rows={3}
                  placeholder="Enter reason for rejection..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectTargetId('') }}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleReject} disabled={!rejectReason.trim()}>
                  Reject Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Create Advertising Campaign</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                Close
              </Button>
            </CardHeader>
            <CardContent>
              {lookupsError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mb-4">
                  <p className="text-sm text-rose-700">{lookupsError}</p>
                </div>
              )}
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vendor</label>
                  {loadingLookups ? (
                    <div className="text-sm text-slate-500">Loading vendors...</div>
                  ) : vendors.length === 0 ? (
                    <div className="text-sm text-slate-500 p-3 bg-slate-50 border border-slate-200 rounded-xl">No vendors available</div>
                  ) : (
                    <select
                      value={createForm.vendorId}
                      onChange={(e) => setCreateForm({ ...createForm, vendorId: e.target.value })}
                      className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      required
                    >
                      <option value="">Select a vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.store?.name?.trim() ? v.store.name.trim() : 'Unnamed Store'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Title</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Type</label>
                  <select
                    value={createForm.campaignType}
                    onChange={(e) => setCreateForm({ ...createForm, campaignType: e.target.value })}
                    className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                  >
                    {Object.entries(campaignTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {(createForm.campaignType === 'SPONSORED_PRODUCT' || createForm.campaignType === 'FEATURED_PRODUCT_PLACEMENT') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Product</label>
                    {loadingLookups ? (
                      <div className="text-sm text-slate-500">Loading products...</div>
                    ) : (
                      <select
                        value={createForm.selectedProductId}
                        onChange={(e) => setCreateForm({ ...createForm, selectedProductId: e.target.value, selectedServiceId: '' })}
                        className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      >
                        <option value="">Select a product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} - GH₵ {p.price.toFixed(2)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {(createForm.campaignType === 'SPONSORED_SERVICE' || createForm.campaignType === 'FEATURED_SERVICE_PLACEMENT') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Service</label>
                    {loadingLookups ? (
                      <div className="text-sm text-slate-500">Loading services...</div>
                    ) : (
                      <select
                        value={createForm.selectedServiceId}
                        onChange={(e) => setCreateForm({ ...createForm, selectedServiceId: e.target.value, selectedProductId: '' })}
                        className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      >
                        <option value="">Select a service</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.title} - GH₵ {s.startingPrice.toFixed(2)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Homepage Section</label>
                  <select
                    value={createForm.homepageSection}
                    onChange={(e) => setCreateForm({ ...createForm, homepageSection: e.target.value })}
                    className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                  >
                    {homepageSections.map((s) => (
                      <option key={s.slug} value={s.slug}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Duration (days)</label>
                    <input
                      type="number"
                      value={createForm.duration}
                      onChange={(e) => setCreateForm({ ...createForm, duration: parseInt(e.target.value) || 7 })}
                      className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      min={1}
                      max={30}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Price (GHS)</label>
                    <input
                      type="number"
                      value={createForm.price}
                      onChange={(e) => setCreateForm({ ...createForm, price: parseFloat(e.target.value) || 0 })}
                      className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Slots</label>
                    <input
                      type="number"
                      value={createForm.maxSlots}
                      onChange={(e) => setCreateForm({ ...createForm, maxSlots: parseInt(e.target.value) || 1 })}
                      className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      min={1}
                      max={10}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Initial Status</label>
                  <select
                    value={createForm.campaignStatus}
                    onChange={(e) => setCreateForm({ ...createForm, campaignStatus: e.target.value })}
                    className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                  >
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="ACTIVE">Active</option>
                  </select>
                </div>

                {createForm.campaignStatus === 'ACTIVE' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={createForm.startDate}
                        onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                        className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={createForm.endDate}
                        onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                        className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      />
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="text-sm font-medium text-blue-900 mb-1">Campaign Cost Preview</div>
                  <div className="text-2xl font-bold text-blue-700">GH₵ {(createForm.price * createForm.duration).toFixed(2)}</div>
                  <div className="text-sm text-blue-600 mt-1">
                    {createForm.price.toFixed(2)} GHS/day × {createForm.duration} days
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={createLoading}>
                    Create Campaign
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
