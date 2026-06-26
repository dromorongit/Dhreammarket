import Image from 'next/image'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Refunds - Help Center - Dhream Market',
  description: 'Complete guide to refunds on Dhream Market. Learn how to request refunds and the processing timeline.',
}

export default function RefundsGuide() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
<div className="absolute inset-0">
          <Image src="/assets/images/refund.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Refunds</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Complete guide to refunds and returns
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
                  How to Request a Refund
                </h2>
<h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Contact Vendor</h3>
                <p className="text-slate-600 mb-3">
                  Contact the vendor directly through your order to initiate a refund request.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1 (Alternative): Cancel Before Shipping</h3>
<p className="text-slate-600 mb-3">
                   If your order hasn&apos;t been shipped yet, you can cancel it directly from your order details page.
                   For paid orders, you can also request a refund during cancellation.
                 </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Provide Details</h3>
                <p className="text-slate-600 mb-3">
                  Explain the issue and provide photos if applicable. Include your order number.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Receive Instructions</h3>
                <p className="text-slate-600 mb-3">
                  If eligible, the vendor will provide return instructions and ship back label if needed.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Process Refund</h3>
                <p className="text-slate-600">
                  After return is received and inspected, refund is processed to your original payment method.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Refund Timeline
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Request Review:</strong> 1-3 business days</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Return Processing:</strong> 5-7 business days after receipt</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Bank Processing:</strong> 5-10 business days for refund to appear</span></li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Refund Methods
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Mobile Money:</strong> Refunded to the original mobile money number</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Card Payments:</strong> Refunded to the original card</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Bank Transfer:</strong> Refunded to the original bank account</span></li>
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">How long does a refund take?</h3>
                <p className="text-slate-600">Refunds are processed within 5-7 business days after the vendor receives returned items.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Will I get a full refund?</h3>
                <p className="text-slate-600">Full refunds for defective items. Shipping costs may apply for other returns.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if vendor doesn&apos;t respond?</h3>
                <p className="text-slate-600">Contact support through the Help Center to open a dispute if unresolved.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/returns" className="text-royal-blue hover:underline">Returns</a>
              <a href="/help/placing-orders" className="text-royal-blue hover:underline">Placing Orders</a>
              <a href="/help/making-payments" className="text-royal-blue hover:underline">Making Payments</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               If you need assistance with a refund, our support team is here to help.
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
