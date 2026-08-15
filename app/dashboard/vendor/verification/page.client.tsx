'use client'

'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'
import ImageUpload from '@/components/ImageUpload'
import { formatPrice } from '@/lib/currency'
import { useRouter, useSearchParams } from 'next/navigation'

interface VerificationPayment {
  id: string
  reference: string
  amount: number
  status: string
  completedAt?: string
}

interface VerificationApplication {
  id: string
  status: string
  paymentStatus?: string
  paymentAmount?: number
  paymentReference?: string
  payments?: VerificationPayment[]
  kycInfo?: {
    businessName: string
    businessType: string
    businessRegistrationNumber?: string
    businessAddress?: string
    region?: string
    city?: string
    tinNumber?: string
    fullName: string
    phoneNumber: string
    email: string
    nationalIdType?: string
    nationalIdNumber?: string
  }
  documents?: Array<{
    documentType: string
    documentUrl: string
    fileName?: string
  }>
}

interface VerificationSettings {
  verificationFee: number
  verificationEnabled: boolean
  allowResubmissionAfterRejection: boolean
}

type NationalIdType = 'GHANA_CARD' | 'PASSPORT' | 'DRIVERS_LICENSE'

const statusSteps = ['NOT_APPLIED', 'UNPAID', 'PAID_PENDING_KYC', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED']

const DOCUMENT_REQUIREMENTS: Record<NationalIdType, { front?: boolean; back?: boolean }> = {
  GHANA_CARD: { front: true, back: true },
  PASSPORT: { front: true },
  DRIVERS_LICENSE: { front: true, back: true },
}

export default function VendorVerificationPageClient() {
  const [application, setApplication] = useState<VerificationApplication | null>(null)
  const [settings, setSettings] = useState<VerificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [kycData, setKycData] = useState({
    businessName: '',
    businessType: '',
    businessRegistrationNumber: '',
    businessAddress: '',
    region: '',
    city: '',
    tinNumber: '',
    fullName: '',
    phoneNumber: '',
    email: '',
    nationalIdType: '',
    nationalIdNumber: '',
  })
  const [kycDocuments, setKycDocuments] = useState<Record<string, string>>({
    ghana_card_front: '',
    ghana_card_back: '',
    passport: '',
    drivers_license_front: '',
    drivers_license_back: '',
    business_registration_certificate: '',
  })
  const router = useRouter()
  const searchParams = useSearchParams()

  const getDocumentKeysForType = useCallback((idType: NationalIdType | ''): string[] => {
    switch (idType) {
      case 'GHANA_CARD':
        return ['ghana_card_front', 'ghana_card_back']
      case 'PASSPORT':
        return ['passport']
      case 'DRIVERS_LICENSE':
        return ['drivers_license_front', 'drivers_license_back']
      default:
        return []
    }
  }, [])

  const getDynamicHelperText = useCallback((idType: NationalIdType | ''): string => {
    switch (idType) {
      case 'GHANA_CARD':
        return 'Please upload both the front and back of your Ghana Card.'
      case 'PASSPORT':
        return 'Please upload the bio-data page of your passport.'
      case 'DRIVERS_LICENSE':
        return 'Please upload both the front and back of your Driver\'s License.'
      default:
        return 'Please select a National ID Type to see required document uploads.'
    }
  }, [])

  const validateDocuments = useCallback((): boolean => {
    const { nationalIdType } = kycData
    if (!nationalIdType) return false
    const docKeys = getDocumentKeysForType(nationalIdType as NationalIdType)

    for (const key of docKeys) {
      if (!kycDocuments[key]) {
        return false
      }
    }

    return true
  }, [kycData.nationalIdType, kycDocuments, getDocumentKeysForType])

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
        if (appData.application?.kycInfo) {
          setKycData({
            businessName: appData.application.kycInfo.businessName || '',
            businessType: appData.application.kycInfo.businessType || '',
            businessRegistrationNumber: appData.application.kycInfo.businessRegistrationNumber || '',
            businessAddress: appData.application.kycInfo.businessAddress || '',
            region: appData.application.kycInfo.region || '',
            city: appData.application.kycInfo.city || '',
            tinNumber: appData.application.kycInfo.tinNumber || '',
            fullName: appData.application.kycInfo.fullName || '',
            phoneNumber: appData.application.kycInfo.phoneNumber || '',
            email: appData.application.kycInfo.email || '',
            nationalIdType: appData.application.kycInfo.nationalIdType || '',
            nationalIdNumber: appData.application.kycInfo.nationalIdNumber || '',
          })
        }
        if (appData.application?.documents) {
          const docs: Record<string, string> = {
            ghana_card_front: '',
            ghana_card_back: '',
            passport: '',
            drivers_license_front: '',
            drivers_license_back: '',
            business_registration_certificate: '',
          }
          appData.application.documents.forEach((doc: any) => {
            const docType = doc.documentType as string
            if (docType === 'ghana_card_front' || docType === 'ghana_card_back' ||
                docType === 'passport' || docType === 'drivers_license_front' ||
                docType === 'drivers_license_back' || docType === 'business_registration_certificate') {
              docs[docType] = doc.documentUrl
            } else if (docType === 'ghana_card') {
              docs['ghana_card_front'] = doc.documentUrl
            } else if (docType === 'drivers_license') {
              docs['drivers_license_front'] = doc.documentUrl
            } else {
              docs[docType] = doc.documentUrl
            }
          })
          setKycDocuments(docs)
        }
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

  const verifyPayment = useCallback(async (reference: string) => {
    try {
      const response = await fetch('/api/verification-payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          await fetchData()
          alert('Payment verified successfully! Please complete your KYC information.')
        }
      }
    } catch (error) {
      console.error('Error verifying payment:', error)
    }
  }, [fetchData])

  useEffect(() => {
    fetchData()

    const reference =
      searchParams?.get('reference') ||
      searchParams?.get('trxref')

    if (reference) {
      verifyPayment(reference)
      router.replace('/dashboard/vendor/verification')
    }
  }, [searchParams, router, fetchData, verifyPayment])

  const handleInitiatePayment = async () => {
    if (!settings) return
    setSubmitting(true)
    try {
      const appResponse = await fetch('/api/vendor/verification/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!appResponse.ok) {
        const error = await appResponse.json()
        alert(error.error || 'Failed to initialize application')
        return
      }

      const response = await fetch('/api/verification-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authorizationUrl
      } else {
        const error = await appResponse.json()
        alert(error.error || 'Failed to initiate payment')
      }
    } catch (error) {
      console.error('Error initiating payment:', error)
      alert('Failed to initiate payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResubmitChanges = async () => {
    setSubmitting(true)
    try {
      const appResponse = await fetch('/api/vendor/verification/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!appResponse.ok) {
        const error = await appResponse.json()
        alert(error.error || 'Failed to resubmit application')
        return
      }

      await fetchData()
      alert('Application reset. Please update and submit your KYC information.')
    } catch (error) {
      console.error('Error resubmitting application:', error)
      alert('Failed to resubmit application')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKYCSubmit = async () => {
    if (!application || (application.status !== 'PAID_PENDING_KYC' && application.status !== 'CHANGES_REQUESTED')) {
      alert('KYC can only be submitted after payment is completed or when changes are requested')
      return
    }

    const { nationalIdType } = kycData
    const idDocKeys = getDocumentKeysForType(nationalIdType as NationalIdType)

    for (const key of idDocKeys) {
      if (!kycDocuments[key]) {
        alert('Please upload all required National ID documents before submitting.')
        return
      }
    }

    setSubmitting(true)
    try {
      const allDocKeys = [...idDocKeys]
      if (kycDocuments['business_registration_certificate']) {
        allDocKeys.push('business_registration_certificate')
      }
      const documents = allDocKeys
        .filter(key => kycDocuments[key])
        .map(key => ({
          type: key,
          url: kycDocuments[key],
          name: key.replace(/_/g, ' '),
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
        alert('KYC submitted successfully! Application is now under review.')
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

  const canResubmit = (application?.status === 'REJECTED' && settings?.allowResubmissionAfterRejection) || application?.status === 'CHANGES_REQUESTED'

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

        {application && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                {['Payment', 'KYC', 'Review', 'Verified'].map((step, idx) => {
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

        {application?.status === 'APPROVED' && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Congratulations! You&apos;re Verified</h3>
              <p className="text-gray-600">Your vendor verification has been approved. You now have the verified badge on your store.</p>
            </CardContent>
          </Card>
        )}

        {application?.status === 'REJECTED' && canResubmit && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="text-center py-12">
              <Badge variant="danger" size="lg" className="mb-4">Application Rejected</Badge>
              <p className="text-gray-600 mb-4">Your verification application was rejected. You can resubmit after making changes.</p>
              <Button onClick={handleInitiatePayment} disabled={submitting}>
                {submitting ? 'Processing...' : 'Resubmit Application'}
              </Button>
            </CardContent>
          </Card>
        )}

        {application?.status === 'CHANGES_REQUESTED' && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="text-center py-12">
              <Badge variant="warning" size="lg" className="mb-4">Changes Requested</Badge>
              <p className="text-gray-600 mb-4">Admin has requested changes to your application. Please update your KYC information.</p>
              <Button onClick={handleResubmitChanges} disabled={submitting}>
                {submitting ? 'Processing...' : 'Update and Resubmit KYC'}
              </Button>
            </CardContent>
          </Card>
        )}

        {(!application || application.status === 'UNPAID') && (
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

        {(application?.status === 'PAID_PENDING_KYC' || application?.status === 'CHANGES_REQUESTED') && (
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Address *</label>
                  <Input
                    required
                    value={kycData.businessAddress}
                    onChange={(e) => setKycData(prev => ({ ...prev, businessAddress: e.target.value }))}
                    placeholder="Business address"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Region *</label>
                    <Input
                      required
                      value={kycData.region}
                      onChange={(e) => setKycData(prev => ({ ...prev, region: e.target.value }))}
                      placeholder="Region/State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                    <Input
                      required
                      value={kycData.city}
                      onChange={(e) => setKycData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TIN Number (Optional)</label>
                  <Input
                    value={kycData.tinNumber}
                    onChange={(e) => setKycData(prev => ({ ...prev, tinNumber: e.target.value }))}
                    placeholder="Tax Identification Number"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">National ID Type *</label>
                    <select
                      required
                      value={kycData.nationalIdType}
                      onChange={(e) => setKycData(prev => ({ ...prev, nationalIdType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select ID type</option>
                      <option value="GHANA_CARD">Ghana Card</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">National ID Number *</label>
                    <Input
                      required
                      value={kycData.nationalIdNumber}
                      onChange={(e) => setKycData(prev => ({ ...prev, nationalIdNumber: e.target.value }))}
                      placeholder="ID number"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">National ID Documents</h3>
                  {kycData.nationalIdType && (
                    <p className="text-sm text-gray-600 mb-3">
                      {getDynamicHelperText(kycData.nationalIdType as NationalIdType)}
                    </p>
                  )}

                  {kycData.nationalIdType === 'GHANA_CARD' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ghana Card Front Upload *</label>
                        <ImageUpload
                          value={kycDocuments['ghana_card_front'] ? [kycDocuments['ghana_card_front']] : []}
                          onChange={(urls) => setKycDocuments(prev => ({ ...prev, ghana_card_front: urls[0] || '' }))}
                          folder="verification"
                          maxFiles={1}
                          maxSizeMB={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ghana Card Back Upload *</label>
                        <ImageUpload
                          value={kycDocuments['ghana_card_back'] ? [kycDocuments['ghana_card_back']] : []}
                          onChange={(urls) => setKycDocuments(prev => ({ ...prev, ghana_card_back: urls[0] || '' }))}
                          folder="verification"
                          maxFiles={1}
                          maxSizeMB={5}
                        />
                      </div>
                    </div>
                  )}

                  {kycData.nationalIdType === 'PASSPORT' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Passport Bio Data Page Upload *</label>
                        <ImageUpload
                          value={kycDocuments['passport'] ? [kycDocuments['passport']] : []}
                          onChange={(urls) => setKycDocuments(prev => ({ ...prev, passport: urls[0] || '' }))}
                          folder="verification"
                          maxFiles={1}
                          maxSizeMB={5}
                        />
                      </div>
                    </div>
                  )}

                  {kycData.nationalIdType === 'DRIVERS_LICENSE' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Driver&apos;s License Front Upload *</label>
                        <ImageUpload
                          value={kycDocuments['drivers_license_front'] ? [kycDocuments['drivers_license_front']] : []}
                          onChange={(urls) => setKycDocuments(prev => ({ ...prev, drivers_license_front: urls[0] || '' }))}
                          folder="verification"
                          maxFiles={1}
                          maxSizeMB={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Driver&apos;s License Back Upload *</label>
                        <ImageUpload
                          value={kycDocuments['drivers_license_back'] ? [kycDocuments['drivers_license_back']] : []}
                          onChange={(urls) => setKycDocuments(prev => ({ ...prev, drivers_license_back: urls[0] || '' }))}
                          folder="verification"
                          maxFiles={1}
                          maxSizeMB={5}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Business Verification Documents</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Registration Certificate Upload (Optional)</label>
                    <ImageUpload
                      value={kycDocuments['business_registration_certificate'] ? [kycDocuments['business_registration_certificate']] : []}
                      onChange={(urls) => setKycDocuments(prev => ({ ...prev, business_registration_certificate: urls[0] || '' }))}
                      folder="verification"
                      maxFiles={1}
                      maxSizeMB={5}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={submitting || !validateDocuments()} className="w-full">
                  {submitting ? 'Submitting...' : 'Submit KYC Information'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {application?.status === 'PENDING_REVIEW' && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="text-center py-12">
              <Badge variant="info" size="lg" className="mb-4">Under Review</Badge>
              <p className="text-gray-600">Your verification application is under review. You will be notified once it&apos;s processed.</p>
            </CardContent>
          </Card>
        )}

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
