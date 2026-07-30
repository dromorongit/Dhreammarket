'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges'

import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import ServiceCard from '@/components/ServiceCard'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { event } from '@/lib/gtag'
import { MdVerified } from 'react-icons/md'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { handleAuthRedirect, dispatchCartUpdate, logCartRequest } from '@/lib/CartContext'
import {
  HomepageSectionRenderer,
  HomepageSectionSkeleton,
  TrendingServicesSection,
  NewServicesSection,
  VerifiedVendorsSection,
  SponsoredSection,
} from '@/components/homepage-sections'
import {
  useEnterpriseHomepageData,
  FlashSalesSection,
  EnterpriseGadgetDisplaySection,
  TopSellingSection,
  BigTopDealsSection,
  BrandStoreSection,
  buildEnterpriseSections,
  TopClearanceSalesSection,
  TopServicesSection,
  HomeTheatreSection,
  TopExpressOffersSection,
  QuickLinksSection,
  NewArrivalsSection,
  NewThisWeekSection,
} from '@/components/homepage-enterprise-sections'
import { TrendingNowSection } from '@/components/TrendingNowSection'
import BannerSlider from '@/components/BannerSlider'
import { useManagedHomepageData } from '@/components/homepage-managed-data'

import { collectProductIds } from '@/lib/homepage-product-utils'
import { isManagedSectionSlug } from '@/lib/homepage-constants'

interface Category {
  id: string
  name: string
  slug: string
}

interface FeaturedVendor {
   id: string
   name: string
   description: string | null
   isVerified: boolean
   badgeTier: string | null
   isFeatured: boolean
   logo: string | null
   rating: number
   productCount: number
   category: { id: string; name: string; slug: string } | null
 }

export default function Home() {
  const { data: featuredVendorsData, isLoading: loadingFeatured } = useQuery<{ vendors: FeaturedVendor[] }>({
    queryKey: ['vendors', 'featured'],
    queryFn: async () => {
      const response = await fetch('/api/vendors/featured')
      if (!response.ok) throw new Error('Failed to fetch featured vendors')
      return response.json()
    },
  })
  const featuredVendors = featuredVendorsData?.vendors ?? []
  const { data: enterpriseData, loading: loadingEnterprise } = useEnterpriseHomepageData()
  const { sectionsBySlug, data: managedData, loading: loadingManaged } = useManagedHomepageData()
  const enterpriseSections = useMemo(
    () => buildEnterpriseSections(enterpriseData),
    [enterpriseData]
  )

  const excludeFromFeaturedIds = useMemo(() => {
    const ids = new Set(enterpriseSections.excludeFromFeaturedIds)
    const trending = sectionsBySlug['trending-now']?.products ?? []
    const trendingServices = sectionsBySlug['trending-services']?.services ?? []
    const flash = sectionsBySlug['flash-sales']?.products ?? []
    const sponsored = sectionsBySlug['sponsored']?.products ?? []
    const topClearance = sectionsBySlug['top-clearance-sales']?.products ?? []
    const homeTheatre = sectionsBySlug['home-theatre']?.products ?? []
    const topExpress = sectionsBySlug['top-express-offers']?.products ?? []
    collectProductIds(trending).forEach((id) => ids.add(id))
    collectProductIds(flash).forEach((id) => ids.add(id))
    collectProductIds(sponsored).forEach((id) => ids.add(id))
    collectProductIds(topClearance).forEach((id) => ids.add(id))
    collectProductIds(homeTheatre).forEach((id) => ids.add(id))
    collectProductIds(topExpress).forEach((id) => ids.add(id))
    return ids
  }, [enterpriseSections.excludeFromFeaturedIds, sectionsBySlug])

  const extraSections = useMemo(
    () => managedData.sections.filter((s) => !isManagedSectionSlug(s.slug)),
    [managedData.sections]
  )

 return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          preload="metadata"
        >
          <source src="/assets/videos/Homepage.MP4" type="video/mp4" />
        </video>
        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-deep-navy/80 via-royal-blue/70 to-purple-900/60"></div>

        {/* Decorative elements - positioned below navbar to prevent bleeding */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 -right-40 w-80 h-80 bg-royal-blue/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.15),transparent_70%)]"></div>
        </div>

        {/* Nav spacer */}
        <div className="h-16 sm:h-20"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8 animate-fade-in-up">
              <Badge variant="verified" size="sm">
                Trusted by 10,000+ Businesses
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 tracking-tight leading-tight animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Powering Digital Trade
              <br />
              <span className="bg-gradient-to-r from-royal-blue via-purple-400 to-premium-gold bg-clip-text text-transparent">
                The Smart Way
              </span>
            </h1>

            <p className="text-lg sm:text-xl lg:text-2xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              The premier commerce ecosystem connecting businesses and people worldwide. Trade smarter, faster, and more securely with our all-in-one platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <Link href="/register">
                <Button size="lg" className="px-10 py-4 shadow-lg shadow-royal-blue/30">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" size="lg" className="px-10 py-4 border-white/30 text-white hover:bg-white/10">
                  Explore Marketplace
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-8 mt-16 text-slate-400 text-sm animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Secure Payments
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                24/7 Support
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Verified Sellers
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ─── Premium Promotional Banner Slider ─── */}
      <BannerSlider />

      {/* ─── Managed homepage sections rendered by displayOrder ─── */}
      {managedData.sections
        .filter((s) => isManagedSectionSlug(s.slug))
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((section) => {
          const sectionProps = {
            id: section.id,
            name: section.name,
            slug: section.slug,
            type: section.type,
            subtitle: section.subtitle,
            displayOrder: section.displayOrder,
            contentSource: section.contentSource,
            products: section.products,
            services: section.services,
            vendors: section.vendors,
            brands: section.brands || [],
          }
          if (section.slug === 'sponsored')
            return <SponsoredSection key={section.id} section={sectionProps} />
          if (section.slug === 'trending-now')
            return <TrendingNowSection key={section.id} section={sectionProps} loading={loadingManaged} />
          if (section.slug === 'trending-services')
            return <TrendingServicesSection key={section.id} section={sectionProps} />
          if (section.slug === 'verified-vendors')
            return <VerifiedVendorsSection key={section.id} section={sectionProps} />
          if (section.slug === 'flash-sales')
            return <FlashSalesSection key={section.id} section={sectionProps} loading={loadingManaged} />
          if (section.slug === 'gadget-display')
            return <EnterpriseGadgetDisplaySection key={section.id} section={sectionProps} loading={loadingManaged} />
          if (section.slug === 'big-top-deals')
            return <BigTopDealsSection key={section.id} section={sectionProps} loading={loadingManaged} />
          if (section.slug === 'brand-store')
            return (
              <BrandStoreSection
                key={section.id}
                section={sectionProps}
                brands={section.brands || []}
                loading={loadingManaged}
              />
            )
          if (section.slug === 'top-clearance-sales')
            return <TopClearanceSalesSection key={section.id} section={sectionProps} loading={loadingManaged} />
           if (section.slug === 'top-services')
             return <TrendingServicesSection key={section.id} section={sectionProps} />
          if (section.slug === 'home-theatre')
            return <HomeTheatreSection key={section.id} section={sectionProps} loading={loadingManaged} />
           if (section.slug === 'top-express-offers')
             return <TopExpressOffersSection key={section.id} section={sectionProps} loading={loadingManaged} />
           if (section.slug === 'new-services')
             return <NewServicesSection key={section.id} section={sectionProps} />
           return null
        })}

      {/* ─── Featured Products (always shown) ─── */}
      {!loadingManaged && (
        <section className="relative py-24 lg:py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="premium" className="mb-4">Featured Products</Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
                Explore Marketplace
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Discover premium products from our trusted vendors
              </p>
            </div>
            <FeaturedProductsSection excludeIds={excludeFromFeaturedIds} />
          </div>
        </section>
      )}

      {/* ─── Featured Services (always shown) ─── */}
      <FeaturedServicesSection />

      {/* ─── Quick Links Section (hardcoded) ─── */}
      {!loadingManaged && (
        <QuickLinksSection />
      )}

      {/* ─── New Arrivals Section (hardcoded) ─── */}
      {!loadingManaged && (
        <NewArrivalsSection excludeIds={excludeFromFeaturedIds} />
      )}

      {/* ─── New This Week Section (hardcoded) ─── */}
      {!loadingManaged && (
        <NewThisWeekSection excludeIds={excludeFromFeaturedIds} />
      )}


      <TopSellingSection products={enterpriseSections.topSelling} loading={loadingEnterprise} />

      {/* ─── Optional extra custom sections (non-core) ─── */}
      {loadingManaged ? (
        <>
          <HomepageSectionSkeleton />
        </>
      ) : extraSections.length > 0 ? (
        extraSections.map((section) => (
          <HomepageSectionRenderer key={section.id} sections={[section]} />
        ))
      ) : null}

      {/* ─── Shop by Vendor Type ─── */}
      {!loadingManaged && (
        <section className="relative py-24 lg:py-32 bg-white">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <Badge variant="premium" className="mb-4">Browse Vendors</Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
                Shop by Vendor Type
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Discover trusted vendors across different categories
              </p>
            </div>
            <VendorCategorySection />
          </div>
        </section>
      )}

      {/* ─── Fallback: Top Vendors (only when no extra sections) ─── */}
      {!loadingManaged && extraSections.length === 0 && (
        <section className="relative py-24 lg:py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="premium" className="mb-4">Top Rated</Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
                Top Vendors
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Our highest-rated vendors with exceptional customer satisfaction
              </p>
            </div>
            <TopVendorsSection />
          </div>
        </section>
      )}

      {/* ─── Fallback: New Vendors (only when no extra sections) ─── */}
      {!loadingManaged && extraSections.length === 0 && (
        <section className="relative py-24 lg:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="premium" className="mb-4">Just Joined</Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
                New Vendors
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Fresh faces on Dhream Market - check out the latest additions
              </p>
            </div>
            <NewVendorsSection />
          </div>
        </section>
      )}

{/* ─── Fallback: Popular Categories (only when no extra sections) ─── */}
      {!loadingManaged && extraSections.length === 0 && (
        <section className="relative py-24 lg:py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="premium" className="mb-4">Browse By</Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
                Popular Categories
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Explore products across our most popular categories
              </p>
            </div>
            <PopularCategoriesSection />
          </div>
        </section>
      )}

      {/* Featured Vendors Preview Section */}
      {!loadingFeatured && featuredVendors.length > 0 && (
        <section className="relative py-24 lg:py-32 bg-white">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="animate-fade-in-up">
                <Badge variant="premium" className="mb-4">Vendor Program</Badge>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
                  Join Our Vendor Network
                </h2>
                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  Start selling on Dhream Market and reach thousands of active buyers. Our platform provides everything you need to build, manage, and grow your business.
                </p>
                <ul className="space-y-4 mb-10">
                  {[
                    'Zero upfront costs',
                    'Built-in payment processing',
                    'Marketing and promotion tools',
                    'Dedicated seller support',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-royal-blue/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button size="lg" className="shadow-lg shadow-royal-blue/20">
                    Register as Vendor
                  </Button>
                </Link>
              </div>

              <div className="relative animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Card variant="elevated" className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-royal-blue to-purple-600"></div>
                        <div>
                          <p className="font-semibold text-deep-navy">TechGadgets Pro</p>
                          <Badge variant="verified" size="sm">Verified</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">&quot;Best platform for our electronics business. Sales up 300% in 6 months!&quot;</p>
                    </Card>
                    <Card variant="elevated" className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-600"></div>
                        <div>
                          <p className="font-semibold text-deep-navy">StyleHub Fashion</p>
                          <Badge variant="verified" size="sm">Verified</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">&quot;Easy to use dashboard and great customer support. Highly recommend!&quot;</p>
                    </Card>
                  </div>
                  <div className="space-y-4 pt-8">
                    <Card variant="elevated" className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600"></div>
                        <div>
                          <p className="font-semibold text-deep-navy">HomeEssentials</p>
                          <Badge variant="verified" size="sm">Verified</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">&quot;Our revenue doubled after joining. The tools are incredible!&quot;</p>
                    </Card>
                    <Card variant="elevated" className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600"></div>
                        <div>
                          <p className="font-semibold text-deep-navy">ServiceMasters</p>
                          <Badge variant="verified" size="sm">Verified</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">&quot;Professional platform with everything we need to scale.&quot;</p>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Dhream Market Section */}
      <section className="relative py-24 lg:py-32 bg-slate-50">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjVmN2ZhIiBvcGFjaXR5PSIwLjMiLz4KPHBhdGggZD0iTTQwIDJIMHY0MEg0MFoiIGZpbGw9IiNmMGY3ZmEiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4K')] opacity-50"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 lg:mb-24 animate-fade-in-up">
            <Badge variant="premium" className="mb-4">Our Promise</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
              Why Choose Dhream Market?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Built for the future of digital commerce with trust, efficiency, and scalability at its core.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card variant="elevated" className="group animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-deep-navy mb-3">Trusted Platform</h3>
              <p className="text-slate-600 leading-relaxed">
                Secure, reliable infrastructure designed for B2B, B2C, and P2P transactions with enterprise-grade security and compliance.
              </p>
            </Card>

            <Card variant="elevated" className="group animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-deep-navy mb-3">Smart Automation</h3>
              <p className="text-slate-600 leading-relaxed">
                Streamlined workflows and intelligent features that make digital trade efficient, seamless, and profitable.
              </p>
            </Card>

            <Card variant="elevated" className="group animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-premium-gold to-amber-600 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0 6v-6m0 0V14m0-6v6m6 0v-6m0 0V14m0-6v6m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-deep-navy mb-3">Scalable Growth</h3>
              <p className="text-slate-600 leading-relaxed">
                Built to grow with your business, from solo vendors to large enterprises with global reach.
              </p>
            </Card>
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-deep-navy via-royal-blue/90 to-purple-900"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZmVmN2ZhIiBvcGFjaXR5PSIwLjAiLz4KPHBhdGggZD0iTTYwIDJIMjZ2NTZIWDYwWiIgZmlsbD0iI2ZmZjdmZmEiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4K')] opacity-20"></div>

        <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <Badge variant="premium" className="mb-6">Get Started Today</Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to Transform Your Digital Trade?
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join thousands of businesses already using Dhream Market for their commerce needs. Start free, upgrade as you grow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-10 py-4 shadow-lg shadow-royal-blue/30">
                Create Free Account
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" size="lg" className="px-10 py-4 border-white/30 text-white hover:bg-white/10">
                Browse Marketplace
              </Button>
            </Link>
          </div>

          <p className="text-sm text-slate-500 mt-8">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>
    </div>
  )
}

// ─── Existing Section Components (preserved as fallback) ───

function VendorCategorySection() {
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('')

  const { data: categoriesData, isLoading: loadingCategories } = useQuery<{ categories: Category[] }>({
    queryKey: ['vendor-categories'],
    queryFn: async () => {
      const response = await fetch('/api/vendor-categories')
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

  // Helper function to render category chips
  const renderVendorCategoryChips = () => (
    <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2">
      <button
        onClick={() => setSelectedVendorCategory('')}
        className={`min-h-[48px] px-6 py-3 rounded-2xl font-semibold text-sm flex-shrink-0 snap-start transition-all duration-200 shadow-sm hover:shadow-md ${
          selectedVendorCategory === ''
            ? 'bg-royal-blue text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        All Vendors
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => setSelectedVendorCategory(category.id)}
          className={`min-h-[48px] px-6 py-3 rounded-2xl font-semibold text-sm flex-shrink-0 snap-start transition-all duration-200 shadow-sm hover:shadow-md ${
            selectedVendorCategory === category.id
              ? 'bg-royal-blue text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {/* Category Filter Chips - Horizontal Scrollable */}
      {renderVendorCategoryChips()}

      {/* Vendors Horizontal Scrollable Row */}
      {loading ? (
        <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
          {[...Array(4)].map((_, i) => (
            <Card key={i} variant="elevated" className="flex-shrink-0 snap-start p-6 w-[260px] sm:w-[300px] lg:w-[340px] h-full flex flex-col">
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-200 mx-auto"></div>
                <div className="h-5 bg-slate-200 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-slate-100 rounded w-full"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredVendors.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          title="No vendors found"
          description={selectedVendorCategory ? "No vendors in this category yet. Check back soon!" : "No vendors available yet."}
        />
      ) : (
        <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
           {filteredVendors.map((vendor) => (
             <Link key={vendor.id} href={`/marketplace?vendor=${vendor.id}`}>
               <Card variant="elevated" className="flex-shrink-0 snap-start group hover:shadow-xl transition-all duration-300 p-6 text-center w-[260px] sm:w-[300px] lg:w-[340px] h-full flex flex-col">
<div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                    {vendor.logo ? (
                      <Image
                        src={vendor.logo}
                        alt={vendor.name}
                        className="object-cover w-full h-full"
                        fill
                      />
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
                    {vendor._count?.products || 0} products
                  </p>
               </Card>
             </Link>
           ))}
         </div>
       )}
     </>
   )
 }

// Top Vendors Section Component
function TopVendorsSection() {
  const { data, isLoading } = useQuery<{ vendors: any[] }>({
    queryKey: ['vendors', { limit: 4, sortBy: 'rating' }],
    queryFn: async () => {
      const response = await fetch('/api/vendors?limit=4&sortBy=rating')
      if (!response.ok) throw new Error('Failed to fetch top vendors')
      return response.json()
    },
  })
  const vendors = data?.vendors?.slice(0, 4) ?? []

  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} variant="elevated" className="flex-shrink-0 snap-start p-6 w-[260px] sm:w-[300px] lg:w-[340px] h-full flex flex-col">
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-slate-200 mx-auto" />
              <div className="h-5 bg-slate-200 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
     <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
       {vendors.map((vendor) => (
         <Link key={vendor.id} href={`/vendor/${vendor.slug ?? vendor.id}`}>
           <Card variant="elevated" className="flex-shrink-0 snap-start group hover:shadow-xl transition-all duration-300 p-6 text-center w-[260px] sm:w-[300px] lg:w-[340px] h-full flex flex-col">
<div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                 {vendor.logo ? (
                   <Image src={vendor.logo} alt={vendor.name} className="object-cover" fill />
                 ) : (
                   <span className="text-2xl font-bold text-white">
                     {truncateVendorName(vendor.name).charAt(0).toUpperCase()}
                   </span>
                 )}
               </div>
              <div className="flex items-center justify-center gap-1 mb-2">
<svg className="w-5 h-5 text-premium-gold" fill="currentColor" viewBox="0 0 20 20">
                   <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                 </svg>
                 <span className="font-bold text-deep-navy">{vendor.rating.toFixed(1)}</span>
               </div>
               <div className="flex items-center justify-center gap-1 min-w-0 mb-2">
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
                 <Badge variant="default" size="sm" className="mb-2">
                   {vendor.vendor_categories.name}
                 </Badge>
               )}
               <p className="text-sm text-slate-600">
                 {vendor._count?.products || 0} products
               </p>
             </Card>
           </Link>
         ))}
       </div>
     )
   }

// New Vendors Section Component
function NewVendorsSection() {
  const { data, isLoading } = useQuery<{ vendors: any[] }>({
    queryKey: ['vendors', 'all', { limit: 4 }],
    queryFn: async () => {
      const response = await fetch('/api/vendors?limit=4')
      if (!response.ok) throw new Error('Failed to fetch new vendors')
      return response.json()
    },
  })
  const vendors = data?.vendors ?? []

  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} variant="elevated" className="flex-shrink-0 snap-start p-6 w-[260px] sm:w-[300px] lg:w-[340px] h-full flex flex-col">
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-slate-200 mx-auto" />
              <div className="h-5 bg-slate-200 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
     <div className="flex gap-6 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
       {vendors.map((vendor) => (
         <Link key={vendor.id} href={`/vendor/${vendor.slug ?? vendor.id}`}>
           <Card variant="elevated" className="flex-shrink-0 snap-start group hover:shadow-xl transition-all duration-300 p-6 text-center w-[260px] sm:w-[300px] lg:w-[340px] h-full flex flex-col">
<div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                 {vendor.logo ? (
                   <Image src={vendor.logo} alt={vendor.name} className="object-cover" fill />
                 ) : (
                   <span className="text-2xl font-bold text-white">
                     {truncateVendorName(vendor.name).charAt(0).toUpperCase()}
                   </span>
                 )}
               </div>
<div className="flex items-center justify-center gap-1 min-w-0 mb-2">
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
                 <Badge variant="default" size="sm" className="mb-2">
                   {vendor.vendor_categories.name}
                 </Badge>
               )}
               <div className="flex items-center justify-center gap-1 text-sm text-slate-500 mb-2">
                 <svg className="w-4 h-4 text-premium-gold" fill="currentColor" viewBox="0 0 20 20">
                   <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                 </svg>
                 <span>{vendor.rating.toFixed(1)}</span>
               </div>
               <p className="text-xs text-slate-400">
                 Joined {new Date(vendor.createdAt).toLocaleDateString()}
               </p>
            </Card>
          </Link>
        ))}
      </div>
   )
}

// Popular Categories Section Component
function PopularCategoriesSection() {
  const { data: categoriesData, isLoading } = useQuery<{ categories: any[] }>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      return response.json()
    },
  })
  const categories = categoriesData?.categories ?? []

  const shuffledCategories = useMemo(() => {
    const shuffled = [...categories].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 4)
  }, [categories])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} variant="elevated" className="p-6">
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 mx-auto" />
              <div className="h-5 bg-slate-200 rounded w-3/4 mx-auto" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const categoryIcons: Record<string, string> = {
    'Electronics': 'M9.33 4.062a3 3 0 012.64 0l7.5 4.062a3 3 0 011.53 2.594v8.124a3 3 0 01-1.53 2.594l-7.5 4.062a3 3 0 01-2.64 0l-7.5-4.062a3 3 0 01-1.53-2.594V10.718a3 3 0 011.53-2.594l7.5-4.062z',
    'Services': 'M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
    'Fashion': 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
    'Home & Garden': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M5.25 12v7a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5v-7m-18 0h18',
  }

  const categoryColors: Record<string, string> = {
    'Electronics': 'from-blue-500 to-cyan-600',
    'Services': 'from-purple-500 to-pink-600',
    'Fashion': 'from-pink-500 to-rose-600',
    'Home & Garden': 'from-green-500 to-emerald-600',
  }

   return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {shuffledCategories.map((category) => (
        <Link key={category.id} href={`/marketplace?category=${category.id}`}>
          <Card variant="elevated" className="group text-center p-6 hover:shadow-xl transition-all duration-300">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${categoryColors[category.name] || 'from-gray-500 to-gray-600'} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryIcons[category.name] || 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'} />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-deep-navy group-hover:text-royal-blue transition-colors">
              {category.name}
            </h3>
            <p className="text-sm text-slate-500 mt-1">Browse products</p>
          </Card>
        </Link>
      ))}
    </div>
  )
}

// Featured Products Section Component
interface Product {
  id: string
  slug: string
  name: string
  description: string | null
  price: number
  flashSalePrice?: number | null
  salesPrice?: number | null
  dealsPrice?: number | null
  stock: number
  availabilityType?: string
  expectedArrivalDate?: string | null
  expectedRestockDate?: string | null
  category?: {
    id: string
    name: string
  }
  store?: {
    id: string
    name: string
    isVerified?: boolean
  }
  images?: Array<{
    id: string
    url: string
    alt: string | null
  }>
  isSponsored?: boolean
  isFeatured?: boolean
}

function FeaturedProductsSection({ excludeIds }: { excludeIds?: Set<string> }) {
  const excludeKey = useMemo(() => excludeIds ? Array.from(excludeIds).sort().join(',') : '', [excludeIds])

  const { data, isLoading } = useQuery<{ products: any[] }>({
    queryKey: ['products', 'featured', excludeKey],
    queryFn: async () => {
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Failed to fetch products')
      return response.json()
    },
  })
  const allProducts = data?.products ?? []
  const products = useMemo(() => {
    return allProducts
      .filter((p: Product) => (p.stock > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER') && !excludeIds?.has(p.id))
      .slice(0, 20)
  }, [allProducts, excludeIds])
  const loading = isLoading

  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set())

   const addToCart = async (productId: string, productName?: string, productPrice?: number) => {
      setAddingToCart(prev => new Set(prev).add(productId))
      try {
        logCartRequest('POST /api/cart (homepage addToCart)')
        const response = await fetch('/api/cart', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ productId, quantity: 1 })
       })

       if (response.status === 401) {
         handleAuthRedirect()
         return
       }

       if (response.ok) {
         dispatchCartUpdate()
         if (productName !== undefined && productPrice !== undefined) {
           event({ action: 'add_to_cart', category: 'ecommerce', label: productName, value: productPrice })
         }
         // Could show success toast here
       }
     } catch (error) {
       console.error('Error adding to cart:', error)
     } finally {
       setAddingToCart(prev => {
         const next = new Set(prev)
         next.delete(productId)
         return next
       })
     }
   }

  if (loading) {
     return (
       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
         {[...Array(12)].map((_, i) => (
           <SkeletonCard key={i} />
         ))}
       </div>
     )
    }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
        title="No products available"
        description="Check back soon for new products from our vendors."
      />
    )
  }

  return (
    <>
{/* Mobile: 2 columns, up to 6 rows (12 products) */}
       <div className="grid grid-cols-2 gap-4 lg:gap-6 sm:hidden">
         {products.slice(0, 12).map((product) => {
           const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
           return (
             <Card
               key={product.id}
               variant="elevated"
               className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0"
             >
<Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden w-full">
                    {(product.images?.length ?? 0) > 0 ? (
                      <Image
                        src={product.images![0].url}
                        alt={product.images![0].alt || product.name}
                        className="object-cover"
                        fill
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
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
                     isSponsored: product.isSponsored,
                     isFeatured: product.isFeatured,
                   })} />
                 </div>
               </Link>
               <div className="p-2 space-y-1 flex-1 flex flex-col">
<Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                    <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                     {product.name}
                   </h3>
                 </Link>
                 <div className="flex items-center gap-1.5 flex-wrap">
                   <span className="text-[11px] font-bold text-royal-blue">
                     {formatPrice(effectivePrice)}
                   </span>
                   {effectivePrice < product.price && (
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
                 <div className="flex flex-col gap-1 pt-0.5">
                   <Button
                     size="sm"
                     className="w-full h-7 text-[11px] px-2 py-1 rounded-lg"
                     disabled={addingToCart.has(product.id)}
                     onClick={() => addToCart(product.id)}
                   >
                     {addingToCart.has(product.id) ? 'Adding...' : 'Add to Cart'}
                   </Button>
<Link href={`/marketplace/product/${product.slug ?? product.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Tablet: 3 columns, up to 5 rows (15 products) */}
        <div className="hidden sm:grid lg:hidden sm:grid-cols-3 gap-4 lg:gap-6">
          {products.slice(0, 15).map((product) => {
            const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
            return (
              <Card
                key={product.id}
                variant="elevated"
                className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0"
              >
                <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden w-full">
                    {(product.images?.length ?? 0) > 0 ? (
                      <Image
                        src={product.images![0].url}
                        alt={product.images![0].alt || product.name}
                        className="object-cover"
                        fill
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
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
                      isSponsored: product.isSponsored,
                      isFeatured: product.isFeatured,
                    })} />
                  </div>
                </Link>
                <div className="p-2 space-y-1 flex-1 flex flex-col">
                  <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                    <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-royal-blue">
                      {formatPrice(effectivePrice)}
                    </span>
                    {effectivePrice < product.price && (
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
                  <div className="flex flex-col gap-1 pt-0.5">
                    <Button
                      size="sm"
                      className="w-full h-7 text-[11px] px-2 py-1 rounded-lg"
                      disabled={addingToCart.has(product.id)}
                      onClick={() => addToCart(product.id, product.name, product.price)}
                    >
                      {addingToCart.has(product.id) ? 'Adding...' : 'Add to Cart'}
                    </Button>
                    <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Desktop: 5 columns, up to 4 rows (20 products) */}
        <div className="hidden lg:grid lg:grid-cols-5 gap-4 lg:gap-6">
          {products.slice(0, 20).map((product) => {
            const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
            return (
              <Card
                key={product.id}
                variant="elevated"
                className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0"
              >
                <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden w-full">
                    {(product.images?.length ?? 0) > 0 ? (
                      <Image
                        src={product.images![0].url}
                        alt={product.images![0].alt || product.name}
                        className="object-cover"
                        fill
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
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
                      isSponsored: product.isSponsored,
                      isFeatured: product.isFeatured,
                    })} />
                  </div>
                </Link>
                <div className="p-2 space-y-1 flex-1 flex flex-col">
                  <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                    <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-royal-blue">
                      {formatPrice(effectivePrice)}
                    </span>
                    {effectivePrice < product.price && (
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
                  <div className="flex flex-col gap-1 pt-0.5">
                    <Button
                      size="sm"
                      className="w-full h-7 text-[11px] px-2 py-1 rounded-lg"
                      disabled={addingToCart.has(product.id)}
                      onClick={() => addToCart(product.id, product.name, product.price)}
                    >
                      {addingToCart.has(product.id) ? 'Adding...' : 'Add to Cart'}
                    </Button>
                    <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

      {/* See More button - always visible */}
      <div className="mt-8 text-center">
        <Link href="/marketplace">
          <Button variant="outline" size="lg" className="rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all">
            See More
          </Button>
        </Link>
      </div>
    </>
  )
}

function FeaturedServicesSection() {
  const { data, isLoading } = useQuery<{ services: any[] }>({
    queryKey: ['services', 'featured'],
    queryFn: async () => {
      const response = await fetch('/api/services?isFeatured=true&limit=8')
      if (!response.ok) throw new Error('Failed to fetch featured services')
      return response.json()
    },
  })
  const services = data?.services ?? []
  const loading = isLoading

  const renderServiceRail = (serviceList: any[]) => (
    <div className="flex gap-4 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
      {serviceList.map((service) => (
        <ServiceCard key={service.id} service={service} className="flex-shrink-0 snap-start w-[280px] sm:w-[300px] lg:w-[320px]" />
      ))}
    </div>
  )

  const renderSkeletonRail = () => (
    <div className="flex gap-4 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[280px] sm:w-[300px] lg:w-[320px]">
          <SkeletonCard />
        </div>
      ))}
    </div>
  )

  return (
    <section className="relative py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="premium" className="mb-4">Featured Services</Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-6">
            Explore Services
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Discover premium services from our trusted vendors
          </p>
        </div>
        {loading ? (
          <div className="space-y-4">
            {renderSkeletonRail()}
            {renderSkeletonRail()}
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            title="No services available"
            description="Check back soon for new services from our vendors."
          />
        ) : (
          <>
            <div className="space-y-4">
              {services.length > 4 ? (
                <>
                  {renderServiceRail(services.slice(0, 4))}
                  {renderServiceRail(services.slice(4, 8))}
                </>
              ) : (
                renderServiceRail(services)
              )}
            </div>

            <div className="mt-8 text-center">
              <Link href="/services">
                <Button variant="outline" size="lg" className="rounded-2xl px-8 py-3 font-semibold shadow-sm hover:shadow-md transition-all">
                  See More
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
