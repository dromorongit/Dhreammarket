export const MANAGED_SECTION_SLUGS = [
  'flash-sales',
  'sponsored-products',
  'gadget-display',
  'big-top-deals',
  'brand-store',
] as const

export type ManagedSectionSlug = (typeof MANAGED_SECTION_SLUGS)[number]

export const DEFAULT_HOMEPAGE_SECTIONS = [
  {
    name: 'Flash Sales',
    slug: 'flash-sales',
    type: 'FLASH_SALES' as const,
    subtitle: 'Limited time offers',
    displayOrder: 1,
  },
  {
    name: 'Sponsored Products',
    slug: 'sponsored-products',
    type: 'SPONSORED_PRODUCTS' as const,
    subtitle: 'Featured by vendors',
    displayOrder: 2,
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
    displayOrder: 6,
  },
  {
    name: 'Brand Store',
    slug: 'brand-store',
    type: 'BRAND_GRID' as const,
    subtitle: 'Explore products from your favorite brands',
    displayOrder: 7,
  },
]

export function isManagedSectionSlug(slug: string): slug is ManagedSectionSlug {
  return (MANAGED_SECTION_SLUGS as readonly string[]).includes(slug)
}
