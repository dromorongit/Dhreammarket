'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback, type ReactNode, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { EnterpriseProduct, ManagedHomepageSection } from '@/lib/homepage-product-utils'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import ServiceCard from '@/components/ServiceCard'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { MdVerified } from 'react-icons/md'
import { HiShieldCheck } from 'react-icons/hi'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges'
import { TrendingNowSection } from './TrendingNowSection'
import { getBlurDataURL, CARD_IMAGE_SIZES_2COL, CARD_IMAGE_SIZES_4COL, VENDOR_LOGO_SIZES } from '@/lib/image-utils'
import WishlistButton from '@/components/WishlistButton'

export function SectionPill({ label, icon, gradientFrom, gradientVia, gradientTo, textColor = 'text-white' }: { label: string; icon: ReactNode; gradientFrom: string; gradientVia: string; gradientTo: string; textColor?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${gradientFrom} via-${gradientVia} ${gradientTo} ${textColor} text-[11px] font-semibold uppercase tracking-wider shadow-sm`}>
      {icon}
      {label}
    </span>
  )
}

 export function HomepageSectionSkeleton() {
   return (
     <section className="relative py-16 lg:py-24 bg-slate-50">
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
         <div className="mb-10">
           <Skeleton className="h-8 w-48 mb-3" />
           <Skeleton className="h-4 w-64" />
         </div>
         <div className="space-y-4">
           <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
             <div className="flex gap-4">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                   <SkeletonCard />
                 </div>
               ))}
             </div>
           </div>
           <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
             <div className="flex gap-4">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                   <SkeletonCard />
                 </div>
               ))}
             </div>
           </div>
         </div>
       </div>
     </section>
   )
 }

interface HomepageSectionProps {
  section: ManagedHomepageSection
  loading?: boolean
}

 const CompactProductCard = memo(function CompactProductCard({ product, initialIsWishlisted }: { product: EnterpriseProduct; initialIsWishlisted?: boolean }) {
  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
  const badgeData = calculateProductBadges({
    price: product.price,
    flashSalePrice: product.flashSalePrice,
    salesPrice: product.salesPrice,
    dealsPrice: product.dealsPrice,
    stock: product.stock,
    availabilityType: product.availabilityType,
    expectedArrivalDate: product.expectedArrivalDate,
    expectedRestockDate: product.expectedRestockDate,
  })

return (
     <Card variant="elevated" className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0">
       <div className="flex flex-col h-full">
         <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
           <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden -m-px">
<WishlistButton
                productId={product.id}
                initialIsWishlisted={initialIsWishlisted}
                size="sm"
                className="absolute top-2 right-2 z-10"
              />
              {product.images?.[0] ? (
                <Image
                  src={product.images?.[0]?.url}
                  alt={product.images?.[0]?.alt || product.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  fill
                  sizes={CARD_IMAGE_SIZES_2COL}
                  placeholder="blur"
                  blurDataURL={getBlurDataURL()}
                  loading="lazy"
                />
              ) : (
               <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                 <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                 </svg>
               </div>
             )}
             <ProductBadges product={badgeData} />
           </div>
         </Link>
        <div className="p-2 space-y-1 flex-1 flex flex-col">
          <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
            {product.name}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-royal-blue">
              {formatPrice(effectivePrice)}
            </span>
{(badgeData.discountPercentage ?? 0) > 0 && (
               <span className="text-[10px] text-slate-400 line-through">
                 {formatPrice(product.price)}
               </span>
            )}
          </div>
{product.store && (
             <div className="flex items-center gap-1 min-w-0">
               <p className="text-[10px] text-slate-500 truncate">
                 {product.store.name}
               </p>
               {(() => {
                 const badgeInfo = getVendorBadgeInfo((product.store as any).badgeTier)
                 if (badgeInfo) {
                   const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                   return (
                     <MdVerified className={`w-4 h-4 flex-shrink-0 inline-block ${iconColor}`} />
                   )
                 }
                 if (product.store.isVerified) {
                   return (
                     <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0 inline-block" />
                   )
                 }
                 return null
               })()}
             </div>
           )}
        </div>
      </div>
     </Card>
   )
 })

 export function ProductGridSection({ section }: HomepageSectionProps) {
  const products = section.products || []
  const displayProducts = products.slice(0, 20)
  const half = Math.ceil(displayProducts.length / 2)
  const topRowProducts = displayProducts.slice(0, half)
  const bottomRowProducts = displayProducts.slice(half)
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!products.length) return
    try {
      const productIds = products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (displayProducts.length === 0) {
    return (
      <section className="relative py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
              {section.name}
            </h2>
            {section.subtitle && (
              <p className="text-slate-600 mt-2">{section.subtitle}</p>
            )}
          </div>
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            title="No products yet"
            description="Check back soon for new products in this section."
          />
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-600 mt-2">{section.subtitle}</p>
          )}
        </div>

        <div className="space-y-4">
          {topRowProducts.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
              <div className="flex gap-4">
{topRowProducts.map((product) => (
                   <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                     <CompactProductCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
                   </div>
                 ))}
               </div>
             </div>
           )}
           {bottomRowProducts.length > 0 && (
             <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
               <div className="flex gap-4">
                 {bottomRowProducts.map((product) => (
                   <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                     <CompactProductCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href="/marketplace">
<Button variant="outline" size="sm" className="rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all">
               See More
             </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function FeaturedVendorsSection({ section }: HomepageSectionProps) {
  const displayVendors = (section.vendors || []).slice(0, 4)

  if (displayVendors.length === 0) {
    return (
      <section className="relative py-16 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
              {section.name}
            </h2>
            {section.subtitle && (
              <p className="text-slate-600 mt-2">{section.subtitle}</p>
            )}
          </div>
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            title="No vendors yet"
            description="Check back soon for featured vendors."
          />
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-600 mt-2">{section.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayVendors.map((vendor: any) => (
            <Link key={vendor.id} href={`/vendor/${vendor.slug ?? vendor.id}`}>
              <Card variant="elevated" className="group overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="relative h-40 bg-gradient-to-br from-deep-navy to-royal-blue overflow-hidden">
                 {vendor.logo ? (
                     <Image
                       src={vendor.logo}
                       alt={vendor.name}
                       className="absolute inset-0 w-full h-full object-cover opacity-50"
                       fill
                       sizes={CARD_IMAGE_SIZES_4COL}
                       placeholder="blur"
                       blurDataURL={getBlurDataURL()}
                     />
                   ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white opacity-30">
                        {vendor.name?.charAt(0) || 'V'}
                      </span>
                    </div>
                  )}
                  {vendor.isFeatured && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="premium" size="sm">Featured</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 min-w-0">
<div className="flex items-center gap-1 min-w-0">
                     <h3 className="text-lg font-semibold text-deep-navy group-hover:text-royal-blue transition-colors min-w-0 overflow-hidden text-ellipsis line-clamp-1">
                       {truncateVendorName(vendor.name)}
                     </h3>
                     {(() => {
                       const badgeInfo = getVendorBadgeInfo((vendor as any).badgeTier)
                       if (badgeInfo) {
                         const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                         return (
                           <MdVerified className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                         )
                       }
                       if (vendor.isVerified) {
                         return (
                           <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0" />
                         )
                       }
                       return null
                     })()}
                   </div>
                  {vendor.category && (
                    <p className="text-sm text-slate-500 mb-2">{vendor.category.name}</p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      <span className="font-medium">{vendor.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                    <span className="text-slate-500">{vendor.productCount || 0} products</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

const SPECIAL_QUICKLINKS = [
  { name: 'Marketplace', href: '/marketplace', color: 'from-blue-500 to-blue-600', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 00-2.25 2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
  { name: 'New Arrivals', href: '/marketplace?sort=newest', color: 'from-emerald-500 to-emerald-600', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Sell on Dhream Market', href: '/register', color: 'from-royal-blue to-indigo-600', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
]

const DEFAULT_QUICKLINK_ICON = 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
const DEFAULT_QUICKLINK_COLOR = 'from-violet-500 to-purple-600'

const CATEGORY_GRADIENTS = [
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-blue-600',
  'from-slate-600 to-slate-700',
  'from-orange-500 to-red-500',
  'from-teal-500 to-cyan-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
  'from-rose-500 to-red-500',
  'from-sky-500 to-blue-600',
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
]

export function QuicklinksSection({ section }: HomepageSectionProps) {
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('')

  const { data: categoriesData, isLoading: loadingCategories } = useQuery<{ categories: Array<{ id: string; name: string; slug: string }> }>({
    queryKey: ['categories', 'quicklinks'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      return response.json()
    },
  })
  const categories = categoriesData?.categories ?? []

  const { data: vendorsData, isLoading: loadingVendors } = useQuery<{ vendors: any[] }>({
    queryKey: ['vendors', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/vendors')
      if (!response.ok) throw new Error('Failed to fetch vendors')
      return response.json()
    },
  })
  const allVendors = vendorsData?.vendors ?? []
  const loading = loadingCategories || loadingVendors

  // Client-side filtering - no refetch on category change
  // Use categoryId (the direct foreign key) instead of vendor_categories[0].id
  // The API returns vendor_categories as a single object, not an array
  const filteredVendors = selectedVendorCategory
    ? allVendors.filter((vendor) => vendor.categoryId === selectedVendorCategory)
    : allVendors

  const specialNames = SPECIAL_QUICKLINKS.map(s => s.name)
  const dynamicCategoryLinks = categories
    .filter(cat => !specialNames.includes(cat.name))
    .map((cat, index) => ({
      name: cat.name,
      href: `/marketplace?category=${cat.slug}`,
      color: CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length],
      icon: DEFAULT_QUICKLINK_ICON,
    }))

  const quicklinks = [...SPECIAL_QUICKLINKS, ...dynamicCategoryLinks]

  if (loading) {
    return (
      <section className="relative py-16 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
              {section.name}
            </h2>
            {section.subtitle && (
              <p className="text-slate-600 mt-2">{section.subtitle}</p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-600 mt-2">{section.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quicklinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="group"
            >
              <Card variant="elevated" className="p-4 text-center hover:shadow-xl transition-all duration-300 group-hover:-translate-y-0.5">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-deep-navy group-hover:text-royal-blue transition-colors leading-tight">
                  {link.name}
                </h3>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function GadgetDisplaySection({ section }: HomepageSectionProps) {
  const products = (section.products || [])

  const renderProductCard = (product: typeof products[0], isDesktop: boolean) => {
    const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
    const badgeData = calculateProductBadges({
      price: product.price,
      flashSalePrice: product.flashSalePrice,
      salesPrice: product.salesPrice,
      dealsPrice: product.dealsPrice,
      stock: product.stock,
      availabilityType: product.availabilityType,
      expectedArrivalDate: product.expectedArrivalDate,
      expectedRestockDate: product.expectedRestockDate,
    })
    const hasDiscount = (badgeData.discountPercentage ?? 0) > 0
    const widthClass = isDesktop ? 'w-full' : 'snap-start flex-shrink-0 w-[calc(80%-16px)] sm:w-[calc(55%-16px)] md:w-[calc(40%-16px)]'
    const aspectClass = isDesktop ? 'aspect-[4/5]' : 'aspect-[3/4]'

    return (
      <Link key={product.id} href={`/marketplace/product/${product.slug ?? product.id}`} className={widthClass}>
        <Card variant="elevated" className="group flex flex-col overflow-hidden rounded-2xl hover:shadow-2xl transition-all duration-500 h-full">
          <div className={`relative ${aspectClass} bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden`}>
            {product.images?.[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].alt || product.name}
                className="object-cover"
                fill
                sizes={isDesktop ? CARD_IMAGE_SIZES_4COL : CARD_IMAGE_SIZES_2COL}
                placeholder="blur"
                blurDataURL={getBlurDataURL()}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L7.5 9h9l-.621-.621A2.25 2.25 0 0115 8.818V3.104m-9 0A2.25 2.25 0 004.875 5.25h4.5A2.25 2.25 0 0011.25 3.104m-9 0V5.25A2.25 2.25 0 004.875 7.5h4.5A2.25 2.25 0 0011.25 5.25" />
                </svg>
              </div>
            )}
            <ProductBadges product={badgeData} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="premium" size="sm">Tech</Badge>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1 line-clamp-2 leading-tight">{product.name}</h3>
              {product.store && (
                <p className="text-white/80 text-xs sm:text-sm mb-2 truncate">{product.store.name}</p>
              )}
              <div className="flex items-baseline gap-2 mb-3">
                {hasDiscount && (
                  <span className="text-sm text-white/60 line-through">
                    {formatPrice(product.price)}
                  </span>
                )}
                <span className="text-xl sm:text-2xl font-bold text-premium-gold">{formatPrice(effectivePrice)}</span>
              </div>
              <Button variant="gradient" size="sm" className="w-full rounded-full font-semibold">View Deal</Button>
            </div>
          </div>
        </Card>
      </Link>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <SectionPill
            label="PREMIUM TECH"
            gradientFrom="from-amber-500"
            gradientVia="via-yellow-500"
            gradientTo="to-amber-400"
            icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>}
          />
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-600 mt-2">{section.subtitle}</p>
          )}
        </div>

        <div className="hidden lg:grid grid-cols-2 gap-8">
          {products.slice(0, 4).map((product) => renderProductCard(product, true))}
        </div>

        <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {products.slice(0, 6).map((product) => renderProductCard(product, false))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function HeroBannerSection({ section }: HomepageSectionProps) {
  const heroProduct = (section.products || [])[0]

  if (!heroProduct) {
    return (
      <section className="relative py-16 lg:py-24 bg-gradient-to-br from-deep-navy to-royal-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-300">{section.subtitle}</p>
          )}
        </div>
      </section>
    )
  }

  const effectivePrice = heroProduct.dealsPrice ?? heroProduct.salesPrice ?? heroProduct.flashSalePrice ?? heroProduct.price
  const hasDiscount = (heroProduct.dealsPrice ?? heroProduct.salesPrice ?? heroProduct.flashSalePrice) != null

  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-br from-deep-navy to-royal-blue overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-premium-gold/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <Badge variant="premium" className="mb-6">Featured Product</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              {heroProduct.name}
            </h2>
            {heroProduct.store && (
              <p className="text-lg text-slate-300 mb-4">by {heroProduct.store.name}</p>
            )}
            <div className="flex items-baseline gap-3 mb-6">
              {hasDiscount && (
                <span className="text-xl text-white/60 line-through">
                  {formatPrice(heroProduct.price)}
                </span>
              )}
              <p className="text-3xl sm:text-4xl font-bold text-premium-gold">
                {formatPrice(effectivePrice)}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
<Link href={`/marketplace/product/${heroProduct.slug ?? heroProduct.id}`}>
                 <Button variant="gradient" size="lg">
                  Shop Now
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                  Browse All
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square bg-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
              {heroProduct.images?.[0] ? (
                <Image
                  src={heroProduct.images[0].url}
                  alt={heroProduct.images[0].alt || heroProduct.name}
                  className="object-cover"
                  fill
                  sizes={CARD_IMAGE_SIZES_2COL}
                  placeholder="blur"
                  blurDataURL={getBlurDataURL()}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-24 h-24 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function CategoryShowcaseSection({ section }: HomepageSectionProps) {
  const products = section.products || []
  const displayProducts = products.slice(0, 20)
  const half = Math.ceil(displayProducts.length / 2)
  const topRowProducts = displayProducts.slice(0, half)
  const bottomRowProducts = displayProducts.slice(half)

  if (displayProducts.length === 0) {
    return (
      <section className="relative py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
              {section.name}
            </h2>
            {section.subtitle && (
              <p className="text-slate-600 mt-2">{section.subtitle}</p>
            )}
          </div>
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            title="No products yet"
            description="Check back soon for new products in this section."
          />
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-600 mt-2">{section.subtitle}</p>
          )}
        </div>

        <div className="space-y-4">
{topRowProducts.length > 0 && (
             <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
               <div className="flex gap-4">
                 {topRowProducts.map((product) => {
                   const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
                   const hasDiscount = (product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice) != null && product.price > effectivePrice
                   const badgeData = calculateProductBadges({
                     price: product.price,
                     flashSalePrice: product.flashSalePrice,
                     salesPrice: product.salesPrice,
                     dealsPrice: product.dealsPrice,
                     stock: product.stock,
                     availabilityType: product.availabilityType,
                     expectedArrivalDate: product.expectedArrivalDate,
                     expectedRestockDate: product.expectedRestockDate,
                   })
                   return (
                     <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                       <Link href={`/marketplace/product/${product.slug ?? product.id}`}>
                         <Card variant="elevated" className="group overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
                           <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
 {product.images?.[0] ? (
                                 <Image
                                   src={product.images[0].url}
                                   alt={product.images[0].alt || product.name}
                                   className="object-cover"
                                   fill
                                   sizes={CARD_IMAGE_SIZES_2COL}
                                   placeholder="blur"
                                   blurDataURL={getBlurDataURL()}
                                   loading="lazy"
                                 />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                   <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                   </svg>
                                 </div>
                               )}
                             <ProductBadges product={badgeData} />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                             <div className="absolute bottom-0 left-0 right-0 p-3">
                               <h3 className="text-sm font-semibold text-white line-clamp-1">{product.name}</h3>
                              <div className="flex items-baseline gap-1">
                                {hasDiscount && (
                                  <span className="text-xs text-white/60 line-through">
                                    {formatPrice(product.price)}
                                  </span>
                                )}
                                <span className="text-sm font-bold text-premium-gold">{formatPrice(effectivePrice)}</span>
                              </div>
                            </div>
                            </div>
                          </Card>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {bottomRowProducts.length > 0 && (
              <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
                <div className="flex gap-4">
                  {bottomRowProducts.map((product) => {
                    const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
                    const hasDiscount = (product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice) != null && product.price > effectivePrice
                    const badgeData = calculateProductBadges({
                      price: product.price,
                      flashSalePrice: product.flashSalePrice,
                      salesPrice: product.salesPrice,
                      dealsPrice: product.dealsPrice,
                      stock: product.stock,
                      availabilityType: product.availabilityType,
                      expectedArrivalDate: product.expectedArrivalDate,
                      expectedRestockDate: product.expectedRestockDate,
                    })
                    return (
                      <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                        <Link href={`/marketplace/product/${product.slug ?? product.id}`}>
                          <Card variant="elevated" className="group overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
                            <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
 {product.images?.[0] ? (
                                 <Image
                                   src={product.images[0].url}
                                   alt={product.images[0].alt || product.name}
                                   className="object-cover"
                                   fill
                                   sizes={CARD_IMAGE_SIZES_2COL}
                                   placeholder="blur"
                                   blurDataURL={getBlurDataURL()}
                                   loading="lazy"
                                 />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                   <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                   </svg>
                                 </div>
                               )}
                             <ProductBadges product={badgeData} />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                             <div className="absolute bottom-0 left-0 right-0 p-3">
                               <h3 className="text-sm font-semibold text-white line-clamp-1">{product.name}</h3>
                              <div className="flex items-baseline gap-1">
                                {hasDiscount && (
                                  <span className="text-xs text-white/60 line-through">
                                    {formatPrice(product.price)}
                                  </span>
                                )}
                                <span className="text-sm font-bold text-premium-gold">{formatPrice(effectivePrice)}</span>
                              </div>
                            </div>
                            </div>
                          </Card>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
         </div>

         <div className="mt-8 text-center">
           <Link href="/marketplace">
 <Button variant="outline" size="sm" className="rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all">
                See More
              </Button>
           </Link>
         </div>
       </div>
     </section>
   )
 }

export function PromoBannerSection({ section }: HomepageSectionProps) {
  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-r from-royal-blue to-deep-navy overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-premium-gold/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
          {section.name}
        </h2>
        {section.subtitle && (
          <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">{section.subtitle}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/marketplace">
            <Button variant="gradient" size="lg">
              Shop Now
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
              Become a Vendor
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

 const CompactServiceCard = memo(function CompactServiceCard({ service, initialIsWishlisted }: { service: any; initialIsWishlisted?: boolean }) {
  const badgeInfo = service.store ? getVendorBadgeInfo(service.store.badgeTier) : null
  const hasImage = service.thumbnail || (service.images && service.images.length > 0)
  const imageUrl = service.thumbnail || service.images?.[0]?.imageUrl

  return (
    <Card variant="elevated" className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0">
      <div className="flex flex-col h-full">
        <Link href={`/services/${service.slug}`} className="block">
          <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden -m-px">
             {hasImage ? (
               <Image
                 src={imageUrl!}
                 alt={service.title}
                 className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                 fill
                 sizes={CARD_IMAGE_SIZES_2COL}
                 placeholder="blur"
                 blurDataURL={getBlurDataURL()}
                 loading="lazy"
               />
             ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            )}
            {service.category && (
              <div className="absolute top-2 left-2">
                <Badge variant="info" size="sm">{service.category.name}</Badge>
              </div>
            )}
          </div>
        </Link>
        <div className="p-2 space-y-1 flex-1 flex flex-col">
          <Link href={`/services/${service.slug}`} className="block">
            <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
              {service.title}
            </h3>
          </Link>
          <span className="text-[11px] font-bold text-royal-blue">
            {formatPrice(Number(service.startingPrice))}
          </span>
          <div className="flex items-center gap-1 min-w-0">
            {service.store && (
              <p className="text-[10px] text-slate-500 truncate min-w-0">
                {truncateVendorName(service.store.name)}
              </p>
            )}
            {badgeInfo ? (
              <span className={badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'}>
                <MdVerified className="w-4 h-4 flex-shrink-0" />
              </span>
            ) : service.store?.isVerified ? (
              <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0" />
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
})

export function TrendingServicesSection({ section }: HomepageSectionProps) {
  const services = section.services || []
  const displayServices = services.slice(0, 20)
  const half = Math.ceil(displayServices.length / 2)
  const topRowServices = displayServices.slice(0, half)
  const bottomRowServices = displayServices.slice(half)
  const isTopServices = section.slug === 'top-services'

  if (displayServices.length === 0) {
    return (
      <section className="relative py-16 lg:py-24 bg-violet-50/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <SectionPill label="HOT SERVICES" gradientFrom="from-violet-500" gradientVia="via-blue-500" gradientTo="to-violet-400" icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/></svg>} />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
            {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
          </div>
          <EmptyState icon={<svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} title="No services yet" description="Check back soon for new services in this section." />
        </div>
      </section>
    )
  }

  return (
    <section className={`relative py-16 lg:py-24 ${isTopServices ? 'bg-emerald-50/[0.05]' : 'bg-violet-50/[0.05]'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            {isTopServices ? (
              <SectionPill label="TOP SERVICES" gradientFrom="from-emerald-500" gradientVia="via-teal-500" gradientTo="to-emerald-400" icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>} />
            ) : (
              <SectionPill label="HOT SERVICES" gradientFrom="from-violet-500" gradientVia="via-blue-500" gradientTo="to-violet-400" icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/></svg>} />
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
          {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
        </div>
        <div className="space-y-4">
          {topRowServices.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
              <div className="flex gap-4">
                {topRowServices.map((service: any) => (
                  <div key={service.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                    <CompactServiceCard service={service} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {bottomRowServices.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
              <div className="flex gap-4">
                {bottomRowServices.map((service: any) => (
                  <div key={service.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                    <CompactServiceCard service={service} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 text-center">
          <Link href="/services">
            <Button variant="outline" size="sm" className="rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all">See More</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function NewServicesSection({ section }: HomepageSectionProps) {
  const services = section.services || []
  const displayServices = services.slice(0, 20)
  const half = Math.ceil(displayServices.length / 2)
  const topRowServices = displayServices.slice(0, half)
  const bottomRowServices = displayServices.slice(half)

  if (displayServices.length === 0) {
    return (
      <section className="relative py-16 lg:py-24 bg-sky-50/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <SectionPill label="NEW SERVICES" gradientFrom="from-blue-500" gradientVia="via-indigo-500" gradientTo="to-blue-400" icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/></svg>} />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
            {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
          </div>
          <EmptyState icon={<svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} title="No services yet" description="Check back soon for new services in this section." />
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-sky-50/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <SectionPill label="NEW SERVICES" gradientFrom="from-blue-500" gradientVia="via-indigo-500" gradientTo="to-blue-400" icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/></svg>} />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
          {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
        </div>
        <div className="space-y-4">
          {topRowServices.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
              <div className="flex gap-4">
                {topRowServices.map((service: any) => (
                  <div key={service.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                    <CompactServiceCard service={service} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {bottomRowServices.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
              <div className="flex gap-4">
                {bottomRowServices.map((service: any) => (
                  <div key={service.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                    <CompactServiceCard service={service} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 text-center">
          <Link href="/services">
            <Button variant="outline" size="sm" className="rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all">See More</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function VerifiedVendorsSection({ section }: HomepageSectionProps) {
  const displayVendors = (section.vendors || []).filter((v: any) => v.isVerified)

  if (displayVendors.length === 0) {
    return (
      <section className="relative py-16 lg:py-24 bg-sky-50/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
<SectionPill label="VERIFIED" icon={<HiShieldCheck />} gradientFrom="from-sky-500" gradientVia="via-cyan-500" gradientTo="to-cyan-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
            {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
          </div>
          <EmptyState icon={<svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} title="No verified vendors" description="Check back soon for verified vendors." />
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-sky-50/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <SectionPill label="VERIFIED" icon={<HiShieldCheck />} gradientFrom="from-sky-500" gradientVia="via-cyan-500" gradientTo="to-cyan-500" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
          {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
        </div>
        <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
            {displayVendors.map((vendor: any) => (
              <Link key={vendor.id} href={`/vendor/${vendor.slug ?? vendor.id}`}>
                <Card variant="elevated" className="flex-shrink-0 snap-start group hover:shadow-xl transition-all duration-300 p-6 text-center w-[260px] sm:w-[300px] lg:w-[340px] h-full flex flex-col">
                  <div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                    {vendor.logo ? (
                      <Image src={vendor.logo} alt={vendor.name} className="object-cover w-full h-full" fill sizes={VENDOR_LOGO_SIZES} placeholder="blur" blurDataURL={getBlurDataURL()} />
                    ) : (
                      <span className="text-2xl font-bold text-white">
                        {truncateVendorName(vendor.name).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 min-w-0 mb-2">
                    <h3 className="text-lg font-semibold text-deep-navy group-hover:text-royal-blue transition-colors min-w-0 overflow-hidden text-ellipsis line-clamp-1">
                      {truncateVendorName(vendor.name)}
                    </h3>
                    {(() => {
                      const badgeInfo = getVendorBadgeInfo((vendor as any).badgeTier)
                      if (badgeInfo) {
                        const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                        return (
                          <MdVerified className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                        )
                      }
                      if (vendor.isVerified) {
                        return (
                          <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0" />
                        )
                      }
                      return null
                    })()}
                  </div>
                  {vendor.vendor_categories && (
                    <Badge variant="default" size="sm" className="mb-3">
                      {vendor.vendor_categories.name}
                    </Badge>
                  )}
                  <p className="text-sm text-slate-600">
                    {vendor.productCount || 0} products
                  </p>
                </Card>
              </Link>
            ))}
        </div>
      </div>
    </section>
  )
}

export function SponsoredSection({ section }: HomepageSectionProps) {
  const products = section.products || []
  const services = section.services || []
  const allItems = [
    ...products.map((p: any) => ({ ...p, _itemType: 'product' })),
    ...services.map((s: any) => ({ ...s, _itemType: 'service' })),
  ]
  const displayItems = allItems.slice(0, 20)
  const half = Math.ceil(displayItems.length / 2)
  const topRowItems = displayItems.slice(0, half)
  const bottomRowItems = displayItems.slice(half)
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!products.length && !services.length) return
    try {
      const productIds = products.map((p: any) => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [products, services])

  useEffect(() => { fetchWishlistStatus() }, [fetchWishlistStatus])

  if (displayItems.length === 0) {
    return (
      <section className="relative py-16 lg:py-24 bg-yellow-50/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <SectionPill label="SPONSORED" gradientFrom="from-amber-500" gradientVia="via-yellow-500" gradientTo="to-amber-400" icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>} />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
            {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
          </div>
          <EmptyState icon={<svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} title="No items yet" description="Check back soon for featured items in this section." />
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-16 lg:py-24 bg-yellow-50/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <SectionPill label="SPONSORED" gradientFrom="from-amber-500" gradientVia="via-yellow-500" gradientTo="to-amber-400" icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>} />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">{section.name}</h2>
          {section.subtitle && <p className="text-slate-600 mt-2">{section.subtitle}</p>}
        </div>
        <div className="space-y-4">
          {topRowItems.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
              <div className="flex gap-4">
                {topRowItems.map((item: any) => (
                  <div key={item.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                    {item._itemType === 'product' ? (
                      <CompactProductCard product={item} initialIsWishlisted={wishlistedProductIds.has(item.id)} />
                    ) : (
                      <CompactServiceCard service={item} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {bottomRowItems.length > 0 && (
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
              <div className="flex gap-4">
                {bottomRowItems.map((item: any) => (
                  <div key={item.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                    {item._itemType === 'product' ? (
                      <CompactProductCard product={item} initialIsWishlisted={wishlistedProductIds.has(item.id)} />
                    ) : (
                      <CompactServiceCard service={item} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 text-center">
          <Link href="/marketplace">
            <Button variant="outline" size="sm" className="rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all">See More</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

const sectionRenderers: Record<string, React.FC<HomepageSectionProps>> = {
  product_grid: ProductGridSection,
  featured_vendors: FeaturedVendorsSection,
  quicklinks: QuicklinksSection,
  gadget_display: GadgetDisplaySection,
  hero_banner: HeroBannerSection,
  category_showcase: CategoryShowcaseSection,
  promo_banner: PromoBannerSection,
  trending_services: TrendingServicesSection,
  new_services: NewServicesSection,
  verified_vendors: VerifiedVendorsSection,
  sponsored: SponsoredSection,
}

const SECTION_TYPE_ALIASES: Record<string, keyof typeof sectionRenderers> = {
  PRODUCT_GRID: 'product_grid',
  QUICKLINK_CARD_GRID: 'quicklinks',
  LARGE_FEATURE_CARDS: 'gadget_display',
  BRAND_GRID: 'product_grid',
  SERVICE_GRID: 'promo_banner',
  FLASH_SALES: 'product_grid',
  SPONSORED_PRODUCTS: 'sponsored',
  SPONSORED: 'sponsored',
  TOP_SELLING: 'product_grid',
  BIG_DEALS: 'product_grid',
  CLEARANCE_SALES: 'product_grid',
  EXPRESS_OFFERS: 'product_grid',
  TRENDING_NOW: 'product_grid',
  TRENDING_SERVICES: 'trending_services',
  NEW_SERVICES: 'new_services',
  FEATURED_VENDORS: 'verified_vendors',
  product_grid: 'product_grid',
  featured_vendors: 'featured_vendors',
  quicklinks: 'quicklinks',
  gadget_display: 'gadget_display',
  hero_banner: 'hero_banner',
  category_showcase: 'category_showcase',
  promo_banner: 'promo_banner',
  trending_services: 'trending_services',
  new_services: 'new_services',
  verified_vendors: 'verified_vendors',
  sponsored: 'sponsored',
}

function resolveSectionRenderer(type: string): React.FC<HomepageSectionProps> | undefined {
  const key = SECTION_TYPE_ALIASES[type] ?? type
  return sectionRenderers[key]
}

export function HomepageSectionRenderer({ sections }: { sections: ManagedHomepageSection[] }) {
  if (!sections || sections.length === 0) {
    return null
  }

  return (
    <>
      {sections.map((section) => {
        const SectionComponent = resolveSectionRenderer(section.type)
        if (!SectionComponent) return null
        return <SectionComponent key={section.id} section={section} />
      })}
    </>
  )
}