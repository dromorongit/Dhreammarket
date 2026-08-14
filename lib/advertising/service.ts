import { getPrisma } from '@/lib/prisma'
import { logInfo, logError } from '@/lib/logger'
import {
  AdvertisementCampaignData,
  AdvertisementCampaignType,
  AdvertisementCampaignStatus,
  AdvertisementCampaignAction,
  AdvertisementCampaignWithDetails,
  AdvertisementPlacement,
  AdvertisementPayment,
  AdvertisementInvoice,
  AdvertisementAnalytics,
  AdvertisementHistory,
  CampaignAnalyticsData,
  SponsoredRenderItem,
  HomepageRenderContext,
} from './types'

export async function createCampaign(
  vendorId: string,
  data: AdvertisementCampaignData & { campaignStatus?: AdvertisementCampaignStatus },
  performedByRole: string = 'VENDOR'
) {
  const prisma = getPrisma()

  const status = data.campaignStatus || 'PENDING_PAYMENT'
  const paymentStatus = status === 'PENDING_PAYMENT' ? 'PENDING' : 'PAID'
  const startDate = data.startDate || (status === 'ACTIVE' ? new Date() : null)
  const endDate = data.endDate || (status === 'ACTIVE' ? (() => {
    const d = new Date(startDate || new Date())
    d.setDate(d.getDate() + data.duration)
    return d
  })() : null)

  const campaign = await prisma.advertisementCampaign.create({
    data: {
      vendorId,
      title: data.title,
      campaignType: data.campaignType,
      selectedProductId: data.selectedProductId || null,
      selectedServiceId: data.selectedServiceId || null,
      homepageSection: data.homepageSection || null,
      duration: data.duration,
      price: data.price,
      maxSlots: data.maxSlots || 1,
      campaignStatus: status,
      paymentStatus,
      startDate,
      endDate,
    },
    include: {
      vendor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      placements: true,
      payments: true,
      invoice: true,
      analytics: true,
    },
  })

  const historyAction = status === 'PENDING_PAYMENT' ? 'CREATED' : status === 'PENDING_APPROVAL' ? 'SUBMITTED_FOR_APPROVAL' : 'CREATED'

  await prisma.advertisementHistory.create({
    data: {
      campaignId: campaign.id,
      action: historyAction,
      performedBy: vendorId,
      performedByRole: performedByRole,
      details: { title: campaign.title, campaignType: campaign.campaignType, price: campaign.price, initialStatus: status },
    },
  })

  if (status === 'ACTIVE') {
    await createPlacementsForCampaign(campaign.id)
  }

  logInfo(`Campaign created: id=${campaign.id}, vendor=${vendorId}, type=${data.campaignType}, status=${status}`)
  return campaign
}

export async function getCampaign(id: string): Promise<AdvertisementCampaignWithDetails | null> {
  const prisma = getPrisma()
  const campaign = await prisma.advertisementCampaign.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      product: { select: { id: true, name: true, slug: true, price: true } },
      service: { select: { id: true, title: true, slug: true, startingPrice: true } },
      placements: { orderBy: { displayOrder: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      invoice: true,
      analytics: { orderBy: { date: 'desc' }, take: 30 },
      history: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  return campaign as AdvertisementCampaignWithDetails | null
}

export async function getCampaignsByVendor(vendorId: string, status?: AdvertisementCampaignStatus) {
  const prisma = getPrisma()
  const where: any = { vendorId }
  if (status) where.campaignStatus = status

  const campaigns = await prisma.advertisementCampaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { id: true, name: true, slug: true, price: true } },
      service: { select: { id: true, title: true, slug: true, startingPrice: true } },
      placements: { orderBy: { displayOrder: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      invoice: true,
      analytics: { orderBy: { date: 'desc' }, take: 7 },
      history: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })
  return campaigns as AdvertisementCampaignWithDetails[]
}

export async function updateCampaignStatus(
  campaignId: string,
  status: AdvertisementCampaignStatus,
  performedBy: string,
  performedByRole: string,
  details?: Record<string, any>,
  vendorId?: string
) {
  const prisma = getPrisma()
  const where: any = { id: campaignId }
  if (vendorId) {
    where.vendorId = vendorId
  }
  const updateData: any = { campaignStatus: status, updatedAt: new Date() }

  if (status === 'APPROVED') updateData.approvedAt = new Date()
  if (status === 'REJECTED') updateData.rejectedAt = new Date()
  if (status === 'EXPIRED') updateData.endDate = new Date()
  if (status === 'SUSPENDED') updateData.suspendedAt = new Date()

  if (status === 'ACTIVE') {
    updateData.startDate = new Date()
  }

  const campaign = await prisma.advertisementCampaign.update({
    where,
    data: updateData,
  })

  if (status === 'ACTIVE' && !campaign.endDate) {
    const endDate = new Date(campaign.startDate || new Date())
    endDate.setDate(endDate.getDate() + campaign.duration)
    await prisma.advertisementCampaign.update({
      where: { id: campaignId },
      data: { endDate },
    })
  }

  const actionMap: Record<string, AdvertisementCampaignAction> = {
    'PENDING_PAYMENT': 'CREATED',
    'PENDING_APPROVAL': 'SUBMITTED_FOR_APPROVAL',
    'APPROVED': 'APPROVED',
    'REJECTED': 'REJECTED',
    'ACTIVE': 'ACTIVATED',
    'EXPIRED': 'EXPIRED',
    'CANCELLED': 'CANCELLED',
    'SUSPENDED': 'SUSPENDED',
  }

  await prisma.advertisementHistory.create({
    data: {
      campaignId,
      action: actionMap[status] || 'CREATED',
      performedBy,
      performedByRole,
      details: (details || null) as any,
    },
  })

  if (status === 'ACTIVE') {
    await createPlacementsForCampaign(campaignId)
  } else if (['SUSPENDED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)) {
    await prisma.advertisementPlacement.updateMany({
      where: { campaignId },
      data: { isSponsored: false },
    })
  }

  logInfo(`Campaign ${campaignId} status updated to ${status} by ${performedBy}`)
  return campaign
}

async function createPlacementsForCampaign(campaignId: string) {
  const prisma = getPrisma()
  const campaign = await prisma.advertisementCampaign.findUnique({
    where: { id: campaignId },
    include: { placements: true },
  })

  if (!campaign || !campaign.homepageSection) return

  const existingPlacements = campaign.placements || []
  if (existingPlacements.length > 0) return

  const placementsToCreate: any[] = []

  if (campaign.selectedProductId) {
    placementsToCreate.push({
      campaignId,
      sectionSlug: campaign.homepageSection,
      productId: campaign.selectedProductId,
      serviceId: null,
      displayOrder: 0,
      isSponsored: true,
    })
  }

  if (campaign.selectedServiceId) {
    placementsToCreate.push({
      campaignId,
      sectionSlug: campaign.homepageSection,
      productId: null,
      serviceId: campaign.selectedServiceId,
      displayOrder: 0,
      isSponsored: true,
    })
  }

  if (placementsToCreate.length > 0) {
    await prisma.advertisementPlacement.createMany({
      data: placementsToCreate,
      skipDuplicates: true,
    })
    logInfo(`Created ${placementsToCreate.length} placement(s) for campaign ${campaignId}`)
  }
}

export async function recordPayment(
  campaignId: string,
  amount: number,
  paystackRef: string,
  paystackPaymentId: string,
  metadata?: Record<string, any>
) {
  const prisma = getPrisma()

  const payment = await prisma.advertisementPayment.create({
    data: {
      campaignId,
      amount,
      currency: 'GHS',
      paystackRef,
      paystackPaymentId,
      status: 'PAID',
      metadata: metadata || null as any,
    },
  })

  await prisma.advertisementCampaign.update({
    where: { id: campaignId },
    data: {
      paymentStatus: 'PAID',
      paystackRef,
      paystackPaymentId,
      updatedAt: new Date(),
    },
  })

  await prisma.advertisementHistory.create({
    data: {
      campaignId,
      action: 'PAYMENT_SUCCESS',
      performedBy: campaignId,
      performedByRole: 'SYSTEM',
      details: { amount, paystackRef, paystackPaymentId },
    },
  })

  logInfo(`Payment recorded for campaign ${campaignId}: amount=${amount}, ref=${paystackRef}`)
  return payment
}

export async function recordPaymentFailed(
  campaignId: string,
  amount: number,
  paystackRef?: string,
  metadata?: Record<string, any>
) {
  const prisma = getPrisma()

  await prisma.advertisementPayment.create({
    data: {
      campaignId,
      amount,
      currency: 'GHS',
      paystackRef: paystackRef || null,
      status: 'FAILED',
      metadata: metadata || null as any,
    },
  })

  await prisma.advertisementCampaign.update({
    where: { id: campaignId },
    data: {
      paymentStatus: 'FAILED',
      updatedAt: new Date(),
    },
  })

  await prisma.advertisementHistory.create({
    data: {
      campaignId,
      action: 'PAYMENT_FAILED',
      performedBy: campaignId,
      performedByRole: 'SYSTEM',
      details: { amount, paystackRef },
    },
  })

  logInfo(`Payment failed for campaign ${campaignId}`)
}

export async function generateInvoice(campaignId: string): Promise<AdvertisementInvoice | null> {
  const prisma = getPrisma()
  const campaign = await prisma.advertisementCampaign.findUnique({
    where: { id: campaignId },
  })

  if (!campaign) return null

  const existingInvoice = await prisma.advertisementInvoice.findUnique({
    where: { campaignId },
  })

  if (existingInvoice) {
    logInfo(`Invoice already exists for campaign ${campaignId}: ${existingInvoice.invoiceNumber}`)
    return existingInvoice
  }

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + campaign.duration)

  const invoiceNumber = `ADV-${campaign.id.slice(0, 8).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  const invoice = await prisma.advertisementInvoice.create({
    data: {
      campaignId,
      invoiceNumber,
      amount: campaign.price,
      currency: 'GHS',
      periodStart,
      periodEnd,
      status: 'PENDING',
    },
  })

  await prisma.advertisementCampaign.update({
    where: { id: campaignId },
    data: { invoiceId: invoice.id, updatedAt: new Date() },
  })

  await prisma.advertisementHistory.create({
    data: {
      campaignId,
      action: 'CREATED',
      performedBy: campaign.vendorId,
      performedByRole: 'SYSTEM',
      details: { invoiceNumber, amount: campaign.price },
    },
  })

  logInfo(`Invoice generated for campaign ${campaignId}: ${invoiceNumber}`)
  return invoice
}

export async function recordAnalytics(
  campaignId: string,
  data: { views?: number; clicks?: number; ordersGenerated?: number; bookingsGenerated?: number; revenueGenerated?: number }
) {
  const prisma = getPrisma()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.advertisementAnalytics.findFirst({
    where: { campaignId, date: today },
  })

  if (existing) {
    await prisma.advertisementAnalytics.update({
      where: { id: existing.id },
      data: {
        views: (existing.views + (data.views || 0)),
        clicks: (existing.clicks + (data.clicks || 0)),
        ordersGenerated: (existing.ordersGenerated + (data.ordersGenerated || 0)),
        bookingsGenerated: (existing.bookingsGenerated + (data.bookingsGenerated || 0)),
        revenueGenerated: existing.revenueGenerated + (data.revenueGenerated || 0),
        ctr: data.clicks && data.views ? data.clicks / data.views : existing.ctr,
        conversionRate: data.ordersGenerated && data.clicks ? data.ordersGenerated / data.clicks : existing.conversionRate,
        updatedAt: new Date(),
      },
    })
  } else {
    await prisma.advertisementAnalytics.create({
      data: {
        campaignId,
        date: today,
        views: data.views || 0,
        clicks: data.clicks || 0,
        ordersGenerated: data.ordersGenerated || 0,
        bookingsGenerated: data.bookingsGenerated || 0,
        revenueGenerated: data.revenueGenerated || 0,
        ctr: data.clicks && data.views ? data.clicks / data.views : 0,
        conversionRate: data.ordersGenerated && data.clicks ? data.ordersGenerated / data.clicks : 0,
        roi: 0,
      },
    })
  }

  await prisma.advertisementCampaign.update({
    where: { id: campaignId },
    data: {
      views: { increment: data.views || 0 },
      clicks: { increment: data.clicks || 0 },
      ordersGenerated: { increment: data.ordersGenerated || 0 },
      bookingsGenerated: { increment: data.bookingsGenerated || 0 },
      revenueGenerated: { increment: data.revenueGenerated || 0 },
      updatedAt: new Date(),
    },
  })
}

export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalyticsData> {
  const prisma = getPrisma()
  const campaign = await prisma.advertisementCampaign.findUnique({
    where: { id: campaignId },
    select: { views: true, clicks: true, ordersGenerated: true, bookingsGenerated: true, revenueGenerated: true, price: true, duration: true },
  })

  if (!campaign) {
    return { totalViews: 0, totalClicks: 0, totalOrders: 0, totalBookings: 0, totalRevenue: 0, ctr: 0, conversionRate: 0, roi: 0, dailyAnalytics: [] }
  }

  const dailyAnalytics = await prisma.advertisementAnalytics.findMany({
    where: { campaignId },
    orderBy: { date: 'desc' },
    take: 30,
  })

  const totalViews = campaign.views
  const totalClicks = campaign.clicks
  const totalOrders = campaign.ordersGenerated
  const totalBookings = campaign.bookingsGenerated
  const totalRevenue = campaign.revenueGenerated
  const ctr = totalViews > 0 ? totalClicks / totalViews : 0
  const conversionRate = totalClicks > 0 ? totalOrders / totalClicks : 0

  const paidPayments = await prisma.advertisementPayment.aggregate({
    where: { campaignId, status: 'PAID' },
    _sum: { amount: true },
  })

  const totalCost = paidPayments._sum.amount || campaign.price * campaign.duration
  const roi = totalCost > 0 ? (totalRevenue - totalCost) / totalCost : 0

  return {
    totalViews,
    totalClicks,
    totalOrders,
    totalBookings,
    totalRevenue,
    ctr,
    conversionRate,
    roi,
    dailyAnalytics: dailyAnalytics.map((a) => ({
      date: a.date.toISOString(),
      views: a.views,
      clicks: a.clicks,
      orders: a.ordersGenerated,
      bookings: a.bookingsGenerated,
      revenue: a.revenueGenerated,
      ctr: a.ctr,
      conversionRate: a.conversionRate,
    })),
  }
}

export async function getActiveSponsoredPlacements(sectionSlug: string): Promise<SponsoredRenderItem[]> {
  const prisma = getPrisma()
  const now = new Date()

  const placements = await prisma.advertisementPlacement.findMany({
    where: {
      sectionSlug,
      isSponsored: true,
      campaign: {
        campaignStatus: 'ACTIVE',
        paymentStatus: 'PAID',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    },
    include: {
      campaign: { select: { id: true, title: true } },
    },
    orderBy: { displayOrder: 'asc' },
  })

  return placements.map((p) => ({
    id: p.id,
    type: p.productId ? 'PRODUCT' : p.serviceId ? 'SERVICE' : 'VENDOR',
    entityId: p.productId || p.serviceId || '',
    campaignId: p.campaignId,
    campaignTitle: p.campaign.title,
    sectionSlug: p.sectionSlug,
    displayOrder: p.displayOrder,
    isSponsored: true,
    badge: 'Sponsored' as const,
  }))
}

export async function getHomepageRenderContext(sectionSlug: string, sectionType: string, maxSlots: number): Promise<HomepageRenderContext> {
  const prisma = getPrisma()
  const now = new Date()

  const sponsoredPlacements = await prisma.advertisementPlacement.findMany({
    where: {
      sectionSlug,
      isSponsored: true,
      campaign: {
        campaignStatus: 'ACTIVE',
        paymentStatus: 'PAID',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    },
    include: {
      campaign: { select: { id: true, title: true } },
    },
    orderBy: { displayOrder: 'asc' },
  })

  const sponsoredItems: SponsoredRenderItem[] = sponsoredPlacements.map((p) => ({
    id: p.id,
    type: p.productId ? 'PRODUCT' : p.serviceId ? 'SERVICE' : 'VENDOR',
    entityId: p.productId || p.serviceId || '',
    campaignId: p.campaignId,
    campaignTitle: p.campaign.title,
    sectionSlug: p.sectionSlug,
    displayOrder: p.displayOrder,
    isSponsored: true,
    badge: 'Sponsored' as const,
  }))

  const sponsoredEntityIds = new Set(
    sponsoredPlacements.flatMap((p) => [p.productId, p.serviceId].filter(Boolean) as string[])
  )

  return {
    sectionSlug,
    sectionType,
    maxSlots,
    sponsoredItems,
    manualItems: [],
    autoFillItems: [],
    deduplicatedItems: [],
  }
}

export async function deduplicateHomepageItems(
  sectionSlug: string,
  sponsoredItems: SponsoredRenderItem[],
  manualItems: any[],
  autoFillItems: any[]
): Promise<any[]> {
  const seenIds = new Set<string>()
  const result: any[] = []

  for (const item of sponsoredItems) {
    if (!seenIds.has(item.entityId)) {
      seenIds.add(item.entityId)
      result.push({ ...item, source: 'sponsored' })
    }
  }

  for (const item of manualItems) {
    const entityId = item.productId || item.serviceId || item.id
    if (entityId && !seenIds.has(entityId)) {
      seenIds.add(entityId)
      result.push({ ...item, source: 'manual' })
    }
  }

  for (const item of autoFillItems) {
    const entityId = item.productId || item.serviceId || item.id
    if (entityId && !seenIds.has(entityId)) {
      seenIds.add(entityId)
      result.push({ ...item, source: 'auto-fill' })
    }
  }

  return result.slice(0, 50)
}

export async function expireOldCampaigns() {
  const prisma = getPrisma()
  const now = new Date()

  const expiredCampaigns = await prisma.advertisementCampaign.findMany({
    where: {
      campaignStatus: 'ACTIVE',
      endDate: { lt: now },
    },
  })

  for (const campaign of expiredCampaigns) {
    await prisma.advertisementCampaign.update({
      where: { id: campaign.id },
      data: { campaignStatus: 'EXPIRED', updatedAt: now },
    })

    await prisma.advertisementHistory.create({
      data: {
        campaignId: campaign.id,
        action: 'EXPIRED',
        performedBy: campaign.vendorId,
        performedByRole: 'SYSTEM',
        details: { reason: 'Campaign duration expired' },
      },
    })

    await prisma.advertisementPlacement.updateMany({
      where: { campaignId: campaign.id },
      data: { isSponsored: false },
    })

    logInfo(`Campaign ${campaign.id} expired automatically`)
  }

  return expiredCampaigns.length
}

export async function getCampaignById(id: string, vendorId?: string): Promise<AdvertisementCampaignWithDetails | null> {
  const prisma = getPrisma()
  const where: any = { id }
  if (vendorId) {
    where.vendorId = vendorId
  }
  const campaign = await prisma.advertisementCampaign.findUnique({
    where,
    include: {
      vendor: { select: { id: true, email: true } },
      product: true,
      service: true,
      placements: true,
      payments: true,
      invoice: true,
      analytics: true,
      history: true,
    },
  })
  return campaign as AdvertisementCampaignWithDetails | null
}