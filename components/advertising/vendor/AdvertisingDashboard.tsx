'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { TrendingNowSection } from '@/components/TrendingNowSection'

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
}

interface AdvertisingDashboardProps {
  campaigns: Campaign[]
  features: {
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
  tabs: {
    active: number
    pending: number
    rejected: number
    expired: number
  }
  analytics: any[]
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
  ACTIVE: 'default',
  PENDING_PAYMENT: 'secondary',
  PENDING_APPROVAL: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  EXPIRED: 'outline',
  CANCELLED: 'outline',
  SUSPENDED: 'destructive',
}

export function AdvertisingDashboard({ campaigns, features, tabs, analytics }: AdvertisingDashboardProps) {
  const [activeTab, setActiveTab] = useState('active')
  const [showCreateForm, setShowCreateForm] = useState(false)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Advertising Dashboard</h2>
        {features.canCreateCampaigns && (
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'New Campaign'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Campaigns</div>
            <div className="text-2xl font-bold">{campaigns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Views</div>
            <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Clicks</div>
            <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">CTR</div>
            <div className="text-2xl font-bold">{ctr.toFixed(2)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 border-b">
        {['active', 'pending', 'rejected', 'expired'].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabs[tab as keyof typeof tabs]})
          </button>
        ))}
      </div>

      {showCreateForm && (
        <CreateCampaignForm features={features} />
      )}

      {filteredCampaigns.length === 0 ? (
        <EmptyState
          title="No campaigns found"
          description={`You have no ${activeTab} campaigns. Create one to get started.`}
        />
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {analytics.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Campaign Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.map((data, idx) => (
              <Card key={idx}>
                <CardContent className="pt-4">
                  <div className="text-sm font-medium mb-2">Campaign #{idx + 1}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Views: {data.totalViews}</div>
                    <div>Clicks: {data.totalClicks}</div>
                    <div>CTR: {data.ctr.toFixed(2)}%</div>
                    <div>Revenue: ${data.totalRevenue}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const entityName = campaign.product?.name || campaign.service?.title || 'Unknown'

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{campaign.title}</h3>
            <p className="text-sm text-muted-foreground">
              {campaignTypeLabels[campaign.campaignType] || campaign.campaignType}
            </p>
            <p className="text-sm text-muted-foreground">Entity: {entityName}</p>
          </div>
          <Badge variant={statusColors[campaign.campaignStatus] as any}>
            {campaign.campaignStatus.replace('_', ' ')}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Price:</span> ${campaign.price}
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span> {campaign.duration} days
          </div>
          <div>
            <span className="text-muted-foreground">Views:</span> {campaign.views}
          </div>
          <div>
            <span className="text-muted-foreground">Clicks:</span> {campaign.clicks}
          </div>
        </div>
        {campaign.startDate && campaign.endDate && (
          <div className="mt-2 text-xs text-muted-foreground">
            {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CreateCampaignForm({ features }: { features: any }) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/advertising/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to create campaign:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Campaign</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Campaign Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full mt-1 p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Campaign Type</label>
            <select
              value={formData.campaignType}
              onChange={(e) => setFormData({ ...formData, campaignType: e.target.value })}
              className="w-full mt-1 p-2 border rounded"
            >
              {Object.entries(campaignTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Duration (days)</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 7 })}
                className="w-full mt-1 p-2 border rounded"
                min={1}
                max={30}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Price (GHS)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full mt-1 p-2 border rounded"
                min={0}
                step={0.01}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Homepage Section</label>
            <select
              value={formData.homepageSection}
              onChange={(e) => setFormData({ ...formData, homepageSection: e.target.value })}
              className="w-full mt-1 p-2 border rounded"
            >
              <option value="Sponsored">Sponsored</option>
              <option value="Trending Now">Trending Now</option>
              <option value="Trending Services">Trending Services</option>
              <option value="Featured Products">Featured Products</option>
              <option value="Featured Services">Featured Services</option>
            </select>
          </div>
          <Button type="submit">Create Campaign</Button>
        </form>
      </CardContent>
    </Card>
  )
}