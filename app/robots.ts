import type { MetadataRoute } from 'next'

const SITE_URL = 'https://www.dhreamarket.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/marketplace', '/marketplace/category', '/marketplace/product', '/vendor', '/about', '/contact', '/faq', '/help'],
        disallow: ['/login', '/register', '/dashboard', '/admin', '/api', '/cart', '/checkout', '/payment/', '/verify-email/', '/reset-password/', '/search'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}