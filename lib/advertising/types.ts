export interface AdvertisementCampaignData {
  title: string
  campaignType: AdvertisementCampaignType
  selectedProductId?: string
  selectedServiceId?: string
  homepageSection?: string
  duration: number
  price: number
  maxSlots?: number
}

export type AdvertisementCampaignType =
  | 'SPONSORED_PRODUCT'
  | 'SPONSORED_SERVICE'
  | 'TRENDING_NOW_BOOST'
  | 'TRENDING_SERVICE_BOOST'
  | 'FEATURED_PRODUCT_PLACEMENT'
  | 'FEATURED_SERVICE_PLACEMENT'
  | 'SEARCH_RESULT_BOOST'
  | 'CATEGORY_BOOST'
  | 'VENDOR_SPOTLIGHT'

export type AdvertisementCampaignStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUSPENDED'

export type AdvertisementCampaignAction =
  | 'CREATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SUBMITTED_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVATED'
  | 'SUSPENDED'
  | 'EXTENDED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'RENEWED'

export interface AdvertisementCampaignWithDetails extends AdvertisementCampaign {
  vendor?: { id: string; email: string; profile?: { firstName: string | null; lastName: string | null } }
  product?: { id: string; name: string; slug: string; price: number } | null
  service?: { id: string; title: string; slug: string; startingPrice: number } | null
  placements: AdvertisementPlacement[]
  payments: AdvertisementPayment[]
  invoice: AdvertisementInvoice | null
  analytics: AdvertisementAnalytics[]
}

export interface AdvertisementPlacement {
  id: string
  campaignId: string
  sectionSlug: string
  productId: string | null
  serviceId: string | null
  displayOrder: number
  isSponsored: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AdvertisementPayment {
  id: string
  campaignId: string
  amount: number
  currency: string
  paystackRef: string | null
  paystackPaymentId: string | null
  status: string
  metadata: Record<string, any> | null
  createdAt: Date
  updatedAt: Date
}

export interface AdvertisementInvoice {
  id: string
  campaignId: string
  invoiceNumber: string
  amount: number
  currency: string
  periodStart: Date
  periodEnd: Date
  status: string
  paystackInvoiceId: string | null
  metadata: Record<string, any> | null
  createdAt: Date
  updatedAt: Date
}

export interface AdvertisementAnalytics {
  id: string
  campaignId: string
  date: Date
  views: number
  clicks: number
  ordersGenerated: number
  bookingsGenerated: number
  revenueGenerated: number
  ctr: number
  conversionRate: number
  roi: number
  createdAt: Date
  updatedAt: Date
}

export interface AdvertisementHistory {
  id: string
  campaignId: string
  action: AdvertisementCampaignAction
  performedBy: string
  performedByRole: string
  details: Record<string, any> | null
  createdAt: Date
}

export interface CampaignAnalyticsData {
  totalViews: number
  totalClicks: number
  totalOrders: number
  totalBookings: number
  totalRevenue: number
  ctr: number
  conversionRate: number
  roi: number
  dailyAnalytics: Array<{
    date: string
    views: number
    clicks: number
    orders: number
    bookings: number
    revenue: number
    ctr: number
    conversionRate: number
  }>
}

export interface HomepageSponsoredConfig {
  enabled: boolean
  maxSponsoredSlots: number
  maxManualSlots: number
  autoFillEnabled: boolean
  sectionCapacities: Record<string, number>
  campaignExpirationHandling: 'hide' | 'show_as_expired' | 'remove_immediately'
}

export interface SponsoredRenderItem {
  id: string
  type: 'PRODUCT' | 'SERVICE' | 'VENDOR'
  entityId: string
  campaignId: string
  campaignTitle: string
  sectionSlug: string
  displayOrder: number
  isSponsored: boolean
  badge: 'Sponsored' | 'Promoted'
}

export interface HomepageRenderContext {
  sectionSlug: string
  sectionType: string
  maxSlots: number
  sponsoredItems: SponsoredRenderItem[]
  manualItems: any[]
  autoFillItems: any[]
  deduplicatedItems: any[]
}