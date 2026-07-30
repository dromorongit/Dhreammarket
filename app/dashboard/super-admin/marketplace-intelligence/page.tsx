'use client'

import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

export default function SuperAdminMarketplaceIntelligence() {
  const [activeTab, setActiveTab] = useState('kpis')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">Marketplace Intelligence</h1>

        <div className="flex gap-2 mb-8 border-b border-gray-200">
          {['kpis', 'vendors', 'products', 'services', 'categories', 'searches', 'coupons'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-royal-blue text-royal-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>

        {activeTab === 'kpis' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">GMV</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-royal-blue">$0.00</p>
                <p className="text-sm text-gray-500">Gross Merchandise Value</p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">Orders</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-deep-navy">0</p>
                <p className="text-sm text-gray-500">This month</p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">Bookings</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-deep-navy">0</p>
                <p className="text-sm text-gray-500">This month</p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">Conversion Rate</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-royal-blue">0%</p>
                <p className="text-sm text-gray-500">Views to purchases</p>
              </Card.Content>
            </Card>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Top Vendors</h2>
            <p className="text-gray-500">Vendor performance data will appear here</p>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Top Products</h2>
            <p className="text-gray-500">Product performance data will appear here</p>
          </div>
        )}

        {activeTab === 'services' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Top Services</h2>
            <p className="text-gray-500">Service performance data will appear here</p>
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Top Categories</h2>
            <p className="text-gray-500">Category performance data will appear here</p>
          </div>
        )}

        {activeTab === 'searches' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Top Searches</h2>
            <p className="text-gray-500">Search analytics will appear here</p>
          </div>
        )}

        {activeTab === 'coupons' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Coupon Analytics</h2>
            <p className="text-gray-500">Coupon performance data will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}