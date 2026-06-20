import { MetadataRoute } from 'next'
import { getPrisma } from '@/lib/prisma'

const SITE_URL = 'https://www.dhreamarket.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    '',
    '/marketplace',
    '/login',
    '/register',
    '/cart',
    '/checkout',
    '/help',
    '/contact',
    '/about',
    '/faq',
    '/privacy',
    '/terms',
    '/payment-policy',
    '/refund',
    '/search',
    '/help/creating-account',
    '/help/placing-orders',
    '/help/making-payments',
    '/help/creating-store',
    '/help/vendor-verification',
    '/help/kyc-submission',
    '/help/managing-products',
    '/help/managing-inventory',
    '/help/purchase-orders',
    '/help/preorders',
    '/help/backorders',
    '/help/fulfillment-workflow',
    '/help/tracking-orders',
    '/help/restock-orders',
    '/help/returns',
    '/help/refunds',
  ]

  const staticEntries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${SITE_URL}${page}`,
    lastModified: new Date(),
    changeFrequency: page === '' ? 'daily' : 'monthly',
    priority: page === '' ? 1 : 0.6,
  }))

  const vendors = await getPrisma().store.findMany({
    where: {
      categoryId: { not: null },
    },
    select: { id: true },
  })

  const vendorEntries: MetadataRoute.Sitemap = vendors.map((vendor) => ({
    url: `${SITE_URL}/vendor/${vendor.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const products = await getPrisma().product.findMany({
    select: { id: true },
  })

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/marketplace/product/${product.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticEntries, ...vendorEntries, ...productEntries]
}