import { getPrisma } from '@/lib/prisma'
import { getFeatureRestrictions } from '@/lib/subscription/types'
import { isExpiredInfluencerTrial } from '@/lib/subscription/feature-restriction'
import { ensureFreeSubscription } from '@/lib/subscription/subscription-service'

export async function getFeaturedVendorsForHomepage(limit: number = 10) {
  const prisma = getPrisma()
  const subscriptions = await prisma.vendorSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: {
        name: { in: ['Business', 'Professional', 'Enterprise'] },
      },
      source: {
        not: 'INFLUENCER',
      },
    },
    include: {
      vendor: { select: { email: true, store: { select: { name: true, slug: true, logo: true, averageRating: true } } } },
      plan: true,
    },
    orderBy: { totalPaid: 'desc' },
    take: limit,
  })

  return subscriptions.map((s) => ({
    vendorId: s.vendorId,
    vendorName: s.vendor?.store?.name ?? s.vendor?.email ?? 'Unknown',
    storeSlug: s.vendor?.store?.slug ?? '',
    logo: s.vendor?.store?.logo ?? null,
    rating: s.vendor?.store?.averageRating ?? 0,
    planName: s.plan?.name ?? 'Unknown',
    totalPaid: s.totalPaid,
  }))
}

export async function getSponsoredVendorsForHomepage(limit: number = 10) {
  const prisma = getPrisma()
  const subscriptions = await prisma.vendorSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: {
        name: { in: ['Professional', 'Enterprise'] },
      },
      source: {
        not: 'INFLUENCER',
      },
    },
    include: {
      vendor: { select: { email: true, store: { select: { name: true, slug: true, logo: true, averageRating: true } } } },
      plan: true,
    },
    orderBy: { totalPaid: 'desc' },
    take: limit,
  })

  return subscriptions.map((s) => ({
    vendorId: s.vendorId,
    vendorName: s.vendor?.store?.name ?? s.vendor?.email ?? 'Unknown',
    storeSlug: s.vendor?.store?.slug ?? '',
    logo: s.vendor?.store?.logo ?? null,
    rating: s.vendor?.store?.averageRating ?? 0,
    planName: s.plan?.name ?? 'Unknown',
    totalPaid: s.totalPaid,
  }))
}

export async function getVendorsWithPromotionCredits(limit: number = 20) {
  const prisma = getPrisma()
  const subscriptions = await prisma.vendorSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: {
        name: { in: ['Business', 'Professional', 'Enterprise'] },
      },
      source: {
        not: 'INFLUENCER',
      },
    },
    include: {
      vendor: { select: { email: true, store: { select: { name: true, slug: true } } } },
      plan: true,
    },
    orderBy: { totalPaid: 'desc' },
    take: limit,
  })

  return subscriptions.map((s) => ({
    vendorId: s.vendorId,
    vendorName: s.vendor?.store?.name ?? s.vendor?.email ?? 'Unknown',
    storeSlug: s.vendor?.store?.slug ?? '',
    planName: s.plan?.name ?? 'Unknown',
    totalPaid: s.totalPaid,
  }))
}

export async function canVendorBeFeatured(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  let subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })

  if (!subscription) {
    subscription = await ensureFreeSubscription(vendorId)
  }

  if (!subscription || subscription.status !== 'ACTIVE') return false
  if (isExpiredInfluencerTrial(subscription)) return false
  const restrictions = await getFeatureRestrictions(subscription.plan.name)
  return restrictions.homepagePromotions
}

export async function canVendorBeSponsored(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  let subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })

  if (!subscription) {
    subscription = await ensureFreeSubscription(vendorId)
  }

  if (!subscription || subscription.status !== 'ACTIVE') return false
  if (isExpiredInfluencerTrial(subscription)) return false
  const restrictions = await getFeatureRestrictions(subscription.plan.name)
  return restrictions.sponsoredProducts || restrictions.sponsoredServices
}