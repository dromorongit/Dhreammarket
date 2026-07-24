import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/lib/CartContext'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { Suspense } from 'react'

const FALLBACK_PLATFORM = 'Dhream Market'
const FALLBACK_TIMEZONE = 'Africa/Accra'
const FALLBACK_CURRENCY = 'GHS'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      default: `${FALLBACK_PLATFORM} - Powering Digital Trade`,
      template: `%s | ${FALLBACK_PLATFORM}`,
    },
    description: 'Ghana\'s premier digital marketplace. Buy and sell securely with Paystack.',
    openGraph: {
      siteName: FALLBACK_PLATFORM,
      locale: 'en_GH',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
    },
    icons: {
      icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon.png', type: 'image/png', sizes: '512x512' }],
      apple: '/apple-icon.png',
    },
    other: {
      'platform-timezone': FALLBACK_TIMEZONE,
      'platform-currency': FALLBACK_CURRENCY,
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <OrganizationJsonLd name={FALLBACK_PLATFORM} />
        <CartProvider>
          <Navbar platformName={FALLBACK_PLATFORM} branding={{}} />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer branding={{}} />
          <CookieConsentBanner />
        </CartProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__PLATFORM_TIMEZONE__='${FALLBACK_TIMEZONE}';window.__PLATFORM_CURRENCY__='${FALLBACK_CURRENCY}'`,
          }}
        />
      </body>
    </html>
  )
}
