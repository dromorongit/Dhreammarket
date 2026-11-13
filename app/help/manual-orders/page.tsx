import Image from 'next/image'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import {
  POLICY_EFFECTIVE_DATE_DISPLAY,
  MANUAL_ORDERS_RULE,
  MANUAL_ORDERS_COMMISSION,
  MANUAL_ORDERS_RETURN_RULE,
} from '@/lib/policy-copy'

export const metadata = {
  title: 'Manual Orders - Help Center - Dhream Market',
  description: 'Guide to manual orders on Dhream Market: what they are, commission, and return rules.',
}

export default function ManualOrdersGuide() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/help.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Vendor Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Manual Orders</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Orders a vendor creates for sales made outside the Dhream Market catalogue.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-16 lg:pb-24">
        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">1</span>
                  What Is a Manual Order?
                </h2>
                <p className="text-slate-600 mb-4">{MANUAL_ORDERS_RULE}</p>
                <p className="text-slate-600">{POLICY_EFFECTIVE_DATE_DISPLAY}</p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Commission and Fees
                </h2>
                <p className="text-slate-600">{MANUAL_ORDERS_COMMISSION}</p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Return Rules
                </h2>
                <p className="text-slate-600">{MANUAL_ORDERS_RETURN_RULE}</p>
              </section>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
            <p className="text-slate-600 mb-4">
              If you have questions about manual orders, our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="/help" className="text-royal-blue hover:underline">Visit Help Center</a>
              <a href="/contact" className="text-royal-blue hover:underline">Contact Support</a>
              <div className="flex flex-col sm:flex-row gap-2">
                <a href="tel:+233596522239" className="text-royal-blue hover:underline">+233 59 652 2239</a>
                <span className="text-slate-400 hidden sm:inline">|</span>
                <a href="tel:+233508548181" className="text-royal-blue hover:underline">+233 50 854 8181</a>
                <span className="text-slate-400 hidden sm:inline">|</span>
                <a href="tel:+233279354362" className="text-royal-blue hover:underline">+233 27 935 4362</a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
