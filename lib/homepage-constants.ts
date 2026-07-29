export const MANAGED_SECTION_SLUGS = [
  'trending-now',
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
] as const

export type ManagedSectionSlug = (typeof MANAGED_SECTION_SLUGS)[number]

export const DEFAULT_HOMEPAGE_SECTIONS = [
  {
    name: 'Sponsored',
    slug: 'sponsored',
    type: 'SPONSORED_PRODUCTS' as const,
    subtitle: 'Featured by vendors',
    displayOrder: 1,
  },
  {
    name: 'Trending Now',
    slug: 'trending-now',
    type: 'TRENDING_NOW' as const,
    subtitle: 'Discover what\'s currently trending across Dhream Market.',
    displayOrder: 2,
  },
  {
    name: 'Trending Services',
    slug: 'trending-services',
    type: 'TRENDING_NOW' as const,
    subtitle: 'Discover what\'s currently trending in services.',
    displayOrder: 3,
  },
  {
    name: 'Verified Vendors',
    slug: 'verified-vendors',
    type: 'FEATURED_VENDORS' as const,
    subtitle: 'Trusted and verified vendors you can rely on.',
    displayOrder: 4,
  },
  {
    name: 'Flash Sales',
    slug: 'flash-sales',
    type: 'FLASH_SALES' as const,
    subtitle: 'Limited time offers',
    displayOrder: 5,
  },
  {
    name: 'Gadget Display',
    slug: 'gadget-display',
    type: 'LARGE_FEATURE_CARDS' as const,
    subtitle: 'Premium tech deals',
    displayOrder: 6,
  },
  {
    name: 'Big Top Deals',
    slug: 'big-top-deals',
    type: 'BIG_DEALS' as const,
    subtitle: 'Biggest savings on premium products',
    displayOrder: 7,
  },
  {
    name: 'Brand Store',
    slug: 'brand-store',
    type: 'BRAND_GRID' as const,
    subtitle: 'Explore products from your favorite brands',
    displayOrder: 8,
  },
  {
    name: 'Top Clearance Sales',
    slug: 'top-clearance-sales',
    type: 'FLASH_SALES' as const,
    subtitle: 'Massive clearance offers',
    displayOrder: 9,
  },
  {
    name: 'Top Services',
    slug: 'top-services',
    type: 'SERVICE_GRID' as const,
    subtitle: 'Premium services marketplace',
    displayOrder: 10,
  },
  {
    name: 'Home Theatre',
    slug: 'home-theatre',
    type: 'PRODUCT_GRID' as const,
    subtitle: 'Home entertainment systems',
    displayOrder: 11,
  },
  {
    name: 'Top Express Offers',
    slug: 'top-express-offers',
    type: 'BIG_DEALS' as const,
    subtitle: 'Express delivery exclusive deals',
    displayOrder: 12,
  },
]

export function isManagedSectionSlug(slug: string): slug is ManagedSectionSlug {
  return (MANAGED_SECTION_SLUGS as readonly string[]).includes(slug)
}
