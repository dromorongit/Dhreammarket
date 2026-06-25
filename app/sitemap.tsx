import { MetadataRoute } from 'next'
import { getPrisma } from '@/lib/prisma'

const SITE_URL = 'https://www.dhreamarket.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    { path: '', priority: 1.0, frequency: 'daily' as const },
    { path: '/marketplace', priority: 0.9, frequency: 'daily' as const },
    { path: '/about', priority: 0.6, frequency: 'monthly' as const },
    { path: '/contact', priority: 0.6, frequency: 'monthly' as const },
    { path: '/faq', priority: 0.6, frequency: 'monthly' as const },
    { path: '/help', priority: 0.6, frequency: 'monthly' as const },
    { path: '/terms', priority: 0.5, frequency: 'monthly' as const },
    { path: '/privacy', priority: 0.5, frequency: 'monthly' as const },
  ]

  const staticEntries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.frequency,
    priority: page.priority,
  }))

  const categories = await getPrisma().productCategory.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
  })

  const categoryEntries: MetadataRoute.Sitemap = categories
    .filter((cat): cat is { slug: string; updatedAt: Date } => cat.slug !== null)
    .map((category) => ({
      url: `${SITE_URL}/marketplace/category/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

  const vendorCategories = await getPrisma().vendorCategory.findMany({
    where: { isActive: true },
    select: { slug: true },
  })

  const vendorCategoryEntries: MetadataRoute.Sitemap = vendorCategories
    .filter((cat): cat is { slug: string } => cat.slug !== null)
    .map((vc) => ({
      url: `${SITE_URL}/marketplace/vendor/${vc.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  const vendors = await getPrisma().store.findMany({
    where: { categoryId: { not: null } },
    select: { id: true, updatedAt: true },
  })

  const vendorEntries: MetadataRoute.Sitemap = vendors.map((vendor) => ({
    url: `${SITE_URL}/vendor/${vendor.id}`,
    lastModified: vendor.updatedAt ?? new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const products = await getPrisma().product.findMany({
    where: {
      OR: [
        { stock: { gt: 0 } },
        { availabilityType: 'PREORDER' },
        { availabilityType: 'BACKORDER' },
      ],
    },
    select: { id: true, updatedAt: true },
  })

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/marketplace/product/${product.id}`,
    lastModified: product.updatedAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [...staticEntries, ...categoryEntries, ...vendorCategoryEntries, ...vendorEntries, ...productEntries]
}