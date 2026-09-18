'use client'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { useState, useEffect } from 'react'
import { SITE_URL } from '@/lib/site-config'

interface ReferralStatsCardProps {
  totalReferrals: number
  successfulReferrals: number
  pendingReferrals: number
  totalRewardPoints: number
  totalRewardCashback: number
  referralCode: string
}

export function ReferralStatsCard({
  totalReferrals,
  successfulReferrals,
  pendingReferrals,
  totalRewardPoints,
  totalRewardCashback,
  referralCode,
}: ReferralStatsCardProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [shareSupported, setShareSupported] = useState(false)

  const hasRealCode = referralCode && referralCode !== 'REF-YOUR-CODE'
  const referralLink = hasRealCode ? `${SITE_URL}/register?referralCode=${encodeURIComponent(referralCode)}` : ''

  useEffect(() => {
    setShareSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const copyCode = async () => {
    if (!referralCode) return
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  const copyLink = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  const handleShare = async () => {
    if (!referralLink) return
    if (shareSupported) {
      try {
        await navigator.share({
          title: 'Join me on Dhream Market',
          text: `Sign up with my referral link and we both get rewarded!`,
          url: referralLink,
        })
        return
      } catch {
        // user cancelled or share failed, fall through to clipboard fallback
      }
    }
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-deep-navy">Referral Program</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 mb-1">Your Referral Code</p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-lg font-mono font-bold text-blue-800">{referralCode}</p>
              <button
                type="button"
                onClick={copyCode}
                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded"
              >
                {copiedCode ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {hasRealCode && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Shareable link</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  title={referralLink}
                  className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-700 truncate"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyLink}
                  className="whitespace-nowrap flex items-center gap-1.5"
                >
                  {copiedLink ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="whitespace-nowrap flex items-center gap-1.5"
                >
                  {copiedLink ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : shareSupported ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.5 9 12c0-.828-.448-1.5-1-1.5s-1 .672-1 1.5c0 .5.114.938.316 1.342m0 0a2.5 2.5 0 010 3.316m0-3.316a2.5 2.5 0 013.536 0m0 0a2.5 2.5 0 013.536 0M5.634 9.342a2.5 2.5 0 013.536 0m0 0a2.5 2.5 0 013.536 0m9.832 0a2.5 2.5 0 00-3.536 0m0 0a2.5 2.5 0 00-3.536 0" />
                      </svg>
                      Share
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.5 9 12c0-.828-.448-1.5-1-1.5s-1 .672-1 1.5c0 .5.114.938.316 1.342m0 0a2.5 2.5 0 010 3.316m0-3.316a2.5 2.5 0 013.536 0m0 0a2.5 2.5 0 013.536 0M5.634 9.342a2.5 2.5 0 013.536 0m0 0a2.5 2.5 0 013.536 0m9.832 0a2.5 2.5 0 00-3.536 0m0 0a2.5 2.5 0 00-3.536 0" />
                      </svg>
                      Share
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-deep-navy">{totalReferrals}</p>
              <p className="text-xs text-gray-500">Total Referrals</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-green-700">{successfulReferrals}</p>
              <p className="text-xs text-green-600">Successful</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-deep-navy">{totalRewardPoints.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Points Earned</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-deep-navy">{totalRewardCashback.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Cashback Earned (GHS)</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
