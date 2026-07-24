import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata = {
  title: 'Purchase Orders - Help Center - Dhream Market',
  description: 'Complete guide for vendors on purchase orders on Dhream Market. Learn how to create and manage B2B purchase orders.',
}

export default async function PurchaseOrdersGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/purchase-orders.jpg" alt="" fill priority className="object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Vendor Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Purchase Orders</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Create and manage B2B purchase orders
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
                  What Are Purchase Orders?
                </h2>
                <p className="text-slate-600 mb-4">
                  Purchase orders are formal requests to suppliers for products. Track orders from creation to receipt.
                </p>
                <p className="text-slate-600">
                  Use purchase orders to manage your supply chain and ensure timely inventory replenishment.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Creating Purchase Orders
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Access Purchase Orders</h3>
                <p className="text-slate-600 mb-3">
                  Navigate to Vendor Dashboard &gt; Purchase Orders and click &quot;Create Order&quot;.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Select Supplier</h3>
                <p className="text-slate-600 mb-3">
                  Choose from your saved suppliers or add a new supplier to the system.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Add Products</h3>
                <p className="text-slate-600 mb-3">
                  Add products with quantities and expected prices. Include any special instructions.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Send Order</h3>
                <p className="text-slate-600">
                  Submit the purchase order. Supplier receives notification and can accept or negotiate.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Tracking and Management
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">View order status: Pending, Accepted, Shipped, Delivered</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Add tracking information when supplier ships</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Receive notifications for status updates</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Generate reports for accounting and inventory planning</span></li>
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I edit a purchase order after sending?</h3>
                <p className="text-slate-600">Yes, before the supplier accepts. After acceptance, you may need to cancel and create a new order.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">How do suppliers receive orders?</h3>
                <p className="text-slate-600">Suppliers receive email notifications and can view orders in their supplier portal.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I cancel a purchase order?</h3>
                <p className="text-slate-600">Yes, cancel anytime before delivery. Contact the supplier to confirm cancellation.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/restock-orders" className="text-royal-blue hover:underline">Restock Orders</a>
              <a href="/help/fulfillment-workflow" className="text-royal-blue hover:underline">Fulfillment Workflow</a>
              <a href="/help/managing-products" className="text-royal-blue hover:underline">Managing Products</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               Contact our vendor support team for purchase order assistance.
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



