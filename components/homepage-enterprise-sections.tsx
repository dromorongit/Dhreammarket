'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { MdVerified } from 'react-icons/md'
import {
  type EnterpriseProduct,
  type EnterpriseBrand,
  type EnterpriseHomepageData,
  getDiscountPercent,
  getEffectivePrice,
  dedupeProducts,
  collectProductIds,
  EMPTY_ENTERPRISE_DATA,
} from '@/lib/homepage-product-utils'

export function useEnterpriseHomepageData() {
  const [data, setData] = useState<EnterpriseHomepageData>(EMPTY_ENTERPRISE_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/homepage/enterprise', { cache: 'no-store' })
        if (response.ok) {
          const json = await response.json()
          setData({
            flashSales: Array.isArray(json.flashSales) ? json.flashSales : [],
            sponsoredProducts: Array.isArray(json.sponsoredProducts) ? json.sponsoredProducts : [],
            gadgetProducts: Array.isArray(json.gadgetProducts) ? json.gadgetProducts : [],
            topSelling: Array.isArray(json.topSelling) ? json.topSelling : [],
            bigDeals: Array.isArray(json.bigDeals) ? json.bigDeals : [],
            brands: Array.isArray(json.brands) ? json.brands : [],
          })
        }
      } catch (error) {
        console.error('Error fetching enterprise homepage data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return { data, loading }
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now()
      if (diff <= 0) {
        setLabel('Ended')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLabel(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endTime])

  return (
    <span className="font-mono text-[10px] font-bold" suppressHydrationWarning>
      {label ?? '--:--:--'}
    </span>
  )
}

function ProductImage({ product, className }: { product: EnterpriseProduct; className?: string }) {
  const image = product?.images?.[0]
  if (image) {
    return (
      <img
        src={image.url}
        alt={image.alt || product.name}
        className={className}
        loading="lazy"
      />
    )
  }
  return (
    <div className={`flex items-center justify-center bg-slate-100 ${className ?? ''}`}>
      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  )
}

function ResponsiveProductGrid({
  products,
  renderCard,
  seeMoreHref = '/marketplace',
}: {
  products: EnterpriseProduct[]
  renderCard: (product: EnterpriseProduct) => ReactNode
  seeMoreHref?: string
}) {
  if (products.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:gap-6 sm:hidden">
        {products.slice(0, 12).map((product) => renderCard(product))}
      </div>
      <div className="hidden sm:grid lg:hidden sm:grid-cols-3 gap-4 lg:gap-6">
        {products.slice(0, 15).map((product) => renderCard(product))}
      </div>
      <div className="hidden lg:grid lg:grid-cols-5 gap-4 lg:gap-6">
        {products.map((product) => renderCard(product))}
      </div>
      <div className="mt-8 text-center">
        <Link href={seeMoreHref}>
          <Button variant="outline" size="lg" className="rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all">
            See More
          </Button>
        </Link>
      </div>
    </>
  )
}

function SectionHeader({
  badge,
  title,
  subtitle,
  dark = false,
}: {
  badge?: string
  title: string
  subtitle?: string
  dark?: boolean
}) {
  return (
    <div className="mb-10">
      {badge && (
        <Badge variant={dark ? 'premium' : 'danger'} className="mb-3">
          {badge}
        </Badge>
      )}
      <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${dark ? 'text-white' : 'text-deep-navy'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-2 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>
      )}
    </div>
  )
}

function EnterpriseSectionSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <section className={`relative py-16 lg:py-24 ${dark ? 'bg-slate-900' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className={`h-6 w-32 rounded-full mb-3 ${dark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <div className={`h-8 w-48 rounded ${dark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
          {[...Array(10)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FlashSaleCard({ product }: { product: EnterpriseProduct }) {
  const discount = getDiscountPercent(product.price, product.flashSalePrice)
  const salePrice = product.flashSalePrice ?? product.price

  return (
    <Card
      key={product.id}
      variant="elevated"
      className="group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0"
    >
      <Link href={`/marketplace/product/${product.id}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          <ProductImage
            product={product}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {discount > 0 && (
            <div className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
              -{discount}%
            </div>
          )}
          {product.flashSaleEnd && (
            <div className="absolute top-2 right-2 bg-deep-navy/90 text-white px-2 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <CountdownTimer endTime={product.flashSaleEnd} />
            </div>
          )}
        </div>
      </Link>
      <div className="p-2.5 space-y-1 flex-1 flex flex-col">
        <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
          {product.name}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-rose-600">{formatPrice(salePrice)}</span>
          {discount > 0 && (
            <span className="text-[10px] text-slate-400 line-through">{formatPrice(product.price)}</span>
          )}
        </div>
        {product.store && (
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 truncate">{product.store.name}</p>
            {product.store.isVerified && (
              <MdVerified className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function SponsoredCard({ product }: { product: EnterpriseProduct }) {
  return (
    <Card
      key={product.id}
      variant="elevated"
      className="group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0"
    >
      <Link href={`/marketplace/product/${product.id}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          <ProductImage
            product={product}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
            Sponsored
          </div>
        </div>
      </Link>
      <div className="p-2.5 space-y-1 flex-1 flex flex-col">
        <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
          {product.name}
        </h3>
        <span className="text-[11px] font-bold text-royal-blue">{formatPrice(getEffectivePrice(product))}</span>
        {product.store && (
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 truncate">{product.store.name}</p>
            {product.store.isVerified && (
              <MdVerified className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function DealCard({ product }: { product: EnterpriseProduct }) {
  const discount = getDiscountPercent(product.price, product.flashSalePrice)
  const salePrice = product.flashSalePrice ?? product.price

  return (
    <Card
      key={product.id}
      variant="elevated"
      className="group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0 border-2 border-transparent hover:border-rose-200"
    >
      <Link href={`/marketplace/product/${product.id}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          <ProductImage
            product={product}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {discount > 0 && (
            <div className="absolute top-2 left-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-lg">
              SAVE {discount}%
            </div>
          )}
        </div>
      </Link>
      <div className="p-2.5 space-y-1 flex-1 flex flex-col">
        <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
          {product.name}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-rose-600">{formatPrice(salePrice)}</span>
          {discount > 0 && (
            <span className="text-[11px] text-slate-400 line-through">{formatPrice(product.price)}</span>
          )}
        </div>
        {product.store && (
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 truncate">{product.store.name}</p>
            {product.store.isVerified && (
              <MdVerified className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function StandardCard({ product, badge }: { product: EnterpriseProduct; badge?: string }) {
  return (
    <Card
      key={product.id}
      variant="elevated"
      className="group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0"
    >
      <Link href={`/marketplace/product/${product.id}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          <ProductImage
            product={product}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {badge && (
            <div className="absolute top-2 left-2 bg-royal-blue text-white text-[10px] font-bold px-2 py-1 rounded-full">
              {badge}
            </div>
          )}
        </div>
      </Link>
      <div className="p-2.5 space-y-1 flex-1 flex flex-col">
        <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
          {product.name}
        </h3>
        <span className="text-[11px] font-bold text-royal-blue">{formatPrice(getEffectivePrice(product))}</span>
        {product.store && (
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 truncate">{product.store.name}</p>
            {product.store.isVerified && (
              <MdVerified className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export function FlashSalesSection({
  products,
  loading,
}: {
  products: EnterpriseProduct[]
  loading?: boolean
}) {
  if (loading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-b from-rose-50 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          badge="Limited Time"
          title="Flash Sales"
          subtitle="Grab these deals before time runs out"
        />
        <ResponsiveProductGrid
          products={products}
          seeMoreHref="/marketplace?sort=deals"
          renderCard={(product) => <FlashSaleCard key={product.id} product={product} />}
        />
      </div>
    </section>
  )
}

export function SponsoredProductsSection({
  products,
  loading,
}: {
  products: EnterpriseProduct[]
  loading?: boolean
}) {
  if (loading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section className="relative py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          badge="Promoted"
          title="Sponsored Products"
          subtitle="Hand-picked products from our top vendors"
        />
        <ResponsiveProductGrid
          products={products}
          renderCard={(product) => <SponsoredCard key={product.id} product={product} />}
        />
      </div>
    </section>
  )
}

export function EnterpriseGadgetDisplaySection({
  products,
  loading,
}: {
  products: EnterpriseProduct[]
  loading?: boolean
}) {
  if (loading) return <EnterpriseSectionSkeleton dark />
  if (!products.length) return null

  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-br from-slate-900 via-deep-navy to-slate-900 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          badge="Premium Tech"
          title="Gadget Display"
          subtitle="Latest phones, laptops, accessories & gaming gear"
          dark
        />

        {/* Desktop grid */}
        <div className="hidden lg:grid grid-cols-2 gap-6">
          {products.slice(0, 4).map((product) => (
            <Link key={product.id} href={`/marketplace/product/${product.id}`}>
              <Card variant="elevated" className="group overflow-hidden rounded-2xl hover:shadow-2xl transition-all duration-500 bg-slate-800/50 border border-slate-700/50">
                <div className="relative aspect-[16/9] bg-slate-800 overflow-hidden">
                  <ProductImage
                    product={product}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <Badge variant="premium" size="sm" className="mb-2">Tech</Badge>
                    <h3 className="text-xl font-bold text-white mb-1 line-clamp-1">{product.name}</h3>
                    {product.store && (
                      <p className="text-white/70 text-sm mb-2">{product.store.name}</p>
                    )}
                    <span className="text-2xl font-bold text-premium-gold">{formatPrice(getEffectivePrice(product))}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Mobile & tablet horizontal scroll */}
        <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {products.slice(0, 20).map((product) => (
              <Link key={product.id} href={`/marketplace/product/${product.id}`} className="w-64 flex-shrink-0">
                <Card variant="elevated" className="group overflow-hidden rounded-2xl hover:shadow-xl transition-all duration-300 bg-slate-800/50 border border-slate-700/50">
                  <div className="relative aspect-[4/3] bg-slate-800 overflow-hidden">
                    <ProductImage
                      product={product}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">{product.name}</h3>
                      <span className="text-lg font-bold text-premium-gold">{formatPrice(getEffectivePrice(product))}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/marketplace?category=electronics">
            <Button variant="outline" size="lg" className="rounded-2xl px-8 py-3 font-semibold border-white/30 text-white hover:bg-white/10">
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function TopSellingSection({
  products,
  loading,
}: {
  products: EnterpriseProduct[]
  loading?: boolean
}) {
  if (loading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section className="relative py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          badge="Best Sellers"
          title="Top-Selling Items"
          subtitle="Most popular products loved by our customers"
        />
        <ResponsiveProductGrid
          products={products}
          seeMoreHref="/marketplace?sort=popular"
          renderCard={(product) => (
            <StandardCard key={product.id} product={product} badge={product.salesCount ? `${product.salesCount} sold` : undefined} />
          )}
        />
      </div>
    </section>
  )
}

export function BigTopDealsSection({
  products,
  loading,
}: {
  products: EnterpriseProduct[]
  loading?: boolean
}) {
  if (loading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          badge="Hot Deals"
          title="Big Top Deals"
          subtitle="Biggest savings on premium products"
        />
        <ResponsiveProductGrid
          products={products}
          seeMoreHref="/marketplace?sort=deals"
          renderCard={(product) => <DealCard key={product.id} product={product} />}
        />
      </div>
    </section>
  )
}

function BrandCard({ brand }: { brand: EnterpriseBrand }) {
  const logo = brand.store?.logo

  return (
    <Link href={`/marketplace?brand=${encodeURIComponent(brand.brand)}`}>
      <Card variant="elevated" className="group p-5 text-center hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-2xl h-full">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform">
          {logo ? (
            <img src={logo} alt={brand.brand} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-royal-blue">{brand.brand.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-deep-navy group-hover:text-royal-blue transition-colors line-clamp-1">
          {brand.brand}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{brand.productCount} products</p>
        {brand.store && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{truncateVendorName(brand.store.name)}</p>
        )}
      </Card>
    </Link>
  )
}

export function BrandStoreSection({
  brands,
  loading,
}: {
  brands: EnterpriseBrand[]
  loading?: boolean
}) {
  if (loading) return <EnterpriseSectionSkeleton />
  if (!brands.length) return null

  return (
    <section className="relative py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          badge="Shop Brands"
          title="Brand Store"
          subtitle="Explore products from your favorite brands"
        />

        {/* Mobile horizontal scroll */}
        <div className="md:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {brands.map((brand) => (
              <div key={brand.brand} className="w-36 flex-shrink-0">
                <BrandCard brand={brand} />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {brands.map((brand) => (
            <BrandCard key={brand.brand} brand={brand} />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/marketplace">
            <Button variant="outline" size="lg" className="rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all">
              Browse All Brands
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function buildEnterpriseSections(data: EnterpriseHomepageData) {
  const flashSales = dedupeProducts(data.flashSales, new Set())
  const shownIds = collectProductIds(flashSales)

  const sponsoredProducts = dedupeProducts(data.sponsoredProducts, shownIds)
  sponsoredProducts.forEach((p) => shownIds.add(p.id))

  const gadgetProducts = dedupeProducts(data.gadgetProducts, shownIds)
  gadgetProducts.forEach((p) => shownIds.add(p.id))

  const topSelling = dedupeProducts(data.topSelling, shownIds)
  topSelling.forEach((p) => shownIds.add(p.id))

  const bigDeals = dedupeProducts(data.bigDeals, shownIds)

  return {
    flashSales,
    sponsoredProducts,
    gadgetProducts,
    topSelling,
    bigDeals,
    brands: (data.brands || []).slice(0, 20),
    excludeFromFeaturedIds: shownIds,
  }
}
