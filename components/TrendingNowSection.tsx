'use client';

import { useState, useEffect, useCallback } from 'react';
import { type EnterpriseProduct } from '@/lib/homepage-product-utils';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import ScrollableRow from './ScrollableRow';
import TrendingProductCard from './TrendingProductCard';


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

  if (loading) {
    return <TrendingNowSectionSkeleton />;
  }
  
  const products = section?.products ?? [];
  if (!products.length) {
    return (
      <section className='relative py-10 lg:py-14 bg-rose-50/[0.05] overflow-hidden'>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='bg-cream py-3 -mx-4 sm:-mx-6 lg:-mx-8'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
              <h2 className='text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy'>
                {section.name}
              </h2>
              {section.subtitle && (
                <p className='mt-1 text-[11px] text-deep-navy'>
                  {section.subtitle}
                </p>
              )}
            </div>
          </div>
          <EmptyState icon={<svg className='w-12 h-12 text-slate-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' /></svg>} title='No products yet' description='Check back soon for trending products.' />
        </div>
      </section>
    );
  }

  const displayProducts = products.slice(0, 20);
  const half = Math.ceil(displayProducts.length / 2);
  const topRowProducts = displayProducts.slice(0, half);
  const bottomRowProducts = displayProducts.slice(half);

  return (
      <section id='homepage-trending-now' className='relative py-10 lg:py-14 bg-rose-50/[0.05] overflow-hidden'>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3 mb-4'>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-orange-400 text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm'>
              <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'><path fillRule='evenodd' d='M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z' clipRule='evenodd'/></svg>
              TRENDING
            </span>
          </div>
          <div className='bg-cream py-3 -mx-4 sm:-mx-6 lg:-mx-8'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
              <h2 className='text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy'>
                {section.name}
              </h2>
              {section.subtitle && (
                <p className='mt-1 text-[11px] text-deep-navy'>
                  {section.subtitle}
                </p>
              )}
            </div>
          </div>

        <div className='space-y-4'>
          {topRowProducts.length > 0 && (
            <ScrollableRow>
              {topRowProducts.map((product) => (
                <TrendingProductCard
                  key={product.id}
                  product={product}
                  initialIsWishlisted={wishlistedProductIds.has(product.id)}
                />
              ))}
            </ScrollableRow>
          )}
          {bottomRowProducts.length > 0 && (
            <ScrollableRow>
              {bottomRowProducts.map((product) => (
                <TrendingProductCard
                  key={product.id}
                  product={product}
                  initialIsWishlisted={wishlistedProductIds.has(product.id)}
                />
              ))}
            </ScrollableRow>
          )}
        </div>

        <div className='mt-4 text-center'>
          <Link href='/marketplace?sort=trending'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full px-4 py-1.5 font-semibold shadow-sm hover:shadow-md transition-all'
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
    <section className='relative py-10 lg:py-14 bg-slate-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='mb-6'>
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