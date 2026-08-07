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
    campaignCreation: boolean
    sponsoredSearchBoost: boolean
    categoryBoosts: boolean
    vendorSpotlight: boolean
    priorityApproval: boolean
    unlimitedCampaigns: boolean
  }
}

interface SubscriptionData {
  subscriptionId: string
  currentPlan: string
  subscriptionStatus: string
  startDate: string | null
  endDate: string | null
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
  plans: SubscriptionPlan[]
}

export default function VendorSubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const fetchSubscription = useCallback(async () => {
    setLoading(true)
    setActionMessage(null)
    try {
      const res = await fetch('/api/dashboard/vendor/subscription')
      if (res.ok) {
        const data = await res.json()
        setSubscription(data)
      } else {
        setActionMessage('Failed to load subscription data')
      }
    } catch (err) {
      console.error('Error fetching subscription:', err)
      setActionMessage('Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const handleUpgrade = async (planName: string) => {
    setActionLoading(true)
    setActionMessage(null)
    try {
      const plan = subscription?.plans.find((p) => p.name === planName)
      const isPaid = plan && (plan.priceMonthly ?? 0) > 0

      if (isPaid) {
        const res = await fetch('/api/subscription/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'initializePayment',
            planName,
            billingCycle: 'MONTHLY',
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to initialize payment')
        }
        const data = await res.json()
        if (data.authorizationUrl) {
          window.location.href = data.authorizationUrl
        } else {
          throw new Error('No payment authorization URL received')
        }
      } else {
        const res = await fetch('/api/subscription/vendor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upgrade', planName, billingCycle: 'MONTHLY' }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to upgrade subscription')
        }
        setSubscription((prev) => prev ? { ...prev, currentPlan: planName, subscriptionStatus: 'ACTIVE' } : null)
        setShowUpgradeModal(false)
        setActionMessage(`Successfully upgraded to ${planName}`)
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Upgrade failed')
    } finally {
      setActionLoading(false)
    }
  }

  // After Paystack redirects back to the dashboard with a transaction reference,
  // verify the payment server-side and refresh the subscription state.
  const verifyOnReturn = useCallback(async (reference: string) => {
    setActionLoading(true)
    setActionMessage(null)
    try {
      const res = await fetch('/api/subscription/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyPayment', reference }),
      })
      const data = await res.json()
      if (res.ok && (data.success || data.status === 'success')) {
        setActionMessage(data.upgraded
          ? 'Payment verified. Your subscription has been upgraded.'
          : 'Payment verified. Your subscription has been updated.')
      } else {
        setActionMessage(data.error || 'Payment could not be verified. Your subscription was not changed.')
      }
    } catch {
      setActionMessage('Payment verification failed. Please contact support.')
    } finally {
      const url = new URL(window.location.href)
      url.search = ''
      window.history.replaceState({}, '', url.toString())
      setActionLoading(false)
      fetchSubscription()
    }
  }, [fetchSubscription])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference') || params.get('trxref')
    if (reference) {
      verifyOnReturn(reference)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRenew = async (subscriptionId: string) => {
    setActionLoading(true)
    setActionMessage(null)
    try {
      const res = await fetch('/api/subscription/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew', subscriptionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to renew subscription')
      }
      setActionMessage('Subscription renewed successfully')
      fetchSubscription()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Renewal failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    setShowCancelConfirm(false)
    setActionLoading(true)
    setActionMessage(null)
    try {
      const res = await fetch('/api/subscription/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', atPeriodEnd: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel subscription')
      }
      setActionMessage('Subscription cancellation scheduled. Access continues until the end of your billing period.')
      fetchSubscription()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Cancellation failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateInvoice = async () => {
    if (!subscription?.subscriptionId) {
      setActionMessage('No subscription found to generate invoice')
      return
    }
    setActionLoading(true)
    setActionMessage(null)
    try {
      const res = await fetch('/api/subscription/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateInvoice', subscriptionId: subscription.subscriptionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate invoice')
      }
      const data = await res.json()
      setActionMessage(`Invoice ${data.invoice?.invoiceNumber ?? ''} generated successfully`)
      fetchSubscription()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Invoice generation failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading subscription details...</p>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">No subscription data available.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">Subscription & Monetization</h1>

        {actionMessage && (
          <div className={`p-4 rounded-xl mb-6 ${actionMessage.includes('success') || actionMessage.includes('scheduled') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
            <p className="text-sm font-medium">{actionMessage}</p>
          </div>
        )}

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

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Current Plan</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-royal-blue">{subscription.currentPlan}</p>
                  <p className="text-sm text-gray-500">Status: {subscription.subscriptionStatus}</p>
                  {subscription.startDate && (
                    <p className="text-sm text-gray-500">Started: {new Date(subscription.startDate).toLocaleDateString()}</p>
                  )}
                  {subscription.endDate && (
                    <p className="text-sm text-gray-500">Ends: {new Date(subscription.endDate).toLocaleDateString()}</p>
                  )}
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

            <div className="flex flex-wrap gap-4">
              <Button onClick={() => setShowUpgradeModal(true)} disabled={actionLoading}>Upgrade Plan</Button>
              <Button variant="outline" onClick={handleGenerateInvoice} disabled={actionLoading}>Generate Invoice</Button>
              <Button variant="outline" onClick={() => setShowCancelConfirm(true)} disabled={actionLoading}>Cancel Subscription</Button>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
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

        {activeTab === 'usage' && (
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
              {subscription.plans.map((plan) => (
                <Card key={plan.name} className={plan.name === subscription.currentPlan ? 'ring-2 ring-royal-blue' : ''}>
                  <CardHeader>
                    <h3 className="font-semibold text-deep-navy">{plan.name}</h3>
                    <p className="text-2xl font-bold text-royal-blue">
                      {plan.priceMonthly === 0 || plan.priceMonthly === null ? 'Free' : formatCurrency(plan.priceMonthly)}
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
                    {plan.name !== subscription.currentPlan && (
                      <Button onClick={() => handleUpgrade(plan.name)} className="w-full" disabled={actionLoading}>
                        {plan.name === 'Free' ? 'Select' : 'Upgrade'}
                      </Button>
                    )}
                    {plan.name === subscription.currentPlan && (
                      <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Upgrade Plan</h3>
              <p className="text-gray-500 mb-4">Select a plan to upgrade to:</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {subscription.plans.filter((p) => p.name !== subscription.currentPlan).map((plan) => (
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
              <Button variant="outline" onClick={() => setShowUpgradeModal(false)} className="mt-4 w-full" disabled={actionLoading}>Cancel</Button>
            </div>
          </div>
        )}

        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Cancel Subscription</h3>
              <p className="text-gray-500 mb-4">
                Are you sure you want to cancel your subscription? Your current plan will remain active until the end of your billing period ({subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : 'N/A'}). After that, you will lose access to premium features.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setShowCancelConfirm(false)} disabled={actionLoading}>Keep Subscription</Button>
                <Button variant="danger" onClick={handleCancel} loading={actionLoading}>Confirm Cancellation</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
