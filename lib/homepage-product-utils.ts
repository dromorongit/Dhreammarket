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
  brand: string
  productCount: number
  store?: { id: string; name: string; logo: string | null } | null
}

export interface EnterpriseHomepageData {
  flashSales: EnterpriseProduct[]
  sponsoredProducts: EnterpriseProduct[]
  gadgetProducts: EnterpriseProduct[]
  topSelling: EnterpriseProduct[]
  bigDeals: EnterpriseProduct[]
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
  flashSales: [],
  sponsoredProducts: [],
  gadgetProducts: [],
  topSelling: [],
  bigDeals: [],
  brands: [],
}
