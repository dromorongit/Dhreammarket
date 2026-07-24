import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata = {
  title: 'Preorders - Help Center - Dhream Market',
  description: 'Understanding preorder products on Dhream Market. Learn how preorders work, payment timelines, and delivery expectations.',
}

export default async function PreordersGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/preorder.jpg" alt="" fill priority className="object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Understanding Preorders</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Complete guide to preorder products and their delivery
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
                  What Are Preorders?
                </h2>
                <p className="text-slate-600 mb-4">
                  Preorder items are products that will be available in the future. They allow vendors to gauge demand and ensure adequate stock.
                </p>
                <p className="text-slate-600">
                  When you place a preorder, you&apos;ll be charged immediately and the item will ship once it arrives at the vendor&apos;s warehouse.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Preorder Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Place Preorder</h3>
                <p className="text-slate-600 mb-3">
                  Select a preorder item and complete checkout. Payment is processed immediately.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Confirmation</h3>
                <p className="text-slate-600 mb-3">
                  You receive an order confirmation with estimated arrival date and preorder terms.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Wait for Arrival</h3>
                <p className="text-slate-600 mb-3">
                  The vendor receives the product and prepares it for shipment.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Shipment</h3>
                <p className="text-slate-600">
                  Once ready, your order ships and you receive tracking information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Important Notes
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Preorder items are clearly labeled on product listings</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Estimated delivery dates are provided before purchase</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">You can cancel preorders before shipment if needed</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Refunds follow standard refund policy if you cancel</span></li>
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I cancel a preorder?</h3>
                <p className="text-slate-600">Yes, you can cancel before shipment. Contact the vendor to initiate cancellation.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">When will I receive my preorder?</h3>
                <p className="text-slate-600">Estimated delivery dates are shown on the product page and in your order confirmation.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if there are delays?</h3>
                <p className="text-slate-600">Vendors will notify you of any significant delays. You can choose to wait or cancel.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/placing-orders" className="text-royal-blue hover:underline">Placing Orders</a>
              <a href="/help/backorders" className="text-royal-blue hover:underline">Backorders</a>
              <a href="/help/tracking-orders" className="text-royal-blue hover:underline">Tracking Orders</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               If you have questions about preorders, our support team is here to help.
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



