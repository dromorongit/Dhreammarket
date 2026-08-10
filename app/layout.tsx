import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import TopContactBar from '@/components/TopContactBar'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/lib/CartContext'
import QueryProvider from '@/components/QueryProvider'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import LiveSupportWidget from '@/components/LiveSupportWidget'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'Dhream Market - Powering Digital Trade',
    template: '%s | Dhream Market',
  },
  description: 'Ghana\'s premier digital marketplace. Buy and sell securely with Paystack.',
  openGraph: {
    siteName: 'Dhream Market',
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
}

export default function RootLayout({
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
        <OrganizationJsonLd />
        <CartProvider>
          <QueryProvider>
            <TopContactBar />
            <Navbar />
            <main className="min-h-screen">
              {children}
            </main>
            <Footer />
            <CookieConsentBanner />
            <LiveSupportWidget />
          </QueryProvider>
        </CartProvider>
      </body>
    </html>
  )
}