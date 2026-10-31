import type { Metadata } from 'next'
import { Poppins, Montserrat, Caveat, Inter } from 'next/font/google'
import Hero from '@/components/waitlist/Hero'
import FeatureCards from '@/components/waitlist/FeatureCards'
import WaitlistForm from '@/components/waitlist/WaitlistForm'
import Faq from '@/components/waitlist/Faq'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' })
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-montserrat' })
const caveat = Caveat({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-caveat' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Dhream Market Mobile App — Join the Waitlist',
  description:
    "The Dhream Market mobile app is coming! Join the waitlist to shop, sell and grow in one smarter, faster app, and be the first to know when it launches.",
  openGraph: {
    title: 'Dhream Market Mobile App — Join the Waitlist',
    description:
      "The Dhream Market mobile app is coming! Join the waitlist to shop, sell and grow in one smarter, faster app, and be the first to know when it launches.",
    type: 'website',
    images: [{ url: '/assets/images/dhreammarket.png', width: 512, height: 512, alt: 'Dhream Market' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dhream Market Mobile App — Join the Waitlist',
    description:
      "The Dhream Market mobile app is coming! Join the waitlist to shop, sell and grow in one smarter, faster app, and be the first to know when it launches.",
    images: ['/assets/images/dhreammarket.png'],
  },
  alternates: { canonical: '/app-waitlist' },
}

export default function AppWaitlistPage() {
  return (
    <div className={`${poppins.variable} ${montserrat.variable} ${caveat.variable} ${inter.variable} font-[family-name:var(--font-poppins)]`}>
      <Hero />
      <FeatureCards />

      {/* Waitlist form section */}
      <section id="waitlist-form" className="py-12 md:py-16 bg-dhream-cream">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
            <h2 className="text-center font-poppins font-bold text-2xl sm:text-3xl text-dhream-navy mb-2">
              Join the Waitlist
            </h2>
            <p className="text-center text-sm text-dhream-muted mb-6">
              Be the first to know when the app is officially released!
            </p>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Sell with us */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-poppins font-bold text-2xl sm:text-3xl text-dhream-navy mb-3">
            Are you a seller?
          </h2>
          <p className="text-dhream-muted mb-6">
            Grow your business with Dhream Market. Join the waitlist as a seller and get early access to selling tools.
          </p>
          <a
            href="#waitlist-form"
            className="inline-flex items-center gap-2 rounded-full bg-dhream-navy text-white px-6 py-3 text-sm font-semibold shadow-lg border-2 border-dhream-orange/60 hover:scale-[1.02] transition-all"
          >
            Join as a Seller
          </a>
        </div>
      </section>

      <Faq />

      {/* Final CTA */}
      <section className="py-12 md:py-16 bg-dhream-navy text-white text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-caveat text-3xl text-dhream-orange mb-4">Your Marketplace Evolved</p>
          <a
            href="#waitlist-form"
            className="inline-flex items-center gap-2 rounded-full bg-dhream-orange text-white px-6 py-3 text-sm font-semibold shadow-lg hover:scale-[1.02] transition-all"
          >
            Join the Waitlist
          </a>
          <p className="mt-6 text-xs text-white/60">www.dhreamarket.com</p>
        </div>
      </section>
    </div>
  )
}
