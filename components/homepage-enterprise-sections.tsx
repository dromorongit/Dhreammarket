'use client';

import Image from 'next/image';
import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge'
import { SkeletonCard } from '@/components/Skeleton';
import { formatPrice } from '@/lib/currency';
import { truncateVendorName } from '@/lib/utils';
import { MdVerified } from 'react-icons/md';
import { getVendorBadgeInfo } from '@/lib/vendor-badge';
import { type EnterpriseProduct, type EnterpriseBrand, type EnterpriseHomepageData, getDiscountPercent, getEffectivePrice, getDiscountedPrice, dedupeProducts, collectProductIds, normalizeBrand, EMPTY_ENTERPRISE_DATA } from '@/lib/homepage-product-utils'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges';

export function useEnterpriseHomepageData() {
  const [data, setData] = useState<EnterpriseHomepageData>(
    EMPTY_ENTERPRISE_DATA,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/homepage/enterprise', {
          cache: 'no-store',
        });
        const json = await response.json();
        if (json && typeof json === 'object') {
          setData({
            topSelling: Array.isArray(json.topSelling) ? json.topSelling : [],
          });
        }
      } catch (error) {
        console.error('Error fetching enterprise homepage data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return { data, loading };
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('Ended');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return (
    <span className='font-mono text-[10px] font-bold' suppressHydrationWarning>
      {label ?? '--:--:--'}
    </span>
  );
}

function ProductImage({
  product,
  className,
}: {
  product: EnterpriseProduct;
  className?: string;
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
        <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
          <div className="flex gap-4">
            {topRowProducts.map((product) => renderCard(product))}
          </div>
        </div>
      )}
      {bottomRowProducts.length > 0 && (
        <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
          <div className="flex gap-4">
            {bottomRowProducts.map((product) => renderCard(product))}
          </div>
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
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <div className='mb-10'>
      {badge && (
        <Badge variant={dark ? 'premium' : 'danger'} className='mb-3'>
          {badge}
        </Badge>
      )}
      <h2
        className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${dark ? 'text-white' : 'text-deep-navy'}`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function EnterpriseSectionSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <section
      className={
        dark ? 'relative py-16 lg:py-24 bg-slate-900' : 'relative py-16 lg:py-24'
      }
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='mb-10'>
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

function FlashSaleCard({ product }: { product: EnterpriseProduct }) {
  const discountedPrice = getDiscountedPrice(product)
  const salePrice = discountedPrice ?? product.price
  const discount = getDiscountPercent(product.price, discountedPrice ?? undefined)

  return (
    <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
      <Card
        variant='elevated'
        className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0 w-full'
      >
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
            <ProductImage
              product={product}
              className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
            />
            {product.flashSaleEnd && (
              <div className='absolute top-2 right-2 bg-deep-navy/90 text-white px-2 py-1 rounded-full flex items-center gap-1'>
                <svg
                  className='w-3 h-3'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                <CountdownTimer endTime={product.flashSaleEnd} />
              </div>
            )}
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
        </Link>
        <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
          <h3 className='text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight'>
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
        </div>
      </Card>
    </div>
  )
}

function SponsoredCard({ product }: { product: EnterpriseProduct }) {
  const discountedPrice = getDiscountedPrice(product)

  return (
    <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
      <Card
        variant='elevated'
        className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0 w-full'
      >
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
            <ProductImage
              product={product}
              className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
            />
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
        </Link>
        <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
          <h3 className='text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight'>
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
        </div>
      </Card>
    </div>
  )
}

function DealCard({ product }: { product: EnterpriseProduct }) {
  const discountedPrice = getDiscountedPrice(product)
  const salePrice = discountedPrice ?? product.price

  return (
    <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
      <Card
        variant='elevated'
        className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0 border-2 border-transparent hover:border-rose-200 w-full'
      >
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
            <ProductImage
              product={product}
              className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
            />
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
        </Link>
        <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
          <h3 className='text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight'>
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
        </div>
      </Card>
    </div>
  )
}

function StandardCard({
  product,
  badge,
}: {
  product: EnterpriseProduct;
  badge?: string;
}) {
  return (
    <div key={product.id} className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
      <Card
        variant='elevated'
        className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0 w-full'
      >
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
          <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
            <ProductImage
              product={product}
              className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
            />
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
        </Link>
        <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
          <h3 className='text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight'>
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
        </div>
      </Card>
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
    <section className='relative py-16 lg:py-24 bg-gradient-to-b from-rose-50 to-white overflow-hidden'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Limited Time'
          title={section.name}
          subtitle={section.subtitle ?? defaultSubtitles[section.type] ?? ''}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <FlashSaleCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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
    <section className='relative py-16 lg:py-24 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Promoted'
          title={section.name}
          subtitle={section.subtitle ?? defaultSubtitles[section.type] ?? ''}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <SponsoredCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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

  const mobileProducts = products.slice(0, 20);
  const half = Math.ceil(mobileProducts.length / 2);
  const topRowProducts = mobileProducts.slice(0, half);
  const bottomRowProducts = mobileProducts.slice(half);

  return (
    <section className='relative py-16 lg:py-24 bg-gradient-to-br from-slate-900 via-deep-navy to-slate-900 overflow-hidden'>
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl' />
      </div>
      <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Premium Tech'
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
                className='group overflow-hidden rounded-2xl hover:shadow-2xl transition-all duration-500 bg-slate-800/50 border border-slate-700/50'
              >
                <div className='relative aspect-[16/9] bg-slate-800 overflow-hidden'>
                  <ProductImage
                    product={product}
                    className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-700'
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
            <div className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 pb-4'>
              <div className='flex gap-4'>
{topRowProducts.map((product) => (
                   <Link
                     key={product.id}
                     href={`/marketplace/product/${product.slug ?? product.id}`}
                     className='snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]'
                   >
                    <Card
                      variant='elevated'
                      className='group overflow-hidden rounded-2xl hover:shadow-xl transition-all duration-300 bg-slate-800/50 border border-slate-700/50'
                    >
                      <div className='relative aspect-[4/3] bg-slate-800 overflow-hidden'>
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
          )}
          {bottomRowProducts.length > 0 && (
            <div className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 pb-4'>
              <div className='flex gap-4'>
{bottomRowProducts.map((product) => (
                   <Link
                     key={product.id}
                     href={`/marketplace/product/${product.slug ?? product.id}`}
                     className='snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]'
                   >
                    <Card
                      variant='elevated'
                      className='group overflow-hidden rounded-2xl hover:shadow-xl transition-all duration-300 bg-slate-800/50 border border-slate-700/50'
                    >
                      <div className='relative aspect-[4/3] bg-slate-800 overflow-hidden'>
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
          )}
        </div>

        <div className='mt-8 text-center'>
          <Link href='/marketplace?category=electronics'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold border-white/30 text-white hover:bg-white/10'
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
  if (loading) return <EnterpriseSectionSkeleton />;
  if (!products.length) return null;

  return (
    <section className='relative py-16 lg:py-24 bg-white'>
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
            />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace?sort=popular'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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
  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-16 lg:py-24 bg-gradient-to-b from-orange-50 to-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Hot Deals'
          title={section.name}
          subtitle={section.subtitle ?? 'Biggest savings on premium products'}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <DealCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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
  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-16 lg:py-24 bg-gradient-to-b from-green-50 to-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Clearance'
          title={section.name}
          subtitle={section.subtitle ?? 'Massive clearance offers'}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <DealCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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
  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-16 lg:py-24 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Services'
          title={section.name}
          subtitle={section.subtitle ?? 'Premium services marketplace'}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace?category=Services'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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
  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-16 lg:py-24 bg-gradient-to-br from-purple-900 via-deep-navy to-slate-900 overflow-hidden'>
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-64 h-64 bg-premium-gold/10 rounded-full blur-3xl' />
      </div>
      <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Home Tech'
          title={section.name}
          subtitle={section.subtitle ?? 'Home entertainment systems'}
          dark
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace?category=Electronics'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold border-white/30 text-white hover:bg-white/10'
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
  if (loading) return <EnterpriseSectionSkeleton />;
  const products = section?.products ?? [];
  if (!products.length) return null;

  return (
    <section className='relative py-16 lg:py-24 bg-gradient-to-b from-amber-50 to-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='Express'
          title={section.name}
          subtitle={section.subtitle ?? 'Express delivery exclusive deals'}
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <DealCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace?sort=deals'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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
      <div className="flex-shrink-0 w-36 md:w-44 flex flex-col items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer">
        <div className="w-24 h-16 flex items-center justify-center">
          {logo ? (
            <Image
              src={logo}
              alt={normalized.name}
              width={96}
              height={64}
              className="object-contain max-h-16"
            />
          ) : (
            <span className="text-2xl font-bold text-royal-blue">
              {normalized.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-gray-700 text-center truncate w-full">{normalized.name}</p>
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
  if (!displayBrands.length) return null;

  return (
    <section className='relative py-16 lg:py-24 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className="mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-deep-navy mb-2">Featured Brands</h2>
          <p className="text-gray-500 mb-6">Shop by your favourite brands</p>
        </div>

        <div className='overflow-x-auto overflow-y-hidden scrollbar-hide pb-4'>
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

        <div className='mt-8 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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

const QUICK_LINKS: Array<{ name: string; href: string; icon: string; color: string }> = [
  { name: 'Marketplace', href: '/marketplace', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'from-blue-500 to-blue-600' },
  { name: 'New Arrivals', href: '/#new-arrivals', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-emerald-500 to-emerald-600' },
  { name: 'Groceries', href: '/marketplace?category=Groceries%20%26%20Food', icon: 'M3 3h2l.4 2M7 13h14l-1.35 6.75a2 2 0 01-1.85 1.25H7.44a2 2 0 01-1.85-1.25L3 6h2l1.5 7.5M7 13l-1.5-7.5M17 13l1.5-7.5', color: 'from-green-500 to-green-600' },
  { name: 'Fashion', href: '/marketplace?category=Fashion', icon: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z', color: 'from-pink-500 to-pink-600' },
  { name: 'New This Week', href: '/#new-this-week', icon: 'M6 2a1 1 0 000 2h12a1 1 0 001-1 1H6a1 1 0 000-2zm0 4a1 1 0 000 2h12a1 1 0 001-1 1H6a1 1 0 000-2zm0 4a1 1 0 000 2h5a1 1 0 000-1v-5a1 1 0 00-2 0v5H6z', color: 'from-purple-500 to-purple-600' },
  { name: 'Sell on Dhream Market', href: '/register', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-royal-blue to-indigo-600' },
  { name: 'Televisions', href: '/marketplace?category=Appliances', icon: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z', color: 'from-indigo-500 to-indigo-600' },
  { name: 'Brands', href: '/#brand-store', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', color: 'from-violet-500 to-violet-600' },
  { name: 'Computing', href: '/marketplace?category=Desktop%20Computers', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L7.5 9h9l-.621-.621A2.25 2.25 0 0115 8.818V3.104m-9 0A2.25 2.25 0 004.875 5.25h4.5A2.25 2.25 0 0011.25 3.104m-9 0V5.25A2.25 2.25 0 004.875 7.5h4.5A2.25 2.25 0 0011.25 5.25', color: 'from-cyan-500 to-cyan-600' },
  { name: "Men's Sneakers", href: '/marketplace?category=Sneakers', icon: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z', color: 'from-amber-500 to-amber-600' },
  { name: 'Trending Now', href: '/marketplace', icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'from-rose-500 to-rose-600' },
  { name: 'Appliances', href: '/marketplace?category=Appliances', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M5.25 12v7a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5v-7m-18 0h18', color: 'from-teal-500 to-teal-600' },
]

export function QuickLinksSection() {
  return (
    <section className='relative py-16 lg:py-24 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='text-center mb-10'>
          <h2 className='text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy'>
            Quick Links
          </h2>
          <p className='text-slate-600 mt-2'>Fast access to popular categories</p>
        </div>
        <div className='overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory scroll-smooth'>
          <div className='flex gap-4 lg:gap-6 px-4 -mx-4 sm:-mx-6 lg:-mx-8 pb-4 touch-pan-x'>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className='group focus:outline-none focus:ring-2 focus:ring-royal-blue rounded-xl snap-start flex-shrink-0'
                tabIndex={0}
              >
                <Card variant='elevated' className='p-4 text-center hover:shadow-xl transition-all duration-300 group-hover:-translate-y-0.5 h-full min-h-[100px] min-w-[140px] max-w-[180px] w-[160px]'>
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <svg className='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d={link.icon} />
                    </svg>
                  </div>
                  <h3 className='text-xs sm:text-sm font-semibold text-deep-navy group-hover:text-royal-blue transition-colors leading-tight line-clamp-2'>
                    {link.name}
                  </h3>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function NewArrivalsSection({ excludeIds }: { excludeIds?: Set<string> }) {
  const [products, setProducts] = useState<EnterpriseProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [excludeIds])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?sortBy=createdAt&sortOrder=desc&limit=20')
      if (response.ok) {
        const data = await response.json()
const availableProducts = (data.products || [])
           .filter((p: EnterpriseProduct) => (p.stock > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER') && !excludeIds?.has(p.id))
           .slice(0, 20)
        setProducts(availableProducts)
      }
    } catch (error) {
      console.error('Error fetching new arrivals:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section id='new-arrivals' className='relative py-16 lg:py-24 bg-white'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='New'
          title='New Arrivals'
          subtitle='Latest products on Dhream Market'
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
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
  const [products, setProducts] = useState<EnterpriseProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [excludeIds])

  const fetchProducts = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const response = await fetch(`/api/products?sortBy=createdAt&sortOrder=desc&limit=20&createdAtMin=${sevenDaysAgo.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
const availableProducts = (data.products || [])
           .filter((p: EnterpriseProduct) => (p.stock > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER') && !excludeIds?.has(p.id))
           .slice(0, 20)
        setProducts(availableProducts)
      }
    } catch (error) {
      console.error('Error fetching new this week:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <EnterpriseSectionSkeleton />
  if (!products.length) return null

  return (
    <section id='new-this-week' className='relative py-16 lg:py-24 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <SectionHeader
          badge='This Week'
          title='New This Week'
          subtitle='Products added in the last 7 days'
        />
        <ProductRail
          products={products}
          renderCard={(product) => (
            <StandardCard product={product} />
          )}
        />
        <div className='mt-8 text-center'>
          <Link href='/marketplace'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}