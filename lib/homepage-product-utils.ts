export interface EnterpriseProduct {
  id: string
  name: string
  price: number
  flashSalePrice?: number | null
  flashSaleStart?: string | null
  flashSaleEnd?: string | null
  stock: number
  salesCount?: number
  isSponsored?: boolean
  brand?: string | null
  images: Array<{ id: string; url: string; alt: string | null }>
  store?: { id: string; name: string; isVerified: boolean; logo?: string | null }
  category?: { id: string; name: string; slug?: string }
}

export interface EnterpriseBrand {
  id?: string
  name: string
  slug: string
  logo?: string | null
  brand?: string
  productCount: number
  store?: { id: string; name: string; logo: string | null } | null
}

export interface EnterpriseHomepageData {
  topSelling: EnterpriseProduct[]
}

export interface ManagedHomepageSection {
  id: string
  name: string
  slug: string
  type: string
  subtitle: string | null
  displayOrder: number
  products: EnterpriseProduct[]
  vendors: unknown[]
}

export interface ManagedHomepageData {
  sections: ManagedHomepageSection[]
  brands: EnterpriseBrand[]
}

export function getDiscountPercent(price: number, salePrice: number | null | undefined): number {
  if (!salePrice || salePrice >= price || price <= 0) return 0
  return Math.round(((price - salePrice) / price) * 100)
}

export function getEffectivePrice(product: EnterpriseProduct): number {
  return product.flashSalePrice != null && product.flashSalePrice < product.price
    ? product.flashSalePrice
    : product.price
}

export function dedupeProducts(
  products: EnterpriseProduct[] | undefined | null,
  excludeIds: Set<string>
): EnterpriseProduct[] {
  const list = Array.isArray(products) ? products : []
  return list.filter((p) => p?.id && !excludeIds.has(p.id)).slice(0, 20)
}

export function collectProductIds(products: EnterpriseProduct[]): Set<string> {
  return new Set(products.map((p) => p.id))
}

export const EMPTY_ENTERPRISE_DATA: EnterpriseHomepageData = {
  topSelling: [],
}

export const EMPTY_MANAGED_DATA: ManagedHomepageData = {
  sections: [],
  brands: [],
}

export function sectionsBySlug(sections: ManagedHomepageSection[]): Record<string, ManagedHomepageSection> {
  return sections.reduce<Record<string, ManagedHomepageSection>>((acc, section) => {
    acc[section.slug] = section
    return acc
  }, {})
}

export function normalizeBrand(brand: {
  id?: string
  name?: string
  slug?: string
  logo?: string | null
  brand?: string
  productCount: number
  store?: { id: string; name: string; logo: string | null } | null
}): EnterpriseBrand {
  const name = brand.name || brand.brand || 'Brand'
  return {
    id: brand.id,
    name,
    slug: brand.slug || encodeURIComponent(name),
    logo: brand.logo ?? brand.store?.logo ?? null,
    productCount: brand.productCount,
    store: brand.store ?? null,
  }
}
