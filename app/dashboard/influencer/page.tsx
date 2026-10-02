import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPrisma } from '@/lib/prisma'
import InfluencerDashboardView from '@/components/influencer/dashboard-view'

export default async function InfluencerDashboardPage() {
  const session = await getServerSession()

  if (!session || session.role !== 'INFLUENCER') {
    redirect('/login')
  }

  const prisma = getPrisma()
  const influencer = await prisma.influencer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })

  if (!influencer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-deep-navy mb-2">No Influencer Account</h1>
          <p className="text-gray-500">Your account is not linked to an influencer record.</p>
        </div>
      </div>
    )
  }

  return (
    <InfluencerDashboardView
      influencerId={influencer.id}
      reportApiPath="/api/influencer/report"
      referralsApiPath="/api/influencer/referrals"
      isInfluencerView
    />
  )
}
