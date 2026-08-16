'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, type ReactNode, useCallback, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge'
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatPrice } from '@/lib/currency';
import { MdVerified } from 'react-icons/md';
import { TbSparkles, TbCompass } from 'react-icons/tb';
import { getVendorBadgeInfo } from '@/lib/vendor-badge';
import WishlistButton from '@/components/WishlistButton';
import { type EnterpriseProduct, type EnterpriseBrand, type EnterpriseHomepageData, getDiscountPercent, getEffectivePrice, getDiscountedPrice, dedupeProducts, collectProductIds, normalizeBrand, EMPTY_ENTERPRISE_DATA } from '@/lib/homepage-product-utils'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges';
import { ProductStockIndicator } from '@/components/ProductStockIndicator';
import { TrendingNowSection } from './TrendingNowSection';
import { SectionPill } from './homepage-sections';
import CountdownTimer from '@/components/CountdownTimer';
import { getBlurDataURL, CARD_IMAGE_SIZES_5COL, CARD_IMAGE_SIZES_2COL, CARD_IMAGE_SIZES_4COL, VENDOR_LOGO_SIZES } from '@/lib/image-utils';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export function useEnterpriseHomepageData() {
  const { data, isLoading } = useQuery<{ topSelling: EnterpriseProduct[] }>({
    queryKey: ['homepage-enterprise'],
    queryFn: async () => {
      const response = await fetch('/api/homepage/enterprise', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Failed to fetch enterprise homepage data');
      return response.json();
    },
  });

  const enterpriseData = data ?? EMPTY_ENTERPRISE_DATA;

  return { data: enterpriseData, loading: isLoading };
}

function ProductImage({
  product,
  className,
  sizes = CARD_IMAGE_SIZES_5COL,
}: {
  product: EnterpriseProduct;
  className?: string;
  sizes?: string;
}) {
  const image = product?.images?.[0];
  if (image) {
    return (
      <Image
        src={image.url}
        alt={image.alt || product.name}
        className={className}
        fill
        loading='lazy'
        sizes={sizes}
        placeholder="blur"
        blurDataURL={getBlurDataURL()}
      />
    );
  }
  return (
    <div
      className='flex items-center justify-center bg-slate-100'
    >
      <svg
        className='w-8 h-8 text-slate-300'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
        />
      </svg>
    </div>
  );
}

function ProductRail({
  products,
  renderCard,
}: {
  products: EnterpriseProduct[];
  renderCard: (product: EnterpriseProduct) => ReactNode;
}) {
  if (products.length === 0) return null;

  const half = Math.ceil(products.length / 2);
  const topRowProducts = products.slice(0, half);
  const bottomRowProducts = products.slice(half);

  return (
    <div className="space-y-4">
      {topRowProducts.length > 0 && (
        <div className="relative">
          <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
            <div className="flex gap-4">
              {topRowProducts.map((product) => renderCard(product))}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              const container = e.currentTarget.previousElementSibling as HTMLDivElement
              container.scrollBy({ left: -300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll left"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              const container = e.currentTarget.previousElementSibling?.previousElementSibling as HTMLDivElement
              container.scrollBy({ left: 300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll right"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
      {bottomRowProducts.length > 0 && (
        <div className="relative">
          <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
            <div className="flex gap-4">
              {bottomRowProducts.map((product) => renderCard(product))}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              const container = e.currentTarget.previousElementSibling as HTMLDivElement
              container.scrollBy({ left: -300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll left"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              const container = e.currentTarget.previousElementSibling?.previousElementSibling as HTMLDivElement
              container.scrollBy({ left: 300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll right"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  badge,
  title,
  subtitle,
  dark = false,
  countdown,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
  countdown?: React.ReactNode;
}) {
  return (
    <div className='mb-6'>
      {badge && (
        <Badge variant={dark ? 'premium' : 'danger'} className='mb-3'>
          {badge}
        </Badge>
      )}
      <div className='bg-cream py-3 -mx-4 sm:-mx-6 lg:-mx-8'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3 flex-wrap'>
            <h2
              className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy`}
            >
              {title}
            </h2>
            {countdown}
          </div>
          {subtitle && (
            <p className={`mt-1 text-[11px] text-deep-navy`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EnterpriseSectionSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <section
      className={
        dark ? 'relative py-10 lg:py-14 bg-slate-900' : 'relative py-10 lg:py-14'
      }
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='mb-6'>
          <div
            className='h-6 w-32 rounded-full mb-3'
          />
          <div
            className='h-8 w-48 rounded'
          />
        </div>
        <div className='space-y-4'>
          <div className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4'>
            <div className='flex gap-4'>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
                  <SkeletonCard />
                </div>
              ))}
            </div>
          </div>
          <div className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4'>
            <div className='flex gap-4'>
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
  );
}

function FlashSaleCard({ product, initialIsWishlisted }: { product: EnterpriseProduct; initialIsWishlisted?: boolean }) {
   const discountedPrice = getDiscountedPrice(product)
   const salePrice = discountedPrice ?? product.price
   const discount = getDiscountPercent(product.price, discountedPrice ?? undefined)

    return (
      <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <Card
            variant='elevated'
             className='group flex flex-col overflow-hidden rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full p-0 w-full border border-gold/20 hover:border-gold/50'
          >
            <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
              <WishlistButton
                productId={product.id}
                initialIsWishlisted={initialIsWishlisted}
                size="sm"
                className="absolute top-2 right-2 z-10"
              />
               <ProductImage
                 product={product}
                 className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
               />
                <div className='absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity duration-300'>
                <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='inline-flex items-center justify-center bg-black/70 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors'>
                  Quick View
                </Link>
              </div>
              <ProductBadges product={calculateProductBadges({
                price: product.price,
                flashSalePrice: product.flashSalePrice,
                salesPrice: product.salesPrice,
                dealsPrice: product.dealsPrice,
                stock: product.stock,
                availabilityType: product.availabilityType,
                expectedArrivalDate: product.expectedArrivalDate,
                expectedRestockDate: product.expectedRestockDate,
              })} />
            </div>
            <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
              <h3 className='text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors leading-tight'>
                {product.name}
              </h3>
              <div className='flex items-center gap-1.5 flex-wrap'>
                <span className='text-[11px] font-bold text-rose-600'>
                  {formatPrice(salePrice)}
                </span>
                {discount > 0 && (
                  <span className='text-[10px] text-slate-400 line-through'>
                    {formatPrice(product.price)}
                  </span>
                )}
              </div>
              {product.store && (
                <div className='flex items-center gap-1 min-w-0'>
                  <p className='text-[10px] text-slate-500 truncate'>
                    {product.store.name}
                  </p>
                {(() => {
                   const badgeInfo = getVendorBadgeInfo((product.store as any).badgeTier)
                   if (badgeInfo) {
                     const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                     return (
                       <MdVerified className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
                     )
                   }
                   if (product.store.isVerified) {
                     return (
                       <MdVerified className='w-3.5 h-3.5 text-sky-500 flex-shrink-0' />
                     )
                   }
                   return null
                 })()}
                </div>
              )}
              <ProductStockIndicator stock={product.stock} reservedQuantity={(product as any).reservedQuantity} availabilityType={product.availabilityType} />
            </div>
          </Card>
        </Link>
      </div>
    )
  }

function SponsoredCard({ product, initialIsWishlisted }: { product: EnterpriseProduct; initialIsWishlisted?: boolean }) {
   const discountedPrice = getDiscountedPrice(product)

    return (
      <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <Card
            variant='elevated'
             className='group flex flex-col overflow-hidden rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full p-0 w-full border border-gold/20 hover:border-gold/50'
          >
            <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
              <WishlistButton
                productId={product.id}
                initialIsWishlisted={initialIsWishlisted}
                size="sm"
                className="absolute top-2 right-2 z-10"
              />
              <ProductImage
                product={product}
                className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
              />
               <div className='absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity duration-300'>
                 <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='inline-flex items-center justify-center bg-black/70 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors'>
                   Quick View
                 </Link>
               </div>
               <ProductBadges product={calculateProductBadges({
                 price: product.price,
                 flashSalePrice: product.flashSalePrice,
                 salesPrice: product.salesPrice,
                 dealsPrice: product.dealsPrice,
                 stock: product.stock,
                 availabilityType: product.availabilityType,
                 expectedArrivalDate: product.expectedArrivalDate,
                 expectedRestockDate: product.expectedRestockDate,
                 isSponsored: true,
               })} />
             </div>
             <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
               <h3 className='text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors leading-tight'>
                 {product.name}
               </h3>
               <div className='flex items-center gap-1.5 flex-wrap'>
                 <span className='text-[11px] font-bold text-royal-blue'>
                   {formatPrice(getEffectivePrice(product))}
                 </span>
                {discountedPrice && discountedPrice < product.price && (
                  <span className='text-[10px] text-slate-400 line-through'>
                    {formatPrice(product.price)}
                  </span>
                )}
              </div>
              {product.store && (
                <div className='flex items-center gap-1 min-w-0'>
                  <p className='text-[10px] text-slate-500 truncate'>
                    {product.store.name}
                  </p>
                {(() => {
                   const badgeInfo = getVendorBadgeInfo((product.store as any).badgeTier)
                   if (badgeInfo) {
                     const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                     return (
                       <MdVerified className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
                     )
                   }
                   if (product.store.isVerified) {
                     return (
                       <MdVerified className='w-3.5 h-3.5 text-sky-500 flex-shrink-0' />
                     )
                   }
                   return null
                 })()}
                </div>
              )}
              <ProductStockIndicator stock={product.stock} reservedQuantity={(product as any).reservedQuantity} availabilityType={product.availabilityType} />
            </div>
          </Card>
        </Link>
      </div>
    )
  }

function DealCard({ product, initialIsWishlisted }: { product: EnterpriseProduct; initialIsWishlisted?: boolean }) {
   const discountedPrice = getDiscountedPrice(product)
    const salePrice = discountedPrice ?? product.price

    return (
      <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <Card
            variant='elevated'
             className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0 border border-gold/20 hover:border-gold/50 w-full'
          >
            <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
              <WishlistButton
                productId={product.id}
                initialIsWishlisted={initialIsWishlisted}
                size="sm"
                className="absolute top-2 right-2 z-10"
              />
               <ProductImage
                 product={product}
                 className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
               />
                <div className='absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity duration-300'>
                  <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='inline-flex items-center justify-center bg-black/70 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors'>
                    Quick View
                  </Link>
                </div>
                <ProductBadges product={calculateProductBadges({
                  price: product.price,
                  flashSalePrice: product.flashSalePrice,
                  salesPrice: product.salesPrice,
                  dealsPrice: product.dealsPrice,
                  stock: product.stock,
                  reservedQuantity: (product as any).reservedQuantity,
                  availabilityType: product.availabilityType,
                  expectedArrivalDate: product.expectedArrivalDate,
                  expectedRestockDate: product.expectedRestockDate,
                })} />
              </div>
              <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
                <h3 className='text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors leading-tight'>
                  {product.name}
                </h3>
                <div className='flex items-center gap-1.5 flex-wrap'>
                  <span className='text-sm font-bold text-rose-600'>
                    {formatPrice(salePrice)}
                  </span>
                 {discountedPrice && discountedPrice < product.price && (
                   <span className='text-[11px] text-slate-400 line-through'>
                     {formatPrice(product.price)}
                   </span>
                 )}
               </div>
              {product.store && (
                <div className='flex items-center gap-1 min-w-0'>
                  <p className='text-[10px] text-slate-500 truncate'>
                    {product.store.name}
                  </p>
                {(() => {
                   const badgeInfo = getVendorBadgeInfo((product.store as any).badgeTier)
                   if (badgeInfo) {
                     const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                     return (
                       <MdVerified className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
                     )
                   }
                   if (product.store.isVerified) {
                     return (
                       <MdVerified className='w-3.5 h-3.5 text-sky-500 flex-shrink-0' />
                     )
                   }
                   return null
                 })()}
                </div>
              )}
              <ProductStockIndicator stock={product.stock} reservedQuantity={(product as any).reservedQuantity} availabilityType={product.availabilityType} />
            </div>
          </Card>
        </Link>
      </div>
    )
  }

function StandardCard({
   product,
   badge,
   initialIsWishlisted,
  }: {
   product: EnterpriseProduct;
   badge?: string;
   initialIsWishlisted?: boolean;
  }) {
    return (
      <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <Card
            variant='elevated'
             className='group flex flex-col overflow-hidden rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full p-0 w-full border border-gold/20 hover:border-gold/50'
          >
            <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
              <WishlistButton
                productId={product.id}
                initialIsWishlisted={initialIsWishlisted}
                size="sm"
                className="absolute top-2 right-2 z-10"
              />
              <ProductImage
                product={product}
                className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
              />
               <div className='absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity duration-300'>
                 <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='inline-flex items-center justify-center bg-black/70 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors'>
                   Quick View
                 </Link>
               </div>
               <ProductBadges product={calculateProductBadges({
                 price: product.price,
                 flashSalePrice: product.flashSalePrice,
                 salesPrice: product.salesPrice,
                 dealsPrice: product.dealsPrice,
                 stock: product.stock,
                 availabilityType: product.availabilityType,
                 expectedArrivalDate: product.expectedArrivalDate,
                 expectedRestockDate: product.expectedRestockDate,
               })} />
             </div>
             <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
               <h3 className='text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors leading-tight'>
                 {product.name}
               </h3>
               <div className='flex items-center gap-1.5 flex-wrap'>
                 <span className='text-[11px] font-bold text-royal-blue'>
                   {formatPrice(getEffectivePrice(product))}
                 </span>
                 {getDiscountedPrice(product) && getDiscountedPrice(product)! < product.price && (
                   <span className='text-[10px] text-slate-400 line-through'>
                     {formatPrice(product.price)}
                   </span>
                 )}
               </div>
              {product.store && (
                <div className='flex items-center gap-1 min-w-0'>
                  <p className='text-[10px] text-slate-500 truncate'>
                    {product.store.name}
                  </p>
                {(() => {
                   const badgeInfo = getVendorBadgeInfo((product.store as any).badgeTier)
                   if (badgeInfo) {
                     const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                     return (
                       <MdVerified className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
                     )
                   }
                   if (product.store.isVerified) {
                     return (
                       <MdVerified className='w-3.5 h-3.5 text-sky-500 flex-shrink-0' />
                     )
                   }
                   return null
                 })()}
                </div>
              )}
              <ProductStockIndicator stock={product.stock} reservedQuantity={(product as any).reservedQuantity} availabilityType={product.availabilityType} />
            </div>
          </Card>
        </Link>
      </div>
    )
  }

export function FlashSalesSection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!section?.products?.length) return
    try {
      const productIds = section.products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [section?.products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (loading) return <EnterpriseSectionSkeleton />
  const products = section.products ?? [];
  if (!products.length) return null;

  const soonestDealEndsAt = products
    .map((p) => p.dealEndsAt)
    .filter((dealEndsAt): dealEndsAt is string => !!dealEndsAt && new Date(dealEndsAt) > new Date())
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;

  const defaultSubtitles: Record<string, string> = {
    FLASH_SALES: 'Limited time offers',
    SPONSORED_PRODUCTS: 'Featured by vendors',
    LARGE_FEATURE_CARDS: 'Premium tech deals',
    BIG_DEALS: 'Biggest savings on premium products',
    BRAND_GRID: 'Explore products from your favorite brands',
  };

  return (
    <section className='relative py-10 lg:py-14 bg-gradient-to-b from-rose-50 to-white overflow-hidden'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Limited Time'
          title={section.name}
          subtitle={section.subtitle ?? defaultSubtitles[section.type] ?? ''}
          countdown={soonestDealEndsAt ? <CountdownTimer endDate={soonestDealEndsAt} /> : undefined}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <FlashSaleCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
      </section>
    );
  }

  export function SponsoredProductsSection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!section?.products?.length) return
    try {
      const productIds = section.products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [section?.products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section.products ?? [];
  if (!products.length) return null;

  const defaultSubtitles: Record<string, string> = {
    FLASH_SALES: 'Limited time offers',
    SPONSORED_PRODUCTS: 'Featured by vendors',
    LARGE_FEATURE_CARDS: 'Premium tech deals',
    BIG_DEALS: 'Biggest savings on premium products',
    BRAND_GRID: 'Explore products from your favorite brands',
  };

  return (
    <section className='relative py-10 lg:py-14 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Promoted'
          title={section.name}
          subtitle={section.subtitle ?? defaultSubtitles[section.type] ?? ''}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <SponsoredCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function EnterpriseGadgetDisplaySection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  if (loading) return <EnterpriseSectionSkeleton dark />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  const renderProductCard = (product: EnterpriseProduct) => {
    const effectivePrice = getEffectivePrice(product)
    const discountedPrice = getDiscountedPrice(product)
    const hasDiscount = discountedPrice !== null && discountedPrice < product.price
    const widthClass = 'snap-start flex-shrink-0 w-[280px] sm:w-[330px] md:w-[390px] lg:w-[480px]'

    return (
      <Link key={product.id} href={`/marketplace/product/${product.slug ?? product.id}`} className={widthClass}>
        <div className='group flex flex-col overflow-hidden rounded-2xl h-full bg-white shadow-md border border-gold/20 hover:shadow-2xl hover:border-gold/50 hover:-translate-y-1 transition-all duration-500'>
          <div className='relative aspect-[4/5] bg-slate-50 overflow-hidden'>
            <ProductImage
              product={product}
              className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700'
              sizes={CARD_IMAGE_SIZES_4COL}
            />
            <div className='absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent' />
            <div className='absolute top-3 left-3 right-3 flex justify-between items-start'>
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm'>
                Tech
              </span>
              <WishlistButton productId={product.id} size="sm" className="relative z-10" />
            </div>
          </div>
          <div className='p-5 space-y-3 flex-1 flex flex-col'>
            <h3 className='text-sm font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight'>
              {product.name}
            </h3>
            {product.store && (
              <p className='text-xs text-slate-500 truncate'>
                {product.store.name}
              </p>
            )}
            <div className='flex items-baseline gap-2 mt-auto'>
              {hasDiscount && (
                <span className='text-xs text-slate-400 line-through'>
                  {formatPrice(product.price)}
                </span>
              )}
              <span className='text-lg font-bold text-royal-blue'>{formatPrice(effectivePrice)}</span>
            </div>
            <Button variant='gradient' size='sm' className='w-full rounded-full font-semibold mt-auto'>
              View Deal
            </Button>
            <ProductStockIndicator stock={product.stock} availabilityType={product.availabilityType} />
          </div>
        </div>
      </Link>
    )
  }

  return (
    <section className='relative py-10 lg:py-14 bg-gradient-to-br from-slate-900 via-deep-navy to-slate-900 overflow-hidden'>
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl' />
      </div>
      <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='mb-6'>
          <SectionPill
            label='PREMIUM TECH'
            gradientFrom='from-amber-500'
            gradientVia='via-yellow-500'
            gradientTo='to-amber-400'
            icon={<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>}
          />
          <h2 className='text-2xl sm:text-3xl lg:text-4xl font-bold text-white'>
            {section.name}
          </h2>
          {section.subtitle && (
            <p className='mt-2 text-slate-300'>{section.subtitle}</p>
          )}
        </div>

        <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
          {products.slice(0, 20).map((product) => renderProductCard(product))}
        </div>

        <div className='mt-4 text-center'>
          <Link href='/marketplace?category=electronics'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold border-white/30 text-white hover:bg-white/10'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

  export function TopSellingSection({
  products,
  loading,
}: {
  products: EnterpriseProduct[];
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!products?.length) return
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

  if (loading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null;

  return (
    <section className='relative py-10 lg:py-14 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Best Sellers'
          title='Top-Selling Items'
          subtitle='Most popular products loved by our customers'
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard
              product={product}
              badge={
                product.salesCount ? `${product.salesCount} sold` : undefined
              }
              initialIsWishlisted={wishlistedProductIds.has(product.id)}
            />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace?sort=popular'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
     </section>
   );
 }

 export function BigTopDealsSection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!section?.products?.length) return
    try {
      const productIds = section.products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [section?.products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  const soonestDealEndsAt = products
    .map((p) => p.dealEndsAt)
    .filter((dealEndsAt): dealEndsAt is string => !!dealEndsAt && new Date(dealEndsAt) > new Date())
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;

  return (
    <section className='relative py-10 lg:py-14 bg-gradient-to-b from-orange-50 to-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Hot Deals'
          title={section.name}
          subtitle={section.subtitle ?? 'Biggest savings on premium products'}
          countdown={soonestDealEndsAt ? <CountdownTimer endDate={soonestDealEndsAt} /> : undefined}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <DealCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function TopClearanceSalesSection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!section?.products?.length) return
    try {
      const productIds = section.products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [section?.products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-10 lg:py-14 bg-gradient-to-b from-green-50 to-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Clearance'
          title={section.name}
          subtitle={section.subtitle ?? 'Massive clearance offers'}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <DealCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
     </section>
   );
 }

 export function TopServicesSection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!section?.products?.length) return
    try {
      const productIds = section.products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [section?.products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-10 lg:py-14 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Services'
          title={section.name}
          subtitle={section.subtitle ?? 'Premium services marketplace'}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace?category=Services'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
     </section>
   );
 }

 export function HomeTheatreSection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!section?.products?.length) return
    try {
      const productIds = section.products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [section?.products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (loading) return <EnterpriseSectionSkeleton dark />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  const mobileProducts = products.slice(0, 20);
  const half = Math.ceil(mobileProducts.length / 2);
  const topRowProducts = mobileProducts.slice(0, half);
  const bottomRowProducts = mobileProducts.slice(half);

  return (
    <section className='relative py-10 lg:py-14 bg-gradient-to-br from-purple-900 via-deep-navy to-slate-900 overflow-hidden'>
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-64 h-64 bg-premium-gold/10 rounded-full blur-3xl' />
      </div>
      <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Home Tech'
          title={section.name}
          subtitle={
            section.subtitle ??
            'Latest phones, laptops, accessories & gaming gear'
          }
          dark
        />

        {/* Desktop grid */}
        <div className='hidden lg:grid grid-cols-2 gap-6'>
          {products.slice(0, 4).map((product) => (
            <Link key={product.id} href={`/marketplace/product/${product.slug ?? product.id}`}>
              <Card
                variant='elevated'
                 className='group overflow-hidden rounded-2xl hover:shadow-2xl hover:border-gold/50 transition-all duration-500 bg-slate-800/50 border border-gold/20'
              >
                <div className='relative aspect-[16/9] bg-slate-800 overflow-hidden'>
                  <WishlistButton
                    productId={product.id}
                    initialIsWishlisted={wishlistedProductIds.has(product.id)}
                    size="sm"
                    className="absolute top-2 right-2 z-10"
                  />
                  <ProductImage
                    product={product}
                    className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-700'
                    sizes={CARD_IMAGE_SIZES_2COL}
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent' />
                  <div className='absolute bottom-0 left-0 right-0 p-6'>
                    <Badge variant='premium' size='sm' className='mb-2'>
                      Tech
                    </Badge>
                    <h3 className='text-xl font-bold text-white mb-1 line-clamp-1'>
                      {product.name}
                    </h3>
                    {product.store && (
                      <p className='text-white/70 text-sm mb-2'>
                        {product.store.name}
                      </p>
                    )}
                    <span className='text-2xl font-bold text-premium-gold'>
                      {formatPrice(getEffectivePrice(product))}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Mobile & tablet horizontal scroll - Two independent rows */}
        <div className='lg:hidden space-y-4'>
          {topRowProducts.length > 0 && (
            <div className='relative'>
              <div id='home-theatre-top-scroll' className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 pb-4'>
                <div className='flex gap-4'>
                  {topRowProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/marketplace/product/${product.slug ?? product.id}`}
                      className='snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)]'
                    >
                      <Card
                        variant='elevated'
                        className='group overflow-hidden rounded-2xl hover:shadow-xl hover:border-gold/50 transition-all duration-300 bg-slate-800/50 border border-gold/20'
                      >
                        <div className='relative aspect-[4/3] bg-slate-800 overflow-hidden'>
                          <WishlistButton
                            productId={product.id}
                            initialIsWishlisted={wishlistedProductIds.has(product.id)}
                            size="sm"
                            className="absolute top-2 right-2 z-10"
                          />
                          <ProductImage
                            product={product}
                            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                          />
                          <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent' />
                          <div className='absolute bottom-0 left-0 right-0 p-4'>
                            <h3 className='text-sm font-bold text-white mb-1 line-clamp-1'>
                              {product.name}
                            </h3>
                            <span className='text-lg font-bold text-premium-gold'>
                              {formatPrice(getEffectivePrice(product))}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const container = document.getElementById('home-theatre-top-scroll') as HTMLDivElement | null
                  container?.scrollBy({ left: -300, behavior: 'smooth' })
                }}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
                aria-label="Scroll left"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const container = document.getElementById('home-theatre-top-scroll') as HTMLDivElement | null
                  container?.scrollBy({ left: 300, behavior: 'smooth' })
                }}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
                aria-label="Scroll right"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
          {bottomRowProducts.length > 0 && (
            <div className='relative'>
              <div id='home-theatre-bottom-scroll' className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 pb-4'>
                <div className='flex gap-4'>
                  {bottomRowProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/marketplace/product/${product.slug ?? product.id}`}
                      className='snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)]'
                    >
                      <Card
                        variant='elevated'
                        className='group overflow-hidden rounded-2xl hover:shadow-xl hover:border-gold/50 transition-all duration-300 bg-slate-800/50 border border-gold/20'
                      >
                        <div className='relative aspect-[4/3] bg-slate-800 overflow-hidden'>
                          <WishlistButton
                            productId={product.id}
                            initialIsWishlisted={wishlistedProductIds.has(product.id)}
                            size="sm"
                            className="absolute top-2 right-2 z-10"
                          />
                          <ProductImage
                            product={product}
                            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                          />
                          <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent' />
                          <div className='absolute bottom-0 left-0 right-0 p-4'>
                            <h3 className='text-sm font-bold text-white mb-1 line-clamp-1'>
                              {product.name}
                            </h3>
                            <span className='text-lg font-bold text-premium-gold'>
                              {formatPrice(getEffectivePrice(product))}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const container = document.getElementById('home-theatre-bottom-scroll') as HTMLDivElement | null
                  container?.scrollBy({ left: -300, behavior: 'smooth' })
                }}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
                aria-label="Scroll left"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const container = document.getElementById('home-theatre-bottom-scroll') as HTMLDivElement | null
                  container?.scrollBy({ left: 300, behavior: 'smooth' })
                }}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
                aria-label="Scroll right"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className='mt-4 text-center'>
          <Link href='/marketplace?category=Electronics'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold border-white/30 text-white hover:bg-white/10'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
      </section>
    );
  }

  export function TopExpressOffersSection({
  section,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    products?: EnterpriseProduct[];
  };
  loading?: boolean;
}) {
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())

  const fetchWishlistStatus = useCallback(async () => {
    if (!section?.products?.length) return
    try {
      const productIds = section.products.map(p => p.id).join(',')
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      console.error('Error fetching wishlist status:', error)
    }
  }, [section?.products])

  useEffect(() => {
    fetchWishlistStatus()
  }, [fetchWishlistStatus])

  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-10 lg:py-14 bg-gradient-to-b from-amber-50 to-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Express'
          title={section.name}
          subtitle={section.subtitle ?? 'Express delivery exclusive deals'}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <DealCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function BrandCard({ brand }: { brand: EnterpriseBrand }) {
   const normalized = normalizeBrand(brand);
   const logo = normalized.logo;

   return (
     <Link href={`/marketplace?brand=${normalized.id || normalized.slug}`}>
       <div className="group flex-shrink-0 w-44 md:w-52 lg:w-56 flex flex-col items-center gap-4 bg-gradient-to-br from-white via-white/95 to-slate-50/50 rounded-3xl border border-slate-100/80 shadow-premium hover:shadow-premium-xl hover:-translate-y-1 transition-all duration-500 p-6 cursor-pointer">
         <div className="w-28 h-28 flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 overflow-hidden transition-transform duration-500 group-hover:scale-110">
           {logo ? (
              <Image
                src={logo}
                alt={normalized.name}
                width={112}
                height={112}
                className="object-contain max-h-full w-full"
                sizes={VENDOR_LOGO_SIZES}
                placeholder="blur"
                blurDataURL={getBlurDataURL()}
              />
           ) : (
             <span className="text-3xl font-bold text-royal-blue">
               {normalized.name.charAt(0).toUpperCase()}
             </span>
           )}
         </div>
         <p className="text-sm font-semibold text-deep-navy text-center truncate w-full group-hover:text-royal-blue transition-colors duration-300">
           {normalized.name}
         </p>
       </div>
      </Link>
     );
   }

  export function BrandStoreSection({
  section,
  brands,
  loading,
}: {
  section: {
    name: string;
    subtitle: string | null;
    type: string;
    brands?: EnterpriseBrand[];
  };
  brands: EnterpriseBrand[];
  loading?: boolean;
}) {
  if (loading) return <EnterpriseSectionSkeleton />;
  const displayBrands = brands ?? [];
  if (!displayBrands.length) {
    return (
      <section className='relative py-10 lg:py-14 bg-fuchsia-50/[0.05]'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3 mb-4'>
            <SectionPill label='FEATURED BRANDS' icon={<TbSparkles />} gradientFrom='from-fuchsia-500' gradientVia='via-pink-500' gradientTo='to-pink-500' />
          </div>
          <div className='bg-cream py-3 -mx-4 sm:-mx-6 lg:-mx-8'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
              <h2 className='text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy'>Featured Brands</h2>
              <p className='mt-1 text-[11px] text-deep-navy'>Browse products from your favourite brands</p>
            </div>
          </div>
          <EmptyState icon={<svg className='w-12 h-12 text-slate-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' /></svg>} title='No brands yet' description='Check back soon for featured brands.' />
        </div>
      </section>
    );
  }

  return (
    <section className='relative py-10 lg:py-14 bg-fuchsia-50/[0.05]'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className="flex items-center gap-3 mb-4">
          <SectionPill label="FEATURED BRANDS" icon={<TbSparkles />} gradientFrom="from-fuchsia-500" gradientVia="via-pink-500" gradientTo="to-pink-500" />
        </div>
        <div className='bg-cream py-3 -mx-4 sm:-mx-6 lg:-mx-8'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">Featured Brands</h2>
            <p className="text-deep-navy mt-1 text-[11px]">Shop by your favourite brands</p>
          </div>
        </div>

        <div className='relative'>
          <div id='brand-scroll-container' className='overflow-x-auto overflow-y-hidden scrollbar-hide pb-4'>
            <div className='flex gap-4'>
              {displayBrands.map((brand) => {
                const normalized = normalizeBrand(brand);
                return (
                  <div
                    key={normalized.id || normalized.slug}
                  >
                    <BrandCard brand={brand} />
                  </div>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const container = document.getElementById('brand-scroll-container') as HTMLDivElement | null
              container?.scrollBy({ left: -300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll brands left"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const container = document.getElementById('brand-scroll-container') as HTMLDivElement | null
              container?.scrollBy({ left: 300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll brands right"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className='mt-4 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              Browse All Brands
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function buildEnterpriseSections(data: EnterpriseHomepageData) {
  const topSelling = dedupeProducts(data.topSelling, new Set());
  const excludeFromFeaturedIds = collectProductIds(topSelling);

  return {
    topSelling,
    excludeFromFeaturedIds,
  };
}

const QUICK_LINKS: Array<{ name: string; href: string; image: string }> = [
  { name: 'Marketplace', href: '/marketplace', image: '/images/market.jpg' },
  { name: 'New Arrivals', href: '/#new-arrivals', image: '/images/arrivals.jpg' },
  { name: 'Groceries', href: '/marketplace?category=Groceries%20%26%20Food', image: '/images/groceries.jpg' },
  { name: 'Fashion', href: '/marketplace?category=Fashion', image: '/images/fashion.jpg' },
  { name: 'New This Week', href: '/#new-this-week', image: '/images/newweek.jpg' },
  { name: 'Sell on Dhream Market', href: '/register', image: '/images/selldhream.jpg' },
  { name: 'Televisions', href: '/marketplace?category=Appliances', image: '/images/televisions.jpg' },
  { name: 'Brands', href: '/#brand-store', image: '/images/brands.jpg' },
  { name: 'Computing', href: '/marketplace?category=Desktop%20Computers', image: '/images/computing.jpg' },
  { name: "Men's Sneakers", href: '/marketplace?category=Sneakers', image: '/images/mensneaker.jpg' },
  { name: 'Trending Now', href: '/#homepage-trending-now', image: '/images/trend.jpg' },
  { name: 'Appliances', href: '/marketplace?category=Appliances', image: '/images/appliance.jpg' },
]

export function QuickLinksSection() {
   return (
       <section className='relative py-10 lg:py-14 bg-gradient-to-b from-slate-50/50 to-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3 mb-4'>
            <SectionPill label='EXPLORE' icon={<TbCompass />} gradientFrom='from-indigo-500' gradientVia='via-violet-500' gradientTo='to-violet-500' />
          </div>
          <div className='bg-cream py-3 -mx-4 sm:-mx-6 lg:-mx-8'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
              <h2 className='text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy'>
                Quick Links
              </h2>
              <p className='mt-1 text-[11px] text-deep-navy'>Fast access to popular categories</p>
            </div>
          </div>
          <div className='grid grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5'>
            {QUICK_LINKS.map((link) => {
              const isInternalScroll = link.href.startsWith('/#');
              return (
                <a
                  key={link.name}
                  href={link.href}
                  className='group focus:outline-none focus:ring-2 focus:ring-royal-blue rounded-3xl cursor-pointer block'
                  tabIndex={0}
                  onClick={(e) => {
                    if (isInternalScroll) {
                      e.preventDefault();
                      const targetId = link.href.substring(2);
                      const targetElement = document.getElementById(targetId);
                      if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }
                  }}
                >
                   <Card variant='elevated' className='p-3 sm:p-4 text-center hover:shadow-premium-xl hover:-translate-y-1 transition-all duration-300 h-full bg-gradient-to-br from-white via-white/95 to-slate-50/50 border-slate-100/80'>
                        <div className='w-full aspect-square mb-2 sm:mb-3 rounded-2xl overflow-hidden group-hover:scale-105 transition-transform duration-300 shadow-md group-hover:shadow-lg'>
                          <Image src={link.image} alt={link.name} width={144} height={144} className='w-full h-full object-contain' />
                        </div>
                    <h3 className='text-xs sm:text-sm lg:text-base font-semibold text-deep-navy group-hover:text-royal-blue transition-colors leading-tight line-clamp-2'>
                      {link.name}
                    </h3>
                  </Card>
                </a>
              );
            })}
          </div>
       </div>
     </section>
   );
 }

export function NewArrivalsSection({ excludeIds }: { excludeIds?: Set<string> }) {
  const excludeKey = useMemo(() => excludeIds ? Array.from(excludeIds).sort().join(',') : '', [excludeIds])

  const { data, isLoading } = useQuery<{ products: EnterpriseProduct[] }>({
    queryKey: ['products', 'new-arrivals', excludeKey],
    queryFn: async () => {
      const response = await fetch('/api/products?sortBy=createdAt&sortOrder=desc&limit=20')
      if (!response.ok) throw new Error('Failed to fetch new arrivals')
      return response.json()
    },
  })
  const allProducts = data?.products ?? []
  const products = useMemo(() => {
    return allProducts
      .filter((p: EnterpriseProduct) => ((p.availableQuantity ?? p.stock) > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER') && !excludeIds?.has(p.id))
      .slice(0, 20)
  }, [allProducts, excludeIds])
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

  if (isLoading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section id='new-arrivals' className='relative py-10 lg:py-14 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='New'
          title='New Arrivals'
          subtitle='Latest products on Dhream Market'
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function NewThisWeekSection({ excludeIds }: { excludeIds?: Set<string> }) {
  const excludeKey = useMemo(() => excludeIds ? Array.from(excludeIds).sort().join(',') : '', [excludeIds])

  const { data, isLoading } = useQuery<{ products: EnterpriseProduct[] }>({
    queryKey: ['products', 'new-this-week', excludeKey],
    queryFn: async () => {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const response = await fetch(`/api/products?sortBy=createdAt&sortOrder=desc&limit=20&createdAtMin=${sevenDaysAgo.toISOString()}`)
      if (!response.ok) throw new Error('Failed to fetch new this week')
      return response.json()
    },
  })
  const allProducts = data?.products ?? []
  const products = useMemo(() => {
    return allProducts
      .filter((p: EnterpriseProduct) => ((p.availableQuantity ?? p.stock) > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER') && !excludeIds?.has(p.id))
      .slice(0, 20)
  }, [allProducts, excludeIds])
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

  if (isLoading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section id='new-this-week' className='relative py-10 lg:py-14 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='This Week'
          title='New This Week'
          subtitle='Products added in the last 7 days'
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard product={product} initialIsWishlisted={wishlistedProductIds.has(product.id)} />
          )}
        />
        <div className='mt-4 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

const ELECTRONICS_CATEGORIES = [
  {
    title: 'Laptops & Desktops',
    image: '/images/laptop.jpg',
    link: '/marketplace?category=Electronics%20and%20Technology',
  },
  {
    title: 'Speakers',
    image: '/images/speaker.jpg',
    link: '/marketplace?category=Electronics%20and%20Technology',
  },
  {
    title: 'Headphones & Earbuds',
    image: '/images/headset.jpg',
    link: '/marketplace?category=Electronics%20and%20Technology',
  },
  {
    title: 'Smartphones',
    image: '/images/phone.jpg',
    link: '/marketplace?category=Electronics%20and%20Technology',
  },
] as const

export function ElectronicsShowcaseSection() {
   return (
     <section className='relative py-10 lg:py-14 bg-white'>
       <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
         <div className='mb-12'>
           <Badge variant='premium' className='mb-4'>Technology</Badge>
           <h2 className='text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy'>
             Plug in with our Electronics
           </h2>
         </div>
         <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6'>
           {ELECTRONICS_CATEGORIES.map((category) => (
             <Link key={category.title} href={category.link}>
               <Card
                 variant='elevated'
                 className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full p-0'
               >
                 <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
                   <Image
                     src={category.image}
                     alt={category.title}
                     className='object-cover group-hover:scale-105 transition-transform duration-500'
                     fill
                     loading='lazy'
                   />
                 </div>
                 <div className='p-4 text-center'>
                   <h3 className='text-base font-bold text-deep-navy group-hover:text-royal-blue transition-colors'>
                     {category.title}
                   </h3>
                 </div>
               </Card>
             </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const FOOD_CATEGORIES = [
   {
     title: 'Groceries',
     image: '/images/grocery.jpg',
     link: '/marketplace?tab=products&category=Food%20and%20Beverages',
   },
   {
     title: 'Beverages',
     image: '/images/beverage.jpg',
     link: '/marketplace?tab=products&category=Food%20and%20Beverages',
   },
   {
     title: 'Local Dishes',
     image: '/images/dish.jpg',
     link: '/marketplace?tab=products&category=Food%20and%20Beverages',
   },
   {
     title: 'Fast Foods',
     image: '/images/food.jpg',
     link: '/marketplace?tab=products&category=Food%20and%20Beverages',
   },
 ] as const

  export function FoodShowcaseSection() {
    return (
      <section className='relative py-10 lg:py-14 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-12'>
            <h2 className='text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy'>
              Taste the Best Around You
            </h2>
          </div>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6'>
            {FOOD_CATEGORIES.map((category) => (
              <Link key={category.title} href={category.link}>
                <Card
                  variant='elevated'
                  className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full p-0'
                >
                  <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
                    <Image
                      src={category.image}
                      alt={category.title}
                      className='object-cover group-hover:scale-105 transition-transform duration-500'
                      fill
                      loading='lazy'
                      sizes={CARD_IMAGE_SIZES_4COL}
                      placeholder="blur"
                      blurDataURL={getBlurDataURL()}
                    />
                  </div>
                  <div className='p-4 text-center'>
                    <h3 className='text-base font-bold text-deep-navy group-hover:text-royal-blue transition-colors'>
                      {category.title}
                    </h3>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const FEATURED_COLLECTIONS = [
    {
      title: 'Kitchen Essentials',
      image: '/images/kitchenmust.jpg',
      href: '/marketplace',
    },
    {
      title: 'Back to School',
      image: '/images/backtoschool.jpg',
      href: '/marketplace',
    },
    {
      title: 'Beauty & Makeup',
      image: '/images/nailmakeup.jpg',
      href: '/marketplace',
    },
  ] as const

  export function FeaturedCollectionsSection() {
  return (
    <section className='relative py-6 lg:py-8 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
         <div className='relative'>
          <div id='featured-collections-scroll' className='flex gap-1 sm:gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4'>
              {FEATURED_COLLECTIONS.map((item) => (
                <Link key={item.title} href={item.href} className='snap-start flex-shrink-0 w-[280px] sm:w-[360px] lg:w-[400px] block'>
                  <div className='relative aspect-[3/4] bg-slate-100 overflow-hidden'>
                      <Image
                        src={item.image}
                        alt={item.title}
                        className='object-contain'
                        fill
                        loading='lazy'
                        sizes={CARD_IMAGE_SIZES_4COL}
                        placeholder="blur"
                        blurDataURL={getBlurDataURL()}
                      />
                  </div>
                </Link>
              ))}
           </div>
           <button
            type="button"
            onClick={() => {
              const container = document.getElementById('featured-collections-scroll') as HTMLDivElement | null
              container?.scrollBy({ left: -300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll collections left"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const container = document.getElementById('featured-collections-scroll') as HTMLDivElement | null
              container?.scrollBy({ left: 300, behavior: 'smooth' })
            }}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
            aria-label="Scroll collections right"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
         </div>
        </div>
      </section>
    )
  }

  const SERVICE_CARDS = [
    {
      title: 'Tailor/Seamstress',
      image: '/images/seamstress.jpg',
      categoryName: 'Fashion & Tailoring',
    },
    {
      title: 'Barbers',
      image: '/images/barber.jpg',
      categoryName: 'Hair & Barber Services',
    },
    {
      title: 'Carpenters',
      image: '/images/carpenter.jpg',
      categoryName: 'Carpentry & Woodwork',
    },
    {
      title: 'Plumbers',
      image: '/images/plumber.jpg',
      categoryName: 'Plumbing Services',
    },
  ] as const

  export function ServiceShowcaseSection() {
    const { data: categoriesData } = useQuery<{ categories: { id: string; name: string }[] }>({
      queryKey: ['service-categories'],
      queryFn: async () => {
        const response = await fetch('/api/service-categories')
        if (!response.ok) throw new Error('Failed to fetch service categories')
        return response.json()
      },
    })

    const categories = categoriesData?.categories ?? []
    const categoryMap = useMemo(() => {
      const map = new Map<string, string>()
      categories.forEach((cat) => map.set(cat.name, cat.id))
      return map
    }, [categories])

    return (
      <section className='relative py-10 lg:py-14 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-12'>
            <Badge variant='premium' className='mb-4'>Services</Badge>
            <h2 className='text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy'>
              Never Left Out Your Service
            </h2>
          </div>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6'>
            {SERVICE_CARDS.map((item) => {
              const categoryId = categoryMap.get(item.categoryName) ?? ''
              const href = categoryId
                ? `/marketplace?viewMode=services&serviceCategory=${encodeURIComponent(categoryId)}`
                : '#'
              return (
                <Link key={item.title} href={href}>
                  <Card
                    variant='elevated'
                    className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:border-gold/50 transition-all duration-300 cursor-pointer h-full p-0 border border-gold/20'
                  >
                    <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
                      <Image
                        src={item.image}
                        alt={item.title}
                        className='object-cover group-hover:scale-105 transition-transform duration-500'
                        fill
                        loading='lazy'
                      />
                    </div>
                    <div className='p-4 text-center'>
                      <h3 className='text-base font-bold text-deep-navy group-hover:text-royal-blue transition-colors'>
                        {item.title}
                      </h3>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  const HOME_DECOR_CATEGORIES = [
    {
      title: 'Beddings',
      image: '/images/bedsheet.jpg',
      categoryName: 'Bedding',
    },
    {
      title: 'Chandeliers',
      image: '/images/chandelier.jpg',
      categoryName: 'Lighting',
    },
    {
      title: 'Pillows',
      image: '/images/pillow.jpg',
      categoryName: 'Bedding',
    },
    {
      title: 'Floral Decor',
      image: '/images/flower.jpg',
      categoryName: 'Home Decor',
    },
  ] as const

  export function HomeDecorShowcaseSection() {
    type CategoryNode = { id: string; name: string; slug: string; children?: CategoryNode[] }

    const { data: categoriesData } = useQuery<{ categories: CategoryNode[] }>({
      queryKey: ['categories'],
      queryFn: async () => {
        const response = await fetch('/api/categories')
        if (!response.ok) throw new Error('Failed to fetch categories')
        return response.json()
      },
    })

    const categories = categoriesData?.categories ?? []

    const flattenCategories = (cats: CategoryNode[]): { name: string; id: string }[] => {
      const result: { name: string; id: string }[] = []
      const walk = (items: CategoryNode[] | undefined) => {
        items?.forEach((cat) => {
          result.push({ name: cat.name, id: cat.id })
          if (cat.children?.length) {
            walk(cat.children)
          }
        })
      }
      walk(cats)
      return result
    }

    const flatCategories = useMemo(() => flattenCategories(categories), [categories])
    const categoryMap = useMemo(() => {
      const map = new Map<string, string>()
      flatCategories.forEach((cat) => map.set(cat.name, cat.id))
      return map
    }, [flatCategories])

    return (
      <section className='relative py-10 lg:py-14 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-12'>
            <Badge variant='premium' className='mb-4'>Home & Decor</Badge>
            <h2 className='text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy'>
              Make Your Home Beautiful
            </h2>
          </div>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6'>
            {HOME_DECOR_CATEGORIES.map((item) => {
              const categoryId = categoryMap.get(item.categoryName) ?? ''
              const href = categoryId
                ? `/marketplace?category=${encodeURIComponent(categoryId)}`
                : '#'
              return (
                <Link key={item.title} href={href}>
                  <Card
                    variant='elevated'
                    className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full p-0'
                  >
                    <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
                      <Image
                        src={item.image}
                        alt={item.title}
                        className='object-cover group-hover:scale-105 transition-transform duration-500'
                        fill
                        loading='lazy'
                      />
                    </div>
                    <div className='p-4 text-center'>
                      <h3 className='text-base font-bold text-deep-navy group-hover:text-royal-blue transition-colors'>
                        {item.title}
                      </h3>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  const PET_CATEGORIES = [
    {
      title: 'Puppies',
      image: '/images/puppies.jpg',
      categoryName: 'Dogs & Puppies',
    },
    {
      title: 'Cats',
      image: '/images/Cats.jpg',
      categoryName: 'Cats & Kittens',
    },
    {
      title: 'Small Pets',
      image: '/images/smallpets.jpg',
      categoryName: 'Aquariums',
    },
    {
      title: 'Pets Feed',
      image: '/images/petfeed.jpg',
      categoryName: 'Pet Food',
    },
  ] as const

  export function PetShowcaseSection() {
    type CategoryNode = { id: string; name: string; slug: string; children?: CategoryNode[] }

    const { data: categoriesData } = useQuery<{ categories: CategoryNode[] }>({
      queryKey: ['categories'],
      queryFn: async () => {
        const response = await fetch('/api/categories')
        if (!response.ok) throw new Error('Failed to fetch categories')
        return response.json()
      },
    })

    const categories = categoriesData?.categories ?? []

    const flattenCategories = (cats: CategoryNode[]): { name: string; id: string }[] => {
      const result: { name: string; id: string }[] = []
      const walk = (items: CategoryNode[] | undefined) => {
        items?.forEach((cat) => {
          result.push({ name: cat.name, id: cat.id })
          if (cat.children?.length) {
            walk(cat.children)
          }
        })
      }
      walk(cats)
      return result
    }

    const flatCategories = useMemo(() => flattenCategories(categories), [categories])
    const categoryMap = useMemo(() => {
      const map = new Map<string, string>()
      flatCategories.forEach((cat) => map.set(cat.name, cat.id))
      return map
    }, [flatCategories])

    return (
      <section className='relative py-10 lg:py-14 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-12'>
            <Badge variant='premium' className='mb-4'>Pets</Badge>
            <h2 className='text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy'>
              Want a puffy friend?
            </h2>
          </div>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6'>
            {PET_CATEGORIES.map((item) => {
              const categoryId = categoryMap.get(item.categoryName) ?? ''
              const href = categoryId
                ? `/marketplace?category=${encodeURIComponent(categoryId)}`
                : '#'
              return (
                <Link key={item.title} href={href}>
                  <Card
                    variant='elevated'
                    className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full p-0'
                  >
                    <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
                      <Image
                        src={item.image}
                        alt={item.title}
                        className='object-cover group-hover:scale-105 transition-transform duration-500'
                        fill
                        loading='lazy'
                      />
                    </div>
                    <div className='p-4 text-center'>
                      <h3 className='text-base font-bold text-deep-navy group-hover:text-royal-blue transition-colors'>
                        {item.title}
                      </h3>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

