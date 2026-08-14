export type EntityType = 'PRODUCT' | 'SERVICE' | 'VENDOR'

export type RecommendationReason =
  | 'VIEWED'
  | 'PURCHASED'
  | 'BOOKED'
  | 'LIKED'
  | 'TRENDING'
  | 'FREQUENTLY_BOUGHT'
  | 'FREQUENTLY_BOOKED'
  | 'SIMILAR_CATEGORY'
  | 'SIMILAR_VENDOR'
  | 'COMPLETE_YOUR_PURCHASE'
  | 'COMPLETE_YOUR_SERVICE'
  | 'CUSTOMER_ALSO_VIEWED'
  | 'CUSTOMER_ALSO_BOOKED'
  | 'VENDOR_FOLLOWING'
  | 'WISHLIST'
  | 'COLLECTION'
  | 'SEARCH_HISTORY'
  | 'RATING'
  | 'REVIEW'
  | 'RECOMMENDED_FOR_YOU'
  | 'SIMILAR_ITEMS'
  | 'PRODUCTS_ALSO_BOUGHT'
  | 'SERVICES_ALSO_BOOKED'

export interface RecommendationInput {
  userId?: string
  entityType?: EntityType
  entityId?: string
  limit?: number
  reasons?: RecommendationReason[]
  excludeIds?: string[]
}

export interface RecommendationResult {
  id: string
  name?: string
  title?: string
  slug: string
  price?: number
  salesPrice?: number | null
  dealsPrice?: number | null
  startingPrice?: number
  thumbnail?: string | null
  image?: string | null
  store?: { name: string; slug: string } | null
  category?: { name: string } | null
  reason: string
  type: EntityType
  score: number
  stock?: number | null
  reservedQuantity?: number | null
}

export interface TrendingInput {
  timeWindow?: '24H' | '7D' | '30D' | 'ALL_TIME'
  entityType?: EntityType
  limit?: number
  userId?: string
}

export interface TrendingResult {
  id: string
  name?: string
  title?: string
  slug: string
  price?: number
  salesPrice?: number | null
  dealsPrice?: number | null
  startingPrice?: number
  thumbnail?: string | null
  image?: string | null
  store?: { name: string; slug: string } | null
  category?: { name: string } | null
  trendScore: number
  trendDirection: 'rising' | 'falling' | 'stable'
  type: EntityType
  stock?: number | null
  reservedQuantity?: number | null
}

export interface SimilarInput {
  entityId: string
  entityType: EntityType
  limit?: number
}

export interface SimilarResult {
  id: string
  name?: string
  title?: string
  slug: string
  price?: number
  salesPrice?: number | null
  dealsPrice?: number | null
  startingPrice?: number
  thumbnail?: string | null
  image?: string | null
  store?: { name: string; slug: string } | null
  category?: { name: string } | null
  reason: string
  type: EntityType
  score: number
  stock?: number | null
  reservedQuantity?: number | null
}

export interface CrossSellInput {
  entityId: string
  entityType: EntityType
  limit?: number
}

export interface CrossSellResult {
  id: string
  name?: string
  title?: string
  slug: string
  price?: number
  salesPrice?: number | null
  dealsPrice?: number | null
  startingPrice?: number
  thumbnail?: string | null
  image?: string | null
  store?: { name: string; slug: string } | null
  category?: { name: string } | null
  reason: string
  type: EntityType
  score: number
  stock?: number | null
  reservedQuantity?: number | null
}

export interface CustomerInsightsInput {
  userId: string
  limit?: number
}

export interface CustomerInsight {
  category: string
  type: 'PRODUCT' | 'SERVICE' | 'BRAND' | 'VENDOR' | 'CATEGORY'
  items: Array<{
    id: string
    name: string
    slug: string
    count: number
    lastInteractedAt: string
  }>
  score: number
}

export interface CustomerInsightsResult {
  shoppingPreferences: CustomerInsight[]
  servicePreferences: CustomerInsight[]
  categoryInterests: CustomerInsight[]
  brandInterests: CustomerInsight[]
  vendorInterests: CustomerInsight[]
  recentlyViewed: Array<{ entityType: string; entityId: string; viewedAt: string }>
  recentlyPurchased: Array<{ entityType: string; entityId: string; purchasedAt: string }>
  recentlyBooked: Array<{ entityType: string; entityId: string; bookedAt: string }>
  mostClicked: Array<{ entityType: string; entityId: string; clickCount: number }>
}

export interface VendorInsightsInput {
  vendorId: string
  userId: string
}

export interface VendorInsight {
  type: string
  items: Array<{
    id: string
    name: string
    slug: string
    score: number
    reason: string
  }>
}

export interface VendorInsightsResult {
  suggestedProductsToAdd: VendorInsight[]
  suggestedServicesToOffer: VendorInsight[]
  lowPerformingProducts: VendorInsight[]
  highPerformingProducts: VendorInsight[]
  suggestedPriceImprovements: VendorInsight[]
  suggestedInventoryRestock: VendorInsight[]
}

export interface AIEngine {
  getRecommendations(input: RecommendationInput): Promise<RecommendationResult[]>
  getTrending(input: TrendingInput): Promise<TrendingResult[]>
  getSimilar(input: SimilarInput): Promise<SimilarResult[]>
  getFrequentlyBought(input: CrossSellInput): Promise<CrossSellResult[]>
  getCustomerInsights(input: CustomerInsightsInput): Promise<CustomerInsightsResult>
  getVendorInsights(input: VendorInsightsInput): Promise<VendorInsightsResult>
}

export interface AIEngineConfig {
  cacheTTL?: number
  maxCacheSize?: number
  defaultLimit?: number
}