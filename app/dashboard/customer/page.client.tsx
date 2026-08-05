'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
const CollectionsGrid = dynamic(() => import('@/components/CollectionsGrid').then((m) => m.CollectionsGrid), { ssr: false })
const RecentlyViewed = dynamic(() => import('@/components/RecentlyViewed').then((m) => m.RecentlyViewed), { ssr: false })
import { RecommendationCard } from '@/components/RecommendationCard'
import { VendorFollowButton } from '@/components/VendorFollowButton'
import { TrustBadge } from '@/components/TrustBadges'
import { StarRating } from '@/components/StarRating'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const AICustomerInsights = dynamic(() => import('@/components/ai').then((m) => m.AICustomerInsights), { ssr: false })
const AIRecommendations = dynamic(() => import('@/components/ai').then((m) => m.AIRecommendations), { ssr: false })

export default function CustomerDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [followedVendors, setFollowedVendors] = useState<any[]>([])
  const [savedSearches, setSavedSearches] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTabData = useCallback(async (tab: string) => {
    setLoading(true)
    try {
      switch (tab) {
        case 'followed-vendors':
          const followRes = await fetch('/api/vendors/following')
          if (followRes.ok) {
            const data = await followRes.json()
            setFollowedVendors(data.vendors || [])
          }
          break
        case 'saved-searches':
          const searchRes = await fetch('/api/saved-searches')
          if (searchRes.ok) {
            const data = await searchRes.json()
            setSavedSearches(data.searches || [])
          }
          break
        case 'recommendations':
          const recRes = await fetch('/api/recommendations')
          if (recRes.ok) {
            const data = await recRes.json()
            setRecommendations(data.recommendations || [])
          }
          break
      }
    } catch (error) {
      console.error('Error fetching tab data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'overview') {
      fetchTabData(activeTab)
    }
  }, [activeTab, fetchTabData])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">Customer Dashboard</h1>

        <div className="flex gap-2 mb-8 border-b border-gray-200 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'loyalty', label: 'Loyalty & Rewards' },
            { key: 'collections', label: 'Collections' },
            { key: 'recently-viewed', label: 'Recently Viewed' },
            { key: 'followed-vendors', label: 'Followed Vendors' },
            { key: 'saved-searches', label: 'Saved Searches' },
            { key: 'recommendations', label: 'For You' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-royal-blue text-royal-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-deep-navy">Quick Links</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href="/dashboard/customer/orders" className="block text-royal-blue hover:underline">My Orders</Link>
                  <Link href="/dashboard/customer/wishlist" className="block text-royal-blue hover:underline">Wishlist</Link>
                  <Link href="/dashboard/customer/collections" className="block text-royal-blue hover:underline">Collections</Link>
                  <Link href="/dashboard/customer/saved-searches" className="block text-royal-blue hover:underline">Saved Searches</Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-deep-navy">Notifications</h3>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/notifications" className="text-royal-blue hover:underline text-sm">
                  View all notifications
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-deep-navy">Followed Vendors</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">You are following {followedVendors.length} vendors</p>
                <Link href="#" onClick={() => setActiveTab('followed-vendors')} className="text-royal-blue hover:underline text-sm mt-2 inline-block">
                  View followed vendors
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Loyalty & Rewards</h2>
            <Link href="/dashboard/customer/loyalty">
              <Button>View Loyalty Dashboard</Button>
            </Link>
          </div>
        )}

        {activeTab === 'collections' && (
          <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-deep-navy">My Collections</h2>
                <Button asChild>
                  <Link href="/dashboard/customer/collections/new">New Collection</Link>
                </Button>
              </div>
              <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><div className="bg-white rounded-xl p-6 h-40 animate-pulse"></div><div className="bg-white rounded-xl p-6 h-40 animate-pulse"></div><div className="bg-white rounded-xl p-6 h-40 animate-pulse"></div></div>}>
                <CollectionsGrid />
              </Suspense>
            </div>
        )}

        {activeTab === 'recently-viewed' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Recently Viewed</h2>
            <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"><div className="bg-white rounded-xl h-64 animate-pulse"></div><div className="bg-white rounded-xl h-64 animate-pulse"></div><div className="bg-white rounded-xl h-64 animate-pulse"></div><div className="bg-white rounded-xl h-64 animate-pulse"></div></div>}>
              <RecentlyViewed />
            </Suspense>
          </div>
        )}

        {activeTab === 'followed-vendors' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Followed Vendors</h2>
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl h-24"></div>
                ))}
              </div>
            ) : followedVendors.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-gray-500">You haven&apos;t followed any vendors yet</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {followedVendors.map((vendor) => (
                  <Card key={vendor.id} variant="elevated">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                        {vendor.logo ? (
                          <Image src={vendor.logo} alt={vendor.name} className="object-cover" fill sizes="64px" />
                        ) : (
                          <span className="text-2xl font-bold text-gray-400">{vendor.name[0]}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-deep-navy">{vendor.name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <StarRating rating={vendor.averageRating || 0} size="sm" />
                          <span className="text-xs text-gray-500">({vendor.reviewCount || 0})</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{vendor.location}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Link href={`/vendor/${vendor.slug}`}>
                        <Button variant="outline" size="sm" className="w-full">Visit Store</Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved-searches' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Saved Searches</h2>
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl h-16"></div>
                ))}
              </div>
            ) : savedSearches.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-gray-500">You haven&apos;t saved any searches yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {savedSearches.map((search) => (
                  <Card key={search.id} variant="outline" className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-deep-navy">{search.query}</h3>
                      <p className="text-sm text-gray-500">Saved on {new Date(search.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Link href={`/search?q=${encodeURIComponent(search.query)}`}>
                      <Button variant="outline" size="sm">Search</Button>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-deep-navy mb-6">Recommended For You</h2>
              {loading ? (
                <div className="animate-pulse grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl h-64"></div>
                  ))}
                </div>
              ) : recommendations.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-gray-500">Browse products to get personalized recommendations</p>
                  <Link href="/marketplace">
                    <Button className="mt-4">Browse Products</Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {recommendations.map((item) => (
                    <RecommendationCard key={`${item.entityType}-${item.entityId}`} item={item} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8">
                <Suspense fallback={<div className="bg-white rounded-xl p-6 h-64 animate-pulse"></div>}>
                  <AICustomerInsights userId="" />
                </Suspense>
              </div>
          </div>
        )}
      </div>
    </div>
  )
}
