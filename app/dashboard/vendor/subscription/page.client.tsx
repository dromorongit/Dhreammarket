'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'

interface SubscriptionPlan {
  name: string
  priceMonthly: number | null
  priceYearly: number | null
  productsLimit: number
  servicesLimit: number
  benefits: string[]
  restrictions: {
    productLimits: boolean
    serviceLimits: boolean
    homepagePromotions: boolean
    sponsoredProducts: boolean
    sponsoredServices: boolean
    premiumAnalytics: boolean
    advancedAI: boolean
    cashbackCampaigns: boolean
    rewardCampaigns: boolean
    vendorAdvertisements: boolean
  }
}

interface SubscriptionData {
  currentPlan: string
  subscriptionStatus: string
  nextRenewal: string | null
  productsRemaining: number
  servicesRemaining: number
  billingHistory: Array<{
    id: string
    invoiceNumber: string
    amount: number
    status: string
    periodStart: string
    periodEnd: string
    createdAt: string
  }>
  usage: Array<{
    metric: string
    currentValue: number
    limit: number | null
    percentage: number
  }>
}

export default function VendorSubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/vendor/subscription')
      if (res.ok) {
        const data = await res.json()
        setSubscription(data)
      }
    } catch (err) {
      console.error('Error fetching subscription:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/subscription/admin?action=plans')
      if (res.ok) {
        const data = await res.json()
        setPlans(data.plans ?? [])
      }
    } catch (err) {
      console.error('Error fetching plans:', err)
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
    fetchPlans()
  }, [fetchSubscription, fetchPlans])

  const handleUpgrade = async (planName: string) => {
    try {
      const res = await fetch('/api/subscription/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upgrade', planName, billingCycle: 'MONTHLY' }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubscription((prev) => prev ? { ...prev, currentPlan: planName, subscriptionStatus: 'ACTIVE' } : null)
        setShowUpgradeModal(false)
      }
    } catch (err) {
      console.error('Error upgrading subscription:', err)
    }
  }

  const handleRenew = async (subscriptionId: string) => {
    try {
      const res = await fetch('/api/subscription/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew', subscriptionId }),
      })
      if (res.ok) {
        fetchSubscription()
      }
    } catch (err) {
      console.error('Error renewing subscription:', err)
    }
  }

  const handleCancel = async () => {
    try {
      const res = await fetch('/api/subscription/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', atPeriodEnd: true }),
      })
      if (res.ok) {
        fetchSubscription()
      }
    } catch (err) {
      console.error('Error cancelling subscription:', err)
    }
  }

  const handleGenerateInvoice = async (subscriptionId: string) => {
    try {
      const res = await fetch('/api/subscription/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateInvoice', subscriptionId }),
      })
      if (res.ok) {
        const data = await res.json()
        console.log('Invoice generated:', data.invoice)
      }
    } catch (err) {
      console.error('Error generating invoice:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading subscription details...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">Subscription & Monetization</h1>

        <div className="flex gap-2 mb-8 border-b border-gray-200">
          {['overview', 'billing', 'usage', 'plans'].map((tab) => (
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

        {activeTab === 'overview' && subscription && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Current Plan</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-royal-blue">{subscription.currentPlan}</p>
                  <p className="text-sm text-gray-500">Status: {subscription.subscriptionStatus}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Products Remaining</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-deep-navy">
                    {subscription.productsRemaining === -1 ? 'Unlimited' : subscription.productsRemaining}
                  </p>
                  <p className="text-sm text-gray-500">of your plan limit</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Services Remaining</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-deep-navy">
                    {subscription.servicesRemaining === -1 ? 'Unlimited' : subscription.servicesRemaining}
                  </p>
                  <p className="text-sm text-gray-500">of your plan limit</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Next Renewal</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-deep-navy">
                    {subscription.nextRenewal ? new Date(subscription.nextRenewal).toLocaleDateString() : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500">Auto-renewal enabled</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-deep-navy">Subscription Usage</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {subscription.usage.map((u) => (
                    <div key={u.metric} className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-deep-navy">
                          {u.metric.replace(/_/g, ' ')}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-royal-blue h-2 rounded-full"
                            style={{ width: `${Math.min(u.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {u.currentValue} / {u.limit ?? 'Unlimited'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button onClick={() => setShowUpgradeModal(true)}>Upgrade Plan</Button>
              <Button variant="outline" onClick={() => handleGenerateInvoice(subscription?.currentPlan ?? '')}>Generate Invoice</Button>
              <Button variant="outline" onClick={handleCancel}>Cancel Subscription</Button>
            </div>
          </div>
        )}

        {activeTab === 'billing' && subscription && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Billing History</h2>
            {subscription.billingHistory.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No billing history yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {subscription.billingHistory.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-deep-navy">{inv.invoiceNumber}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-deep-navy">{formatCurrency(inv.amount)}</span>
                        <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'default'} size="sm">
                          {inv.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'usage' && subscription && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Usage Details</h2>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">Detailed usage metrics will appear here.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'plans' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card key={plan.name} className={plan.name === subscription?.currentPlan ? 'ring-2 ring-royal-blue' : ''}>
                  <CardHeader>
                    <h3 className="font-semibold text-deep-navy">{plan.name}</h3>
                    <p className="text-2xl font-bold text-royal-blue">
                      {plan.priceMonthly === 0 ? 'Free' : formatCurrency(plan.priceMonthly)}
                      <span className="text-sm font-normal text-gray-500">/month</span>
                    </p>
                    {plan.priceYearly && plan.priceYearly > 0 && (
                      <p className="text-sm text-gray-500">or {formatCurrency(plan.priceYearly)}/year</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-4">
                      {plan.benefits.map((benefit, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="text-green-500">✓</span> {benefit}
                        </li>
                      ))}
                    </ul>
                    <div className="text-sm text-gray-500 mb-4">
                      <p>Products: {plan.productsLimit === -1 ? 'Unlimited' : plan.productsLimit}</p>
                      <p>Services: {plan.servicesLimit === -1 ? 'Unlimited' : plan.servicesLimit}</p>
                    </div>
                    {plan.name !== subscription?.currentPlan && (
                      <Button onClick={() => handleUpgrade(plan.name)} className="w-full">
                        {plan.name === 'Free' ? 'Select' : 'Upgrade'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Upgrade Plan</h3>
              <p className="text-gray-500 mb-4">Select a plan to upgrade to:</p>
              <div className="space-y-2">
                {plans.filter((p) => p.name !== subscription?.currentPlan).map((plan) => (
                  <button
                    key={plan.name}
                    onClick={() => handleUpgrade(plan.name)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-sm text-gray-500">{plan.priceMonthly ? formatCurrency(plan.priceMonthly) + '/mo' : 'Contact us'}</p>
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={() => setShowUpgradeModal(false)} className="mt-4 w-full">Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}