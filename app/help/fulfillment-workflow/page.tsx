import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Fulfillment Workflow - Help Center - Dhream Market',
  description: 'Complete guide for vendors on order fulfillment on Dhream Market. Learn how to process and ship customer orders.',
}

export default function FulfillmentWorkflowGuide() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/assets/images/fulfillment.jpg" alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Vendor Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Fulfillment Workflow</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Process and ship customer orders
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
                  Fulfillment Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Order Notification</h3>
                <p className="text-slate-600 mb-3">
                  Receive email notification when a customer places an order. Order appears in Vendor Dashboard &gt; Orders.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Order Preparation</h3>
                <p className="text-slate-600 mb-3">
                  Prepare the item for shipment. Print packing slip from the order details.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Mark as Shipped</h3>
                <p className="text-slate-600 mb-3">
                  Add tracking number and mark order as shipped. Choose your preferred shipping carrier.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Delivery Confirmation</h3>
                <p className="text-slate-600">
                  System automatically updates when delivery is confirmed. Customer receives notification.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Shipping Guidelines
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Use tracked shipping methods for all orders</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Ship within 24-48 hours of order receipt</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Provide accurate tracking information promptly</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Package items securely to prevent damage in transit</span></li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Tracking and Updates
                </h2>
                <p className="text-slate-600 mb-4">
                  Customers can track their order status in real-time through their Dashboard. Keep them informed about any delays.
                </p>
                <p className="text-slate-600">
                  Use the Fulfillment Analytics to monitor your shipping performance and customer satisfaction.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">FAQ</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if I can't ship on time?</h3>
                <p className="text-slate-600">Notify the customer immediately and update the expected shipping date in the order.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I generate shipping labels?</h3>
                <p className="text-slate-600">Current shipping partners include Ghana Post, VIP Express, and other local carriers.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What happens after I mark shipped?</h3>
                <p className="text-slate-600">Customer receives shipping confirmation with tracking info. Payment is released after delivery.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/managing-products" className="text-royal-blue hover:underline">Managing Products</a>
              <a href="/help/restock-orders" className="text-royal-blue hover:underline">Restock Orders</a>
              <a href="/help/purchase-orders" className="text-royal-blue hover:underline">Purchase Orders</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               Contact our vendor support team for fulfillment assistance.
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