'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { formatPrice } from '@/lib/currency';
import { MdVerified } from 'react-icons/md';
import { getVendorBadgeInfo } from '@/lib/vendor-badge';
import { type EnterpriseProduct, getEffectivePrice } from '@/lib/homepage-product-utils';
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges';


function TrendingProductCard({ product }: { product: EnterpriseProduct }) {
  const effectivePrice = getEffectivePrice(product)
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
    <div className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]">
      <Link href={`/marketplace/product/${product.slug ?? product.id}`} className='block'>
        <Card
          variant='elevated'
          className='group flex flex-col overflow-hidden rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full p-0 w-full'
        >
          <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
            {product.images?.[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].alt || product.name}
                className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                fill
                loading='lazy'
              />
            ) : (
              <div className='absolute inset-0 flex items-center justify-center bg-slate-100'>
                <svg className='w-8 h-8 text-slate-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
                </svg>
              </div>
            )}
            <ProductBadges product={badgeData} />
          </div>
          <div className='p-2.5 space-y-1 flex-1 flex flex-col'>
            <h3 className='text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight'>
              {product.name}
            </h3>
            <div className='flex items-center gap-1.5 flex-wrap'>
              <span className='text-[11px] font-bold text-royal-blue'>
                {formatPrice(effectivePrice)}
              </span>
              {effectivePrice < product.price && (
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
                  const badgeInfo = getVendorBadgeInfo((product.store as any).badgeTier);
                  if (badgeInfo) {
                    const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500';
                    return (
                      <MdVerified className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
                    );
                  }
                  if (product.store.isVerified) {
                    return (
                      <MdVerified className='w-3.5 h-3.5 text-sky-500 flex-shrink-0' />
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        </Card>
      </Link>
    </div>
  );
}

export function TrendingNowSection({
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
  if (loading) {
    return <TrendingNowSectionSkeleton />;
  }
  
  const products = section?.products ?? [];
  if (!products.length) return null;

  const displayProducts = products.slice(0, 20);
  const half = Math.ceil(displayProducts.length / 2);
  const topRowProducts = displayProducts.slice(0, half);
  const bottomRowProducts = displayProducts.slice(half);

  return (
    <section id='homepage-trending-now' className='relative py-16 lg:py-24 bg-white overflow-hidden'>
      <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='mb-10'>
          <Badge variant='premium' className='mb-3'>Hot Picks</Badge>
          <h2 className='text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy'>
            {section.name}
          </h2>
          {section.subtitle && (
            <p className='mt-2 text-slate-600'>
              {section.subtitle}
            </p>
          )}
        </div>

        <div className='space-y-4'>
          {topRowProducts.length > 0 && (
            <div className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4'>
              <div className='flex gap-4'>
                {topRowProducts.map((product) => (
                  <TrendingProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
          {bottomRowProducts.length > 0 && (
            <div className='overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4'>
              <div className='flex gap-4'>
                {bottomRowProducts.map((product) => (
                  <TrendingProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className='mt-8 text-center'>
          <Link href='/marketplace?sort=trending'>
            <Button
              variant='outline'
              size='lg'
              className='rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all'
            >
              See More Trending
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function TrendingNowSectionSkeleton() {
  return (
    <section className='relative py-16 lg:py-24 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='mb-10'>
          <Skeleton className='h-6 w-20 rounded-full mb-3' />
          <Skeleton className='h-8 w-32 rounded' />
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