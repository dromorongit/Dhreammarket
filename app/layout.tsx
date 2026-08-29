import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import TopContactBar from '@/components/TopContactBar'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/lib/CartContext'
import QueryProvider from '@/components/QueryProvider'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { getServerSession } from '@/lib/auth'
import LiveSupportWidget from '@/components/LiveSupportWidget'
import BackToSchoolPromo from '@/components/BackToSchoolPromo'
import { Suspense } from 'react'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  return (
    <html lang="en">
      <body className="font-sans overflow-x-hidden">
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
             <LiveSupportWidget userRole={session?.role ?? null} />
             <BackToSchoolPromo />
           </QueryProvider>
        </CartProvider>
      </body>
    </html>
  )
}