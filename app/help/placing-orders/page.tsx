import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'

export const metadata = {
  title: 'Placing Orders - Help Center - Dhream Market',
  description: 'Step-by-step guide on how to place orders on Dhream Market. Learn about browsing products, adding to cart, checkout, and payment.',
}

export default async function PlacingOrdersGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
<div className="absolute inset-0">
          <Image src="/assets/images/orders.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Placing Orders</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Complete guide to ordering products on Dhream Market
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
                  Step-by-Step Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Browse Products</h3>
                <p className="text-slate-600 mb-4">
                  Navigate to the Marketplace and use search or filters to find products. You can filter by category, price range, and vendor location.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: View Product Details</h3>
                <p className="text-slate-600 mb-4">
                  Click on any product to view detailed information, images, pricing, and vendor details before making your selection.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Add to Cart</h3>
                <p className="text-slate-600 mb-4">
                  Select quantity and click &quot;Add to Cart&quot;. You can continue shopping or proceed to checkout immediately.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Review Cart</h3>
                <p className="text-slate-600 mb-4">
                  Click the cart icon to review your items, adjust quantities, or remove products before checkout.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 5: Proceed to Checkout</h3>
                <p className="text-slate-600 mb-4">
                  Click &quot;Checkout&quot; to enter shipping details and select your payment method through Paystack.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 6: Complete Payment</h3>
                <p className="text-slate-600 mb-4">
                  Choose from Mobile Money, Credit/Debit Card, or Bank Transfer. Complete payment to confirm your order.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Payment Methods
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Mobile Money:</strong> Pay directly from your mobile money wallet</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Card Payments:</strong> Visa, Mastercard, and other credit/debit cards</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600"><strong>Bank Transfer:</strong> Direct bank transfer options</span></li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Order Confirmation
                </h2>
                <p className="text-slate-600 mb-4">
                  After payment, you&apos;ll receive an order confirmation via email with your order number and summary.
                </p>
                <p className="text-slate-600">
                  You can track your order status anytime through your Dashboard under Orders.
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I modify my order after placing it?</h3>
                <p className="text-slate-600">Orders can be modified before shipment. Contact the vendor immediately for any changes.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if I don&apos;t receive order confirmation?</h3>
                <p className="text-slate-600">Check your spam folder or your Dashboard Orders section to verify your order was placed.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I place orders without an account?</h3>
                <p className="text-slate-600">You need to create an account to place orders and track your purchases.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/making-payments" className="text-royal-blue hover:underline">Making Payments</a>
              <a href="/help/tracking-orders" className="text-royal-blue hover:underline">Tracking Orders</a>
              <a href="/help/preorders" className="text-royal-blue hover:underline">Understanding Preorders</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               If you&apos;re experiencing issues with placing orders, our support team is here to help.
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





