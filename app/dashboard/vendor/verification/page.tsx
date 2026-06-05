'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'
import ImageUpload from '@/components/ImageUpload'
import { formatPrice } from '@/lib/currency'

interface VerificationApplication {
  id: string
  status: string
  paymentStatus?: string
  paymentAmount?: number
  kycInfo?: {
    businessName: string
    businessType: string
    businessRegistrationNumber?: string
    tinNumber?: string
    fullName: string
    phoneNumber: string
    email: string
  }
  documents?: Array<{
    documentType: string
    documentUrl: string
  }>
}

interface VerificationSettings {
  verificationFee: number
  verificationEnabled: boolean
  allowResubmissionAfterRejection: boolean
}

const statusSteps = ['NOT_APPLIED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'KYC_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']

export default function VendorVerificationPage() {
  const [application, setApplication] = useState<VerificationApplication | null>(null)
  const [settings, setSettings] = useState<VerificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<'payment' | 'kyc'>('payment')
  const [submitting, setSubmitting] = useState(false)
  const [kycData, setKycData] = useState({
    businessName: '',
    businessType: '',
    businessRegistrationNumber: '',
    tinNumber: '',
    fullName: '',
    phoneNumber: '',
    email: '',
  })
  const [kycDocuments, setKycDocuments] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [appRes, settingsRes] = await Promise.all([
        fetch('/api/vendor/verification/me'),
        fetch('/api/super-admin/verification-settings'),
      ])

      if (appRes.ok) {
        const appData = await appRes.json()
        setApplication(appData.application)
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setSettings(settingsData.settings)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleInitiatePayment = async () => {
    if (!settings) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/vendor/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initiate_payment' }),
      })
      if (response.ok) {
        const data = await response.json()
        setApplication(data.application)
        // Redirect to payment page
        window.location.href = `/payment/verification?amount=${data.amount}&ref=${Date.now()}`
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to initiate payment')
      }
    } catch (error) {
      console.error('Error initiating payment:', error)
      alert('Failed to initiate payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKYCSubmit = async () => {
    setSubmitting(true)
    try {
      const documents = Object.entries(kycDocuments).map(([type, url]) => ({
        type,
        url,
        name: type.replace(/_/g, ' '),
      }))

      const response = await fetch('/api/vendor/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_kyc',
          kycInfo: kycData,
          documents,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setApplication(data.application)
        alert('KYC submitted successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit KYC')
      }
    } catch (error) {
      console.error('Error submitting KYC:', error)
      alert('Failed to submit KYC')
    } finally {
      setSubmitting(false)
    }
  }

  const getCurrentStepIndex = () => {
    if (!application) return 0
    return statusSteps.indexOf(application.status)
  }

  const canResubmit = application?.status === 'REJECTED' && settings?.allowResubmissionAfterRejection

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!settings?.verificationEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card variant="elevated">
            <CardContent className="text-center py-12">
              <Badge variant="warning" size="lg" className="mb-4">Verification Disabled</Badge>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Registration Closed</h3>
              <p className="text-gray-600">Vendor verification is currently not available. Please check back later.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vendor Verification</h1>
          <p className="text-gray-600 mt-2">Apply for verified vendor status to increase trust and visibility</p>
        </div>

        {/* Progress Steps */}
        {application && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                {['Application', 'Payment', 'KYC', 'Review', 'Verified'].map((step, idx) => {
                  const appStatus = application.status
                  const isActive = getCurrentStepIndex() >= idx
                  const isComplete = getCurrentStepIndex() > idx
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isComplete ? 'bg-green-600 text-white' : 
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="text-xs mt-2 text-slate-600">{step}</span>
                    </div>
                  )
                })}
              </div>
              <Badge className="w-full text-center justify-center py-2">
                Current Status: {application.status.replace(/_/g, ' ')}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Application Status */}
        {application?.status === 'APPROVED' && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Congratulations! You're Verified</h3>
              <p className="text-gray-600">Your vendor verification has been approved. You now have the verified badge on your store.</p>
            </CardContent>
          </Card>
        )}

        {/* Payment Step */}
        {(!application || application.status === 'NOT_APPLIED' || canResubmit) && activeStep === 'payment' && (
          <Card variant="elevated" className="mb-8">
            <CardHeader>
              <h2 className="text-lg font-semibold">Step 1: Payment</h2>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  To apply for verification, you need to pay a one-time fee of <strong>{formatPrice(settings?.verificationFee || 250)}</strong>.
                </p>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm font-medium">Verification Benefits:</p>
                  <ul className="mt-2 text-sm text-slate-600 space-y-1">
                    <li>• Verified badge on your store and products</li>
                    <li>• Increased customer trust and visibility</li>
                    <li>• Priority in search results</li>
                    <li>• Access to premium features</li>
                  </ul>
                </div>
                <Button onClick={handleInitiatePayment} disabled={submitting} className="w-full">
                  {submitting ? 'Processing...' : `Pay ${formatPrice(settings?.verificationFee || 250)}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KYC Step */}
        {(!application || application.status === 'PAYMENT_COMPLETED') && activeStep === 'kyc' && (
          <Card variant="elevated" className="mb-8">
            <CardHeader>
              <h2 className="text-lg font-semibold">Step 2: KYC Information</h2>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleKYCSubmit(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Name *</label>
                  <Input
                    required
                    value={kycData.businessName}
                    onChange={(e) => setKycData(prev => ({ ...prev, businessName: e.target.value }))}
                    placeholder="Your business name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Type *</label>
                  <select
                    required
                    value={kycData.businessType}
                    onChange={(e) => setKycData(prev => ({ ...prev, businessType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select business type</option>
                    <option value="SOLE_PROPRIETOR">Sole Proprietorship</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="CORPORATION">Corporation</option>
                    <option value="LIMITED_COMPANY">Limited Company</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Registration Number (Optional)</label>
                  <Input
                    value={kycData.businessRegistrationNumber}
                    onChange={(e) => setKycData(prev => ({ ...prev, businessRegistrationNumber: e.target.value }))}
                    placeholder="Registration number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TIN Number (Optional)</label>
                  <Input
                    value={kycData.tinNumber}
                    onChange={(e) => setKycData(prev => ({ ...prev, tinNumber: e.target.value }))}
                    placeholder="Tax Identification Number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <Input
                      required
                      value={kycData.fullName}
                      onChange={(e) => setKycData(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                    <Input
                      required
                      value={kycData.phoneNumber}
                      onChange={(e) => setKycData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <Input
                    required
                    type="email"
                    value={kycData.email}
                    onChange={(e) => setKycData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Email address"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Required Documents</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Ghana Card Front *</label>
                      <ImageUpload
                        value={kycDocuments['ghana_card_front'] ? [kycDocuments['ghana_card_front']] : []}
                        onChange={(urls) => setKycDocuments(prev => ({ ...prev, ghana_card_front: urls[0] || '' }))}
                        folder="verification"
                        maxFiles={1}
                        maxSizeMB={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Ghana Card Back *</label>
                      <ImageUpload
                        value={kycDocuments['ghana_card_back'] ? [kycDocuments['ghana_card_back']] : []}
                        onChange={(urls) => setKycDocuments(prev => ({ ...prev, ghana_card_back: urls[0] || '' }))}
                        folder="verification"
                        maxFiles={1}
                        maxSizeMB={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Selfie Holding Ghana Card *</label>
                      <ImageUpload
                        value={kycDocuments['selfie'] ? [kycDocuments['selfie']] : []}
                        onChange={(urls) => setKycDocuments(prev => ({ ...prev, selfie: urls[0] || '' }))}
                        folder="verification"
                        maxFiles={1}
                        maxSizeMB={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Business Certificate (Optional)</label>
                      <ImageUpload
                        value={kycDocuments['business_certificate'] ? [kycDocuments['business_certificate']] : []}
                        onChange={(urls) => setKycDocuments(prev => ({ ...prev, business_certificate: urls[0] || '' }))}
                        folder="verification"
                        maxFiles={1}
                        maxSizeMB={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Proof of Address (Optional)</label>
                      <ImageUpload
                        value={kycDocuments['proof_of_address'] ? [kycDocuments['proof_of_address']] : []}
                        onChange={(urls) => setKycDocuments(prev => ({ ...prev, proof_of_address: urls[0] || '' }))}
                        folder="verification"
                        maxFiles={1}
                        maxSizeMB={5}
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Submitting...' : 'Submit KYC Information'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Rejected State - Resubmit Option */}
        {application?.status === 'REJECTED' && !canResubmit && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="text-center py-12">
              <Badge variant="danger" size="lg" className="mb-4">Application Rejected</Badge>
              <p className="text-gray-600">Your verification application was rejected. Contact support for more information.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}