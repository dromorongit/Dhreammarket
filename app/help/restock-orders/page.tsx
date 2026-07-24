import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata = {
  title: 'Restock Orders - Help Center - Dhream Market',
  description: 'Complete guide for vendors on restock orders on Dhream Market. Learn how to manage inventory replenishment.',
}

export default async function RestockOrdersGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/restock.jpg" alt="" fill priority className="object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Vendor Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Restock Orders</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Manage inventory replenishment requests
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
                  Understanding Restock Orders
                </h2>
                <p className="text-slate-600 mb-4">
                  Restock orders allow customers to reserve items that are currently out of stock. This helps you plan inventory replenishment.
                </p>
                <p className="text-slate-600">
                  You can view pending backorders in your Vendor Dashboard and create restock orders to fulfill them.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Managing Restock Orders
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">View Pending Requests</h3>
                <p className="text-slate-600 mb-3">
                  Navigate to Vendor Dashboard &gt; Restock Orders to see all pending backorders for your products.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Create Supplier Order</h3>
                <p className="text-slate-600 mb-3">
                  Create restock orders to your suppliers to fulfill the pending requests. Track supplier delivery times.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Automatic Fulfillment</h3>
                <p className="text-slate-600">
                  Once inventory arrives, backorders are automatically queued for fulfillment. Customers receive notifications.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Best Practices
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Monitor backorder counts regularly to anticipate demand</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Notify customers of significant delays proactively</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Use analytics to identify products frequently going out of stock</span></li>
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
                <p className="text-slate-600">Customers can cancel backorders before shipment. Notify them when stock arrives.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">How are backorder payments handled?</h3>
                <p className="text-slate-600">Payments are processed immediately. Funds are held until the order ships.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if I can&apos;t fulfill all backorders?</h3>
                <p className="text-slate-600">Prioritize based on order date. Contact customers to offer alternatives or full refunds.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/preorders" className="text-royal-blue hover:underline">Preorders</a>
              <a href="/help/fulfillment-workflow" className="text-royal-blue hover:underline">Fulfillment Workflow</a>
              <a href="/help/purchase-orders" className="text-royal-blue hover:underline">Purchase Orders</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               Contact our vendor support team for restock order assistance.
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




