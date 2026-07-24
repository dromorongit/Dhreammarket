import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/lib/CartContext'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { Suspense } from 'react'
import { getPlatformName, getPlatformTimezone, formatDateForPlatform, getDefaultCurrency, getBrandingPreferences } from '@/lib/platform-preferences'

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName()
  const timezone = await getPlatformTimezone()
  const defaultCurrency = await getDefaultCurrency()
  const branding = await getBrandingPreferences()
  const faviconUrl = branding.favicon || '/favicon.ico'
  const now = new Date()
  
  return {
    title: {
      default: `${platformName} - Powering Digital Trade`,
      template: `%s | ${platformName}`,
    },
    description: 'Ghana\'s premier digital marketplace. Buy and sell securely with Paystack.',
    openGraph: {
      siteName: platformName,
      locale: 'en_GH',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
    },
    icons: {
      icon: [{ url: faviconUrl, sizes: 'any' }, { url: '/icon.png', type: 'image/png', sizes: '512x512' }],
      apple: '/apple-icon.png',
    },
    other: {
      'platform-timezone': timezone,
      'platform-currency': defaultCurrency,
      'current-date': formatDateForPlatform(now, timezone),
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const platformName = await getPlatformName()
  const timezone = await getPlatformTimezone()
  const defaultCurrency = await getDefaultCurrency()
  const branding = await getBrandingPreferences()

  return (
    <html lang="en">
      <body className="font-sans">
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <OrganizationJsonLd name={platformName} logoUrl={branding.logoUrl} supportPhone={branding.supportPhone} />
        <CartProvider>
          <Navbar platformName={platformName} branding={branding} />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer branding={branding} />
          <CookieConsentBanner />
        </CartProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__PLATFORM_TIMEZONE__=${JSON.stringify(timezone)};window.__PLATFORM_CURRENCY__=${JSON.stringify(defaultCurrency)}`,
          }}
        />
      </body>
    </html>
  )
}