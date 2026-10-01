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
import { SupportChatWidget } from '@/components/support-ai/support-chat-widget'
import { Suspense } from 'react'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: 'Dhream Market — The Trusted Home of Ghanaian Trade Online',
    template: '%s | Dhream Market',
  },
  description: 'Shop from verified Ghanaian vendors and pay securely with Paystack. Dhream Market makes online buying and selling in Ghana safe, simple, and fair.',
  openGraph: {
    siteName: 'Dhream Market',
    locale: 'en_GH',
    type: 'website',
    title: 'Dhream Market — The Trusted Home of Ghanaian Trade Online',
    description: 'Shop from verified Ghanaian vendors and pay securely with Paystack. Dhream Market makes online buying and selling in Ghana safe, simple, and fair.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dhream Market — The Trusted Home of Ghanaian Trade Online',
    description: 'Shop from verified Ghanaian vendors and pay securely with Paystack. Dhream Market makes online buying and selling in Ghana safe, simple, and fair.',
  },
  icons: {
    icon: [{ url: '/assets/images/dhreammarket.png', type: 'image/png', sizes: '512x512' }],
    apple: '/assets/images/dhreammarket.png',
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
               <SupportChatWidget userRole={session?.role ?? null} />

           </QueryProvider>
        </CartProvider>
      </body>
    </html>
  )
}