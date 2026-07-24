import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata = {
  title: 'Returns - Help Center - Dhream Market',
  description: 'Understanding the return process on Dhream Market. Learn how to initiate returns, eligibility criteria, and refund timelines.',
}

export default async function ReturnsGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/returns.jpg" alt="" fill priority className="object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Returns</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Complete guide to the return process
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
                  Return Policy Overview
                </h2>
                <p className="text-slate-600 mb-4">
                  Returns must be initiated within 7 days of receiving your order. Items must be in original condition with packaging intact.
                </p>
                <p className="text-slate-600">
                  Contact the vendor directly through your order page to start the return process.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Return Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Initiate Return</h3>
                <p className="text-slate-600 mb-3">
                  Contact the vendor through your order page with reason and photos if applicable.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Get Approval</h3>
                <p className="text-slate-600 mb-3">
                  Vendor reviews your request and provides return instructions within 3 business days.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Ship Item Back</h3>
                <p className="text-slate-600 mb-3">
                  Package item securely and ship using tracked method. Keep your receipt.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Receive Refund</h3>
                <p className="text-slate-600">
                  After vendor receives and inspects item, refund is processed in 5-7 business days.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Eligible for Return
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Product doesn&apos;t match description or images</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Product arrived damaged or defective</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Wrong item received</span></li>
                </ul>
              </section>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">FAQ</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">How long do returns take?</h3>
                <p className="text-slate-600">Return review takes 3 business days. After approval, refund processing takes 5-7 business days.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Who pays return shipping?</h3>
                <p className="text-slate-600">Vendor covers shipping for defective/damaged items. Customer covers shipping for change of mind.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if vendor doesn&apos;t respond?</h3>
                <p className="text-slate-600">Contact our support team to open a dispute if the vendor doesn&apos;t respond within 3 business days.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/refunds" className="text-royal-blue hover:underline">Refunds</a>
              <a href="/help/tracking-orders" className="text-royal-blue hover:underline">Tracking Orders</a>
              <a href="/help/placing-orders" className="text-royal-blue hover:underline">Placing Orders</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               If you need assistance with a return, our support team is here to help.
             </p>
             <div className="flex flex-col sm:flex-row gap-4">
               <a href="/help" className="text-royal-blue hover:underline">Visit Help Center</a>
               <a href="/contact" className="text-royal-blue hover:underline">Contact Support</a>
               <div className="flex flex-col sm:flex-row gap-2"><a href={`tel:${supportPhone.replace(/\s/g, ``)}`} className="text-royal-blue hover:underline">{supportPhone}</a></div>
             </div>
           </CardContent>
         </Card>
      </div>
    </div>
  )
}



