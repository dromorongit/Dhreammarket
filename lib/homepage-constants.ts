export const CONTENT_SOURCES = ['AUTOMATIC', 'MANUAL', 'HYBRID'] as const

export type ContentSource = (typeof CONTENT_SOURCES)[number]

export const MANAGED_SECTION_SLUGS = [
  'trending-now',
  'dynamic-random-product-rail',
  'trending-services',
  'verified-vendors',
  'flash-sales',
  'sponsored',
  'gadget-display',
  'big-top-deals',
  'brand-store',
  'top-clearance-sales',
  'top-services',
  'home-theatre',
  'top-express-offers',
  'new-services',
  'food-showcase',
] as const

export type ManagedSectionSlug = (typeof MANAGED_SECTION_SLUGS)[number]

export const DEFAULT_HOMEPAGE_SECTIONS = [
  {
    name: 'Sponsored',
    slug: 'sponsored',
    type: 'SPONSORED_PRODUCTS' as const,
    subtitle: 'Featured by vendors',
    displayOrder: 1,
    contentSource: 'MANUAL' as const,
  },
  {
    name: 'Trending Now',
    slug: 'trending-now',
    type: 'TRENDING_NOW' as const,
    subtitle: 'Discover what\'s currently trending across Dhream Market.',
    displayOrder: 2,
    contentSource: 'HYBRID' as const,
  },
  {
    name: 'Dynamic Random Product Rail',
    slug: 'dynamic-random-product-rail',
    type: 'TRENDING_NOW' as const,
    subtitle: 'Discover random marketplace products.',
    displayOrder: 3,
    contentSource: 'AUTOMATIC' as const,
  },
  {
    name: 'Trending Services',
    slug: 'trending-services',
    type: 'TRENDING_SERVICES' as const,
    subtitle: "Discover what's currently trending in services.",
    displayOrder: 4,
    contentSource: 'HYBRID' as const,
  },
  {
    name: 'Verified Vendors',
    slug: 'verified-vendors',
    type: 'FEATURED_VENDORS' as const,
    subtitle: 'Trusted and verified vendors you can rely on.',
    displayOrder: 5,
    contentSource: 'AUTOMATIC' as const,
  },
  {
    name: 'Food & Grocery Showcase',
    slug: 'food-showcase',
    type: 'PRODUCT_GRID' as const,
    subtitle: 'Discover the best food and grocery vendors near you.',
    displayOrder: 6,
    contentSource: 'AUTOMATIC' as const,
  },
  {
    name: 'Flash Sales',
    slug: 'flash-sales',
    type: 'FLASH_SALES' as const,
    subtitle: 'Limited time offers',
    displayOrder: 7,
    contentSource: 'MANUAL' as const,
  },
  {
    name: 'Gadget Display',
    slug: 'gadget-display',
    type: 'LARGE_FEATURE_CARDS' as const,
    subtitle: 'Premium tech deals',
    displayOrder: 8,
    contentSource: 'MANUAL' as const,
  },
  {
    name: 'Big Top Deals',
    slug: 'big-top-deals',
    type: 'BIG_DEALS' as const,
    subtitle: 'Biggest savings on premium products',
    displayOrder: 9,
    contentSource: 'MANUAL' as const,
  },
  {
    name: 'Brand Store',
    slug: 'brand-store',
    type: 'BRAND_GRID' as const,
    subtitle: 'Explore products from your favorite brands',
    displayOrder: 10,
    contentSource: 'AUTOMATIC' as const,
  },
  {
    name: 'Top Clearance Sales',
    slug: 'top-clearance-sales',
    type: 'FLASH_SALES' as const,
    subtitle: 'Massive clearance offers',
    displayOrder: 11,
    contentSource: 'MANUAL' as const,
  },
  {
    name: 'Top Services',
    slug: 'top-services',
    type: 'SERVICE_GRID' as const,
    subtitle: 'Premium services marketplace',
    displayOrder: 12,
    contentSource: 'AUTOMATIC' as const,
  },
  {
    name: 'Home Theatre',
    slug: 'home-theatre',
    type: 'PRODUCT_GRID' as const,
    subtitle: 'Home entertainment systems',
    displayOrder: 13,
    contentSource: 'MANUAL' as const,
  },
  {
    name: 'Top Express Offers',
    slug: 'top-express-offers',
    type: 'BIG_DEALS' as const,
    subtitle: 'Express delivery exclusive deals',
    displayOrder: 14,
    contentSource: 'MANUAL' as const,
  },
  {
    name: 'New Services',
    slug: 'new-services',
    type: 'SERVICE_GRID' as const,
    subtitle: 'Fresh services just added to Dhream Market',
    displayOrder: 15,
    contentSource: 'AUTOMATIC' as const,
  },
]

export function isManagedSectionSlug(slug: string): slug is ManagedSectionSlug {
  return (MANAGED_SECTION_SLUGS as readonly string[]).includes(slug)
}
