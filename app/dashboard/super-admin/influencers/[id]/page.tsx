'use client'

import { useMemo } from 'react'
import InfluencerDashboardView from '@/components/influencer/dashboard-view'

export default function InfluencerDetailPage({ params }: { params: { id: string } }) {
  const reportApiPath = useMemo(
    () => `/api/super-admin/influencers/${params.id}/report`,
    [params.id]
  )
  const referralsApiPath = useMemo(
    () => `/api/super-admin/influencers/${params.id}/referrals`,
    [params.id]
  )

  return (
    <InfluencerDashboardView
      influencerId={params.id}
      reportApiPath={reportApiPath}
      referralsApiPath={referralsApiPath}
      isInfluencerView={false}
    />
  )
}
