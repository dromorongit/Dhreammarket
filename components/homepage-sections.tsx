'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  images: Array<{ id: string; url: string; alt: string | null }>
  store?: { id: string; name: string; isVerified: boolean }
  category?: { id: string; name: string }
}

interface HomepageSectionData {
  id: string
  name: string
  slug: string
  type: string
  subtitle: string | null
  products: Product[]
  vendors: any[]
}

interface HomepageSectionProps {
  section: HomepageSectionData
}

// Compact product card used across all product-grid sections
function CompactProductCard({ product }: { product: Product }) {
  return (
    <Card variant="elevated" className="group overflow-hidden hover:shadow-xl transition-all duration-300">
      <Link href={`/marketplace/product/${product.id}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {product.images?.[0] ? (
            <img
              src={product.images[0].url}
              alt={product.images[0].alt || product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {product.store && (
            <Badge variant="verified" size="sm" className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5">
              {product.store.name}
            </Badge>
          )}
        </div>
      </Link>
      <div className="p-2 space-y-1">
        <Link href={`/marketplace/product/${product.id}`} className="block">
          <h3 className="text-[11px] font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold text-royal-blue leading-tight">
            {formatPrice(product.price)}
          </span>
          {product.stock <= 5 && product.stock > 0 && (
            <span className="text-[9px] font-semibold text-rose-500">
              Only {product.stock} left
            </span>
          )}
        </div>
        <Link href={`/marketplace/product/${product.id}`} className="w-full block">
          <Button size="sm" variant="outline" className="w-full h-7 text-[10px] px-2 py-1 rounded-lg">
            View
          </Button>
        </Link>
      </div>
    </Card>
  )
}

// ─── Flash Sales Section ───
export function FlashSalesSection({ section }: HomepageSectionProps) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)
      const diff = endOfDay.getTime() - now.getTime()
      return {
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      }
    }
    setTimeLeft(calculateTimeLeft())
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-b from-rose-50/50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="danger" size="sm">FLASH SALE</Badge>
              {section.subtitle && (
                <span className="text-sm text-slate-500">{section.subtitle}</span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
              {section.name}
            </h2>
          </div>
          {/* Countdown Timer */}
          <div className="flex items-center gap-2">
            {['hours', 'minutes', 'seconds'].map((unit) => (
              <div key={unit} className="text-center">
                <div className="bg-rose-500 text-white text-lg font-bold px-3 py-2 rounded-lg min-w-[48px]">
                  {String(timeLeft[unit as keyof typeof timeLeft]).padStart(2, '0')}
                </div>
                <span className="text-[10px] text-slate-500 uppercase mt-1 block">{unit.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        {section.products.length === 0 ? (
          <EmptyState
            icon={<svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
            title="No flash sale products"
            description="Assign products to this section from the admin panel."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {section.products.map((product) => (
              <div key={product.id} className="relative">
                <CompactProductCard product={product} />
                <Badge variant="danger" size="sm" className="absolute -top-2 -right-2 z-10 text-[9px]">
                  -{Math.floor(Math.random() * 30 + 10)}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Sponsored Products Section ───
export function SponsoredProductsSection({ section }: HomepageSectionProps) {
  return (
    <section className="relative py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="premium" size="sm">SPONSORED</Badge>
              {section.subtitle && (
                <span className="text-sm text-slate-500">{section.subtitle}</span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
              {section.name}
            </h2>
          </div>
        </div>

        {section.products.length === 0 ? (
          <EmptyState
            icon={<svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
            title="No sponsored products"
            description="Assign products to this section from the admin panel."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {section.products.map((product) => (
              <CompactProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Quicklinks Section ───
const QUICKLINK_ICONS: Record<string, string> = {
  Marketplace: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  'New Arrivals': 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  Groceries: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h13.5a3 3 0 00-3-3V7.5M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
  Fashion: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  'New This Week': 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  'Sell on Dhream Market': 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  Televisions: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
  Brands: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  Computers: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
  Restaurants: 'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12',
  'Men Sneakers': 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
  'Ladies Heels': 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
  'Chemical Shops': 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
  'Trending Now': 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
  Appliances: 'M11.42 15.17l-5.4-5.4a1.344 1.344 0 010-1.9l5.4-5.4a1.344 1.344 0 011.9 0l5.4 5.4a1.344 1.344 0 010 1.9l-5.4 5.4a1.344 1.344 0 01-1.9 0z',
}

const QUICKLINK_COLORS: Record<string, string> = {
  Marketplace: 'from-blue-500 to-blue-600',
  'New Arrivals': 'from-emerald-500 to-emerald-600',
  Groceries: 'from-amber-500 to-orange-600',
  Fashion: 'from-pink-500 to-rose-600',
  'New This Week': 'from-violet-500 to-purple-600',
  'Sell on Dhream Market': 'from-royal-blue to-indigo-600',
  Televisions: 'from-cyan-500 to-blue-600',
  Brands: 'from-amber-500 to-yellow-600',
  Computers: 'from-slate-600 to-slate-700',
  Restaurants: 'from-orange-500 to-red-500',
  'Men Sneakers': 'from-teal-500 to-cyan-600',
  'Ladies Heels': 'from-fuchsia-500 to-pink-600',
  'Chemical Shops': 'from-lime-500 to-green-600',
  'Trending Now': 'from-rose-500 to-red-500',
  Appliances: 'from-sky-500 to-blue-600',
}

const QUICKLINK_HREF: Record<string, string> = {
  Marketplace: '/marketplace',
  'New Arrivals': '/marketplace?sort=newest',
  Groceries: '/marketplace?category=groceries',
  Fashion: '/marketplace?category=fashion',
  'New This Week': '/marketplace?sort=newest',
  'Sell on Dhream Market': '/register',
  Televisions: '/marketplace?category=electronics',
  Brands: '/marketplace',
  Computers: '/marketplace?category=electronics',
  Restaurants: '/marketplace?category=services',
  'Men Sneakers': '/marketplace?category=fashion',
  'Ladies Heels': '/marketplace?category=fashion',
  'Chemical Shops': '/marketplace',
  'Trending Now': '/marketplace?sort=popular',
  Appliances: '/marketplace?category=home',
}

const DEFAULT_QUICKLINKS = [
  'Marketplace', 'New Arrivals', 'Groceries', 'Fashion', 'New This Week',
  'Sell on Dhream Market', 'Televisions', 'Brands', 'Computers', 'Restaurants',
  'Men Sneakers', 'Ladies Heels', 'Chemical Shops', 'Trending Now', 'Appliances',
]

export function QuicklinksSection({ section }: HomepageSectionProps) {
  const quicklinks = DEFAULT_QUICKLINKS

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
          {quicklinks.map((name) => (
            <Link
              key={name}
              href={QUICKLINK_HREF[name] || '/marketplace'}
              className="group"
            >
              <Card variant="elevated" className="p-4 text-center hover:shadow-xl transition-all duration-300 group-hover:-translate-y-0.5">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${QUICKLINK_COLORS[name] || 'from-slate-500 to-slate-600'} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={QUICKLINK_ICONS[name] || QUICKLINK_ICONS.Marketplace} />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-deep-navy group-hover:text-royal-blue transition-colors leading-tight">
                  {name}
                </h3>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Gadget Display Section ───
export function GadgetDisplaySection({ section }: HomepageSectionProps) {
  return (
    <section className="relative py-16 lg:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <Badge variant="premium" className="mb-3">Premium Tech</Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-600 mt-2">{section.subtitle}</p>
          )}
        </div>

        {/* Desktop: 2-column large cards */}
        <div className="hidden lg:grid grid-cols-2 gap-6">
          {section.products.slice(0, 4).map((product) => (
            <Link key={product.id} href={`/marketplace/product/${product.id}`}>
              <Card variant="elevated" className="group overflow-hidden hover:shadow-2xl transition-all duration-500">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt || product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L7.5 9h9l-.621-.621A2.25 2.25 0 0115 8.818V3.104m-9 0A2.25 2.25 0 004.875 5.25h4.5A2.25 2.25 0 0011.25 3.104m-9 0V5.25A2.25 2.25 0 004.875 7.5h4.5A2.25 2.25 0 0011.25 5.25" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <Badge variant="premium" size="sm" className="mb-2">Featured</Badge>
                    <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
                    <p className="text-white/80 text-sm mb-3">{product.store?.name}</p>
                    <span className="text-2xl font-bold text-premium-gold">{formatPrice(product.price)}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Mobile: horizontal scroll */}
        <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {section.products.slice(0, 6).map((product) => (
              <Link key={product.id} href={`/marketplace/product/${product.id}`} className="w-64 flex-shrink-0">
                <Card variant="elevated" className="group overflow-hidden hover:shadow-xl transition-all duration-300">
                  <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].alt || product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L7.5 9h9l-.621-.621A2.25 2.25 0 0115 8.818V3.104m-9 0A2.25 2.25 0 004.875 5.25h4.5A2.25 2.25 0 0011.25 3.104" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-sm font-bold text-white line-clamp-1">{product.name}</h3>
                      <span className="text-lg font-bold text-premium-gold">{formatPrice(product.price)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Generic Product Grid Section ───
export function ProductGridSection({ section }: HomepageSectionProps) {
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

        {section.products.length === 0 ? (
          <EmptyState
            icon={<svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
            title="No products assigned"
            description="Assign products to this section from the admin panel."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {section.products.map((product) => (
              <CompactProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Brand Grid Section ───
export function BrandGridSection({ section }: HomepageSectionProps) {
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

        {section.vendors.length === 0 ? (
          <EmptyState
            icon={<svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
            title="No brands assigned"
            description="Assign vendors to this section from the admin panel."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {section.vendors.map((vendor) => (
              <Link key={vendor.id} href={`/marketplace?vendor=${vendor.id}`}>
                <Card variant="elevated" className="group p-6 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center overflow-hidden">
                    {vendor.store?.logo ? (
                      <img src={vendor.store.logo} alt={vendor.store.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-white">
                        {vendor.profile?.firstName?.[0] || vendor.email[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-deep-navy group-hover:text-royal-blue transition-colors line-clamp-1">
                    {vendor.store?.name || vendor.email}
                  </h3>
                  {vendor.store?.isVerified && (
                    <Badge variant="verified" size="sm" className="mt-2">Verified</Badge>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Service Grid Section ───
export function ServiceGridSection({ section }: HomepageSectionProps) {
  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-b from-slate-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <Badge variant="info" className="mb-3">Local Services</Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
            {section.name}
          </h2>
          {section.subtitle && (
            <p className="text-slate-600 mt-2">{section.subtitle}</p>
          )}
        </div>

        {section.vendors.length === 0 ? (
          <EmptyState
            icon={<svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            title="No service vendors assigned"
            description="Assign service vendors to this section from the admin panel."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {section.vendors.map((vendor) => (
              <Card key={vendor.id} variant="elevated" className="group p-5 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-deep-navy group-hover:text-royal-blue transition-colors line-clamp-1">
                  {vendor.store?.name || vendor.email}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Service Provider</p>
                <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-[11px]">
                  Book Now
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Section Renderer ───
export function HomepageSectionRenderer({ section }: HomepageSectionProps) {
  switch (section.type) {
    case 'PRODUCT_GRID':
      return <ProductGridSection section={section} />
    case 'QUICKLINK_CARD_GRID':
      return <QuicklinksSection section={section} />
    case 'LARGE_FEATURE_CARDS':
      return <GadgetDisplaySection section={section} />
    case 'BRAND_GRID':
      return <BrandGridSection section={section} />
    case 'SERVICE_GRID':
      return <ServiceGridSection section={section} />
    default:
      return <ProductGridSection section={section} />
  }
}

// ─── Section Skeleton ───
export function HomepageSectionSkeleton() {
  return (
    <section className="relative py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48 mb-10" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
