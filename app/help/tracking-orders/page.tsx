import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata = {
  title: 'Tracking Orders - Help Center - Dhream Market',
  description: 'Complete guide on how to track your orders on Dhream Market. Learn about order status, delivery updates, and shipment tracking.',
}

export default async function TrackingOrdersGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/tracking.jpg" alt="" fill priority className="object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Tracking Orders</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Complete guide to tracking your purchases
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
                  Accessing Your Orders
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Login to Your Account</h3>
                <p className="text-slate-600 mb-3">
                  Navigate to the login page and enter your credentials to access your dashboard.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Go to Orders Section</h3>
                <p className="text-slate-600 mb-3">
                  From your dashboard, click on &quot;Orders&quot; in the navigation menu or visit /dashboard/customer/orders.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: View Order Details</h3>
                <p className="text-slate-600">
                  Click on any order to see its current status, timeline, and tracking information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Order Status Meanings
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Pending:</strong> Order placed, awaiting vendor confirmation</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Processing:</strong> Vendor is preparing your order for shipment</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Shipped:</strong> Order is on the way with tracking available</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Delivered:</strong> Order has been received by the customer</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Completed:</strong> Order finalized after delivery confirmation</span></li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Tracking Information
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Tracking Number</h3>
                <p className="text-slate-600 mb-3">
                  Once shipped, you&apos;ll receive a tracking number. Click it to view real-time carrier updates.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Delivery Updates</h3>
                <p className="text-slate-600 mb-3">
                  Receive email and SMS notifications about your order status changes.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Estimated Delivery Time</h3>
                <p className="text-slate-600">
                  Delivery estimates vary by shipping method and vendor location. Check your order details for the expected date.
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">Why hasn&apos;t my order status updated?</h3>
                <p className="text-slate-600">Vendors typically update status within 24 hours. Contact the vendor if there are significant delays.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I track my order without an account?</h3>
                <p className="text-slate-600">You need to create an account to view order history and tracking information.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if tracking shows delivered but I didn&apos;t receive it?</h3>
                <p className="text-slate-600">Contact the vendor and our support team immediately to investigate the delivery.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/placing-orders" className="text-royal-blue hover:underline">Placing Orders</a>
              <a href="/help/preorders" className="text-royal-blue hover:underline">Understanding Preorders</a>
              <a href="/help/backorders" className="text-royal-blue hover:underline">Understanding Backorders</a>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
            <p className="text-slate-600 mb-4">
              If you have questions about tracking your order, our support team is here to help.
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


