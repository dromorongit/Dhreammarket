'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'

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
}

interface SuperAdminAdvertisingDashboardProps {
  campaigns: Campaign[]
  pagination: { page: number; limit: number; totalCount: number; totalPages: number }
  revenue: { total: number; activeCampaigns: number; pendingApprovals: number; expiredCampaigns: number }
  topCampaigns: Campaign[]
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

export function SuperAdminAdvertisingDashboard({
  campaigns,
  pagination,
  revenue,
  topCampaigns,
}: SuperAdminAdvertisingDashboardProps) {
  const [statusFilter, setStatusFilter] = useState('')

  const filteredCampaigns = campaigns.filter((c) => {
    if (!statusFilter) return true
    return c.campaignStatus === statusFilter
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Advertising & Promotional Marketplace</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Revenue</div>
            <div className="text-2xl font-bold">${revenue.total.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Active Campaigns</div>
            <div className="text-2xl font-bold">{revenue.activeCampaigns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Pending Approvals</div>
            <div className="text-2xl font-bold">{revenue.pendingApprovals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Expired Campaigns</div>
            <div className="text-2xl font-bold">{revenue.expiredCampaigns}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <EmptyState title="No active campaigns yet" description="Campaigns will appear here once they are approved and activated." />
          ) : (
            <div className="space-y-3">
              {topCampaigns.map((campaign, idx) => (
                <div key={campaign.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{idx + 1}. {campaign.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {campaignTypeLabels[campaign.campaignType] || campaign.campaignType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${campaign.revenueGenerated.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      {campaign.views} views | {campaign.clicks} clicks
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {filteredCampaigns.length === 0 ? (
        <EmptyState title="No campaigns found" description="No campaigns match the current filter." />
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
          </span>
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const entityName = campaign.product?.name || campaign.service?.title || 'Unknown'
  const vendorName = campaign.vendor?.profile
    ? `${campaign.vendor.profile.firstName || ''} ${campaign.vendor.profile.lastName || ''}`.trim()
    : campaign.vendor?.email || 'Unknown'

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{campaign.title}</h3>
            <p className="text-sm text-muted-foreground">
              {campaignTypeLabels[campaign.campaignType] || campaign.campaignType}
            </p>
            <p className="text-sm text-muted-foreground">Vendor: {vendorName}</p>
            <p className="text-sm text-muted-foreground">Entity: {entityName}</p>
          </div>
          <Badge variant={statusColors[campaign.campaignStatus] as any}>
            {campaign.campaignStatus.replace('_', ' ')}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Price:</span> ${campaign.price}
          </div>
          <div>
            <span className="text-muted-foreground">Views:</span> {campaign.views}
          </div>
          <div>
            <span className="text-muted-foreground">Clicks:</span> {campaign.clicks}
          </div>
          <div>
            <span className="text-muted-foreground">Orders:</span> {campaign.ordersGenerated}
          </div>
          <div>
            <span className="text-muted-foreground">Revenue:</span> ${campaign.revenueGenerated}
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