export const MANAGED_SECTION_SLUGS = [
  'trending-now',
  'flash-sales',
  'sponsored-products',
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
    name: 'Sponsored Products',
    slug: 'sponsored-products',
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
    name: 'Flash Sales',
    slug: 'flash-sales',
    type: 'FLASH_SALES' as const,
    subtitle: 'Limited time offers',
    displayOrder: 3,
  },
  {
    name: 'Gadget Display',
    slug: 'gadget-display',
    type: 'LARGE_FEATURE_CARDS' as const,
    subtitle: 'Premium tech deals',
    displayOrder: 4,
  },
  {
    name: 'Big Top Deals',
    slug: 'big-top-deals',
    type: 'BIG_DEALS' as const,
    subtitle: 'Biggest savings on premium products',
    displayOrder: 5,
  },
  {
    name: 'Brand Store',
    slug: 'brand-store',
    type: 'BRAND_GRID' as const,
    subtitle: 'Explore products from your favorite brands',
    displayOrder: 6,
  },
  {
    name: 'Top Clearance Sales',
    slug: 'top-clearance-sales',
    type: 'FLASH_SALES' as const,
    subtitle: 'Massive clearance offers',
    displayOrder: 7,
  },
  {
    name: 'Top Services',
    slug: 'top-services',
    type: 'SERVICE_GRID' as const,
    subtitle: 'Premium services marketplace',
    displayOrder: 8,
  },
  {
    name: 'Home Theatre',
    slug: 'home-theatre',
    type: 'PRODUCT_GRID' as const,
    subtitle: 'Home entertainment systems',
    displayOrder: 9,
  },
  {
    name: 'Top Express Offers',
    slug: 'top-express-offers',
    type: 'BIG_DEALS' as const,
    subtitle: 'Express delivery exclusive deals',
    displayOrder: 10,
  },
]

export function isManagedSectionSlug(slug: string): slug is ManagedSectionSlug {
  return (MANAGED_SECTION_SLUGS as readonly string[]).includes(slug)
}
