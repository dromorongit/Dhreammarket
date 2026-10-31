import { notFound } from 'next/navigation'
import { isTrustProfileEnabled } from '@/lib/feature-flags'
import { getPrisma } from '@/lib/prisma'
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'
import { composeProfile } from '@/lib/trust/metrics'
import { formatRate, formatDelivery, formatReturns, formatRating } from '@/lib/trust/copy'
import { SellerTrustProfileCard } from '@/components/trust/SellerTrustProfileCard'

export const dynamic = 'force-dynamic'

export default async function SellerTrustProfilePage({ params }: { params: { id: string } }) {
  if (!isTrustProfileEnabled()) {
    notFound()
  }

  const prisma = getPrisma()
  let store = await prisma.store.findUnique({
    where: { slug: params.id },
    select: { id: true, slug: true, name: true, createdAt: true, isVerified: true },
  })
  if (!store) {
    store = await prisma.store.findUnique({
      where: { id: params.id },
      select: { id: true, slug: true, name: true, createdAt: true, isVerified: true },
    })
  }
  if (!store) {
    notFound()
  }

  const result = await getCachedSellerTrustProfile(store.id)
  if (!result.found) {
    notFound()
  }

  const profile = composeProfile({
    ...result.data,
    storeCreatedAt: new Date(result.data.storeCreatedAt),
    firstSaleAt: result.data.firstSaleAt ? new Date(result.data.firstSaleAt) : null,
    verifiedSince: result.data.verifiedSince ? new Date(result.data.verifiedSince) : null,
    now: new Date(result.data.now),
  })

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{store.name} — Trust profile</h1>
        <p className="text-slate-600 mt-2 text-sm">
          Transparent, fact-based signals computed from platform records. No single score or grade.
        </p>
        <SellerTrustProfileCard profile={profile} storeName={store.name} />
      </div>
    </div>
  )
}
