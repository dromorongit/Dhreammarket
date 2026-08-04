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
  startDate: string | null
  endDate: string | null
  views: number
  clicks: number
  ordersGenerated: number
  revenueGenerated: number
  product?: { id: string; name: string; slug: string; price: number } | null
  service?: { id: string; title: string; slug: string; startingPrice: number } | null
  payments: Array<{ id: string; amount: number; status: string; paystackRef: string | null; createdAt: string }>
  invoice?: { id: string; invoiceNumber: string; amount: number; status: string; periodStart: string; periodEnd: string } | null
  analytics: Array<{ id: string; date: string; views: number; clicks: number; ctr: number; revenueGenerated: number; roi: number }>
  history: Array<{ id: string; action: string; performedBy: string; performedByRole: string; details: any; createdAt: string }>
}

interface VendorProduct {
  id: string
  name: string
  price: number
  status: string
}

interface VendorService {
  id: string
  title: string
  startingPrice: number
  status: string
}

interface Features {
  canCreateCampaigns: boolean
  maxCampaigns: number
  canUseSponsoredProducts: boolean
  canUseSponsoredServices: boolean
  canUseSearchBoost: boolean
  canUseHomeplacements: boolean
  canUseTrendingBoosts: boolean
  canUseFeaturedPlacements: boolean
  canUseVendorSpotlight: boolean
  canUsePriorityApproval: boolean
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

export default function VendorAdvertisingClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [features, setFeatures] = useState<Features | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('active')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [services, setServices] = useState<VendorService[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingServices, setLoadingServices] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    campaignType: 'SPONSORED_PRODUCT',
    selectedProductId: '',
    selectedServiceId: '',
    homepageSection: 'Sponsored',
    duration: 7,
    price: 100,
    maxSlots: 1,
  })

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('tab', activeTab)
      const response = await fetch(`/api/vendor/advertising?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch advertising data')
      const data = await response.json()
      setCampaigns(data.campaigns || [])
      setFeatures(data.features || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load advertising data')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch('/api/products?limit=100')
      if (response.ok) {
        const data = await response.json()
        setProducts(Array.isArray(data?.products) ? data.products : [])
      }
    } catch {
      // silent
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const fetchServices = useCallback(async () => {
    setLoadingServices(true)
    try {
      const response = await fetch('/api/vendor/services?limit=100')
      if (response.ok) {
        const data = await response.json()
        setServices(Array.isArray(data?.services) ? data.services : [])
      }
    } catch {
      // silent
    } finally {
      setLoadingServices(false)
    }
  }, [])

  useEffect(() => {
    if (showCreateForm) {
      fetchProducts()
      fetchServices()
    }
  }, [showCreateForm, fetchProducts, fetchServices])

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/advertising/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create campaign')
      }
      const data = await response.json()
      setFormData({
        title: '',
        campaignType: 'SPONSORED_PRODUCT',
        selectedProductId: '',
        selectedServiceId: '',
        homepageSection: 'Sponsored',
        duration: 7,
        price: 100,
        maxSlots: 1,
      })
      setShowCreateForm(false)
      await fetchDashboardData()
      return data.campaign
    } catch (err) {
      console.error('Failed to create campaign:', err)
      alert(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setSubmitting(false)
    }
  }

  const handleProceedToPaystack = async (campaignId: string) => {
    setPaymentLoading(true)
    setPaymentStatus(null)
    try {
      const campaign = campaigns.find((c) => c.id === campaignId)
      if (!campaign) return

      const response = await fetch(`/api/advertising/payments/initiate/${campaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: campaign.price }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initialize payment')
      }
      const data = await response.json()
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
      } else {
        throw new Error('No authorization URL received')
      }
    } catch (err) {
      setPaymentStatus(err instanceof Error ? err.message : 'Payment initialization failed')
      setPaymentLoading(false)
    }
  }

  const handleViewDetails = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/advertising/campaigns/${campaignId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedCampaign(data.campaign)
      }
    } catch {
      // silent
    }
  }

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeTab === 'active') return c.campaignStatus === 'ACTIVE'
    if (activeTab === 'pending') return c.campaignStatus === 'PENDING_APPROVAL'
    if (activeTab === 'rejected') return c.campaignStatus === 'REJECTED'
    if (activeTab === 'expired') return c.campaignStatus === 'EXPIRED'
    return true
  })

  const totalViews = campaigns.reduce((sum, c) => sum + c.views, 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0)
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenueGenerated, 0)
  const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0
  const totalSpend = campaigns.reduce((sum, c) => {
    return sum + (c.payments?.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0) || 0)
  }, 0)

  const tabs = {
    active: campaigns.filter((c) => c.campaignStatus === 'ACTIVE').length,
    pending: campaigns.filter((c) => c.campaignStatus === 'PENDING_APPROVAL').length,
    rejected: campaigns.filter((c) => c.campaignStatus === 'REJECTED').length,
    expired: campaigns.filter((c) => c.campaignStatus === 'EXPIRED').length,
  }

  const getEntityName = (campaign: Campaign) => campaign.product?.name || campaign.service?.title || 'Unknown'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-deep-navy">Advertising Dashboard</h2>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/vendor">Back to Dashboard</Link>
          </Button>
          {features?.canCreateCampaigns && (
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Cancel' : 'New Campaign'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Total Campaigns</div>
            <div className="text-2xl font-bold text-deep-navy">{campaigns.length}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Total Views</div>
            <div className="text-2xl font-bold text-deep-navy">{totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Total Clicks</div>
            <div className="text-2xl font-bold text-deep-navy">{totalClicks.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">CTR</div>
            <div className="text-2xl font-bold text-deep-navy">{ctr.toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Total Spend</div>
            <div className="text-2xl font-bold text-deep-navy">GH₵ {totalSpend.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Revenue Generated</div>
            <div className="text-2xl font-bold text-emerald-600">GH₵ {totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">ROI</div>
            <div className="text-2xl font-bold text-deep-navy">
              {totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">Remaining Slots</div>
            <div className="text-2xl font-bold text-deep-navy">
              {features ? Math.max(0, features.maxCampaigns - campaigns.length) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {showCreateForm && features && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Create New Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Type</label>
                <select
                  value={formData.campaignType}
                  onChange={(e) => setFormData({ ...formData, campaignType: e.target.value })}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                >
                  {Object.entries(campaignTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {(formData.campaignType === 'SPONSORED_PRODUCT' || formData.campaignType === 'FEATURED_PRODUCT_PLACEMENT') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Choose Product</label>
                  {loadingProducts ? (
                    <div className="text-sm text-slate-500">Loading products...</div>
                  ) : (
                    <select
                      value={formData.selectedProductId}
                      onChange={(e) => setFormData({ ...formData, selectedProductId: e.target.value, selectedServiceId: '' })}
                      className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      required
                    >
                      <option value="">Select a product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} - GH₵ {p.price.toFixed(2)}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {(formData.campaignType === 'SPONSORED_SERVICE' || formData.campaignType === 'FEATURED_SERVICE_PLACEMENT') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Choose Service</label>
                  {loadingServices ? (
                    <div className="text-sm text-slate-500">Loading services...</div>
                  ) : (
                    <select
                      value={formData.selectedServiceId}
                      onChange={(e) => setFormData({ ...formData, selectedServiceId: e.target.value, selectedProductId: '' })}
                      className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                      required
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Choose Homepage Section</label>
                <select
                  value={formData.homepageSection}
                  onChange={(e) => setFormData({ ...formData, homepageSection: e.target.value })}
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
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 7 })}
                    className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                    min={1}
                    max={30}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Budget (GHS)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                    min={0}
                    step={0.01}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Slots</label>
                  <input
                    type="number"
                    value={formData.maxSlots}
                    onChange={(e) => setFormData({ ...formData, maxSlots: parseInt(e.target.value) || 1 })}
                    className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue"
                    min={1}
                    max={10}
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="text-sm font-medium text-blue-900 mb-1">Campaign Cost Preview</div>
                <div className="text-2xl font-bold text-blue-700">GH₵ {(formData.price * formData.duration).toFixed(2)}</div>
                <div className="text-sm text-blue-600 mt-1">
                  {formData.price.toFixed(2)} GHS/day × {formData.duration} days
                </div>
              </div>

              <Button type="submit" loading={submitting} fullWidth>
                Create Campaign
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {paymentStatus && (
        <Card variant="elevated" className={paymentStatus.includes('success') || paymentStatus.includes('Successful') ? 'border-emerald-200' : 'border-rose-200'}>
          <CardContent className="pt-4">
            <div className={`text-sm font-medium ${paymentStatus.includes('success') || paymentStatus.includes('Successful') ? 'text-emerald-700' : 'text-rose-700'}`}>
              {paymentStatus}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {['active', 'pending', 'rejected', 'expired'].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-royal-blue text-royal-blue'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabs[tab as keyof typeof tabs]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card variant="elevated">
          <CardContent className="pt-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          title="No campaigns found"
          description={`You have no ${activeTab} campaigns. Create one to get started.`}
        />
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => {
            const entityName = getEntityName(campaign)
            const paidPayments = campaign.payments?.filter((p) => p.status === 'PAID') || []
            const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0)
            const roi = totalPaid > 0 ? ((campaign.revenueGenerated - totalPaid) / totalPaid) * 100 : 0

            return (
              <Card key={campaign.id} variant="outline">
                <CardContent className="pt-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-deep-navy truncate">{campaign.title}</h3>
                        <Badge variant={statusColors[campaign.campaignStatus] as any || 'default'} size="sm">
                          {campaign.campaignStatus.replace('_', ' ')}
                        </Badge>
                        {campaign.paymentStatus === 'PAID' && (
                          <Badge variant="success" size="sm">Paid</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {campaignTypeLabels[campaign.campaignType] || campaign.campaignType}
                      </p>
                      <p className="text-sm text-slate-500">Entity: {entityName}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>Price: GH₵ {campaign.price.toFixed(2)}</span>
                        <span>Duration: {campaign.duration} days</span>
                        <span>Views: {campaign.views.toLocaleString()}</span>
                        <span>Clicks: {campaign.clicks.toLocaleString()}</span>
                        <span>CTR: {totalViews > 0 ? ((campaign.clicks / (campaign.views || 1)) * 100).toFixed(2) : '0.00'}%</span>
                      </div>
                      {campaign.startDate && campaign.endDate && (
                        <div className="mt-1 text-xs text-slate-400">
                          {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                      <Button size="sm" variant="ghost" onClick={() => handleViewDetails(campaign.id)}>
                        View Details
                      </Button>
                      {campaign.campaignStatus === 'PENDING_PAYMENT' && (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={paymentLoading}
                          onClick={() => handleProceedToPaystack(campaign.id)}
                        >
                          Proceed to Pay
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
                  <div className="text-sm text-slate-500">CTR</div>
                  <div className="font-medium text-deep-navy">
                    {selectedCampaign.views > 0 ? ((selectedCampaign.clicks / selectedCampaign.views) * 100).toFixed(2) : '0.00'}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Revenue</div>
                  <div className="font-medium text-deep-navy">GH₵ {selectedCampaign.revenueGenerated.toFixed(2)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-slate-500">Spend</div>
                  <div className="font-medium text-deep-navy">
                    GH₵ {selectedCampaign.payments?.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0).toFixed(2) || '0.00'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Orders</div>
                  <div className="font-medium text-deep-navy">{selectedCampaign.ordersGenerated}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Start Date</div>
                  <div className="font-medium text-deep-navy">
                    {selectedCampaign.startDate ? new Date(selectedCampaign.startDate).toLocaleDateString() : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">End Date</div>
                  <div className="font-medium text-deep-navy">
                    {selectedCampaign.endDate ? new Date(selectedCampaign.endDate).toLocaleDateString() : '-'}
                  </div>
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
                  <h4 className="font-semibold text-deep-navy mb-2">Billing History</h4>
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
                <h4 className="font-semibold text-deep-navy mb-2">Campaign Analytics</h4>
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
                          <span>{a.roi.toFixed(1)}% ROI</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No analytics data yet</p>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-deep-navy mb-2">Campaign History</h4>
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
    </div>
  )
}
