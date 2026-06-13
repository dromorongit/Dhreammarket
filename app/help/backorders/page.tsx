import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Backorders - Help Center - Dhream Market',
  description: 'Understanding backorder products on Dhream Market. Learn how backorders work and when to expect your items.',
}

export default function BackordersGuide() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/assets/images/backorder.jpg" alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Understanding Backorders</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Complete guide to backorder products and availability
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
                  What Are Backorders?
                </h2>
                <p className="text-slate-600 mb-4">
                  Backorder items are temporarily out of stock but will be restocked soon. This allows you to reserve items in advance.
                </p>
                <p className="text-slate-600">
                  When you place a backorder, you&apos;ll be charged immediately and the item will ship once inventory is replenished.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Backorder Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Place Backorder</h3>
                <p className="text-slate-600 mb-3">
                  Select a backorder item and complete checkout. Payment is processed immediately.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Confirmation</h3>
                <p className="text-slate-600 mb-3">
                  You receive an order confirmation with expected restock date.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Restock Notification</h3>
                <p className="text-slate-600 mb-3">
                  You&apos;ll receive a notification when the item is back in stock.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Shipment</h3>
                <p className="text-slate-600">
                  Your order ships and you receive tracking information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Key Differences: Preorder vs Backorder
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Preorder:</strong> Item not yet produced, ordered in advance of availability</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Backorder:</strong> Item exists but temporarily out of stock</span></li>
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I cancel a backorder?</h3>
                <p className="text-slate-600">Yes, you can cancel anytime before shipment. Contact the vendor to cancel.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">How long does restocking take?</h3>
                <p className="text-slate-600">Restock times vary by vendor. Expected dates are shown on the product page.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Will I be notified when stock arrives?</h3>
                <p className="text-slate-600">Yes, you&apos;ll receive email notifications about your backorder status.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/preorders" className="text-royal-blue hover:underline">Preorders</a>
              <a href="/help/placing-orders" className="text-royal-blue hover:underline">Placing Orders</a>
              <a href="/help/tracking-orders" className="text-royal-blue hover:underline">Tracking Orders</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               If you have questions about backorders, our support team is here to help.
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


