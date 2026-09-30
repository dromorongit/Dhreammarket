import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { FaGooglePlay, FaApple } from 'react-icons/fa'
import AppPhoneMockup from '@/components/AppPhoneMockup'
import WaitlistForm from '@/components/WaitlistForm'
import { SITE_URL } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Get the App - Join the Waitlist',
  description: 'The Dhream Market mobile app is coming to Android and iOS. Join the waitlist to be first to know when it launches.',
  alternates: {
    canonical: `${SITE_URL}/app`,
  },
  openGraph: {
    title: 'Get the Dhream Market App - Join the Waitlist',
    description: 'The Dhream Market mobile app is coming to Android and iOS. Join the waitlist to be first to know when it launches.',
    url: `${SITE_URL}/app`,
  },
}

const BENEFITS = [
  { title: 'The marketplace in your pocket', text: 'Browse products and services from Dhream Market vendors wherever you are.' },
  { title: 'Stay on top of your orders', text: 'Follow your orders and get updates without opening a browser.' },
  { title: 'Made for vendors too', text: 'Vendors on Dhream Market will be able to keep an eye on their store from their phone.' },
]

const FAQ = [
  { q: 'When will the app launch?', a: 'We will let everyone on the waitlist know as soon as it is ready. We do not have a date to share yet.' },
  { q: 'Which phones will it work on?', a: 'We are building it for both Android and iOS.' },
  { q: 'What will you do with my details?', a: 'We only use them to tell you about the app launch. See our Privacy Policy for more.' },
]

export default function AppPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-deep-navy to-purple-900">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-premium-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-royal-blue/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight leading-tight">
                The Dhream Market app is coming
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Shop trusted Ghanaian vendors right from your phone. Join the waitlist to be first to know when it launches on Android and iOS.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a
                  href="#waitlist"
                  className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-lg font-medium text-deep-navy hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-royal-blue focus:ring-offset-2"
                >
                  Join the waitlist
                </a>
              </div>
            </div>

            <div className="flex justify-center">
              <AppPhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Coming soon badges */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <span
              aria-disabled="true"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 select-none"
            >
              <FaGooglePlay className="h-5 w-5" />
              Coming soon on Google Play
            </span>
            <span
              aria-disabled="true"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 select-none"
            >
              <FaApple className="h-5 w-5" />
              Coming soon on the App Store
            </span>
          </div>
          <p className="sr-only">Store badges will become real links when the app launches.</p>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-slate-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {BENEFITS.map((item) => (
              <Card key={item.title} padding="lg">
                <CardHeader>
                  <h3 className="text-lg font-semibold text-deep-navy">{item.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 leading-relaxed">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist form */}
      <section id="waitlist" className="scroll-mt-24 bg-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-navy mb-4">Join the waitlist</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Be the first to know when the Dhream Market app launches on Android and iOS.
            </p>
          </div>
          <WaitlistForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-deep-navy mb-8 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="flex items-center justify-between cursor-pointer text-base font-semibold text-deep-navy list-none">
                  {item.q}
                  <span className="ml-4 text-slate-400 transition-transform group-open:rotate-180">&#8964;</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="bg-white py-16 lg:py-24 pb-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-lg text-slate-700">
            Can&apos;t wait? You can already shop on Dhream Market in your phone browser.{' '}
            <Link href="/marketplace" className="text-royal-blue hover:underline font-medium">
              Visit the marketplace
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
