'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { MdVerified } from 'react-icons/md';
import { getVendorBadgeInfo } from '@/lib/vendor-badge';
import { type EnterpriseProduct, getEffectivePrice } from '@/lib/homepage-product-utils';
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges';
import { ProductStockIndicator } from '@/components/ProductStockIndicator';
import WishlistButton from '@/components/WishlistButton';
import { formatPrice } from '@/lib/currency';
import { getBlurDataURL, CARD_IMAGE_SIZES_5COL } from '@/lib/image-utils';

function TrendingProductCard({ product, initialIsWishlisted }: { product: EnterpriseProduct; initialIsWishlisted?: boolean }) {
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
          className='group flex flex-col overflow-hidden rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full p-0 w-full border border-gold/20 hover:border-gold/50'
        >
          <div className='relative aspect-[4/3] bg-slate-100 overflow-hidden'>
            <WishlistButton
              productId={product.id}
              initialIsWishlisted={initialIsWishlisted}
              size="sm"
              className="absolute top-2 right-2 z-10"
            />
            {product.images?.[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].alt || product.name}
                className='absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                fill
                loading='lazy'
                sizes={CARD_IMAGE_SIZES_5COL}
                placeholder="blur"
                blurDataURL={getBlurDataURL()}
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
            <ProductStockIndicator stock={product.stock} availabilityType={product.availabilityType} />
          </div>
        </Card>
      </Link>
    </div>
  );
}

export default TrendingProductCard;
