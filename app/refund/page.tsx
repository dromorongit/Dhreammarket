import Image from 'next/image'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Refund and Return Policy - Dhream Market',
  description: 'Dhream Market Refund and Return Policy - Understanding our return and refund processes.',
}

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/refund.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-96 h-96 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Customer Support
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Refund and Return Policy
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
               Understanding our return and refund processes. Last Updated: 27th May, 2025
             </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-16 lg:pb-24">
        <Card variant="elevated">
          <CardContent className="p-6 sm:p-8">
            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">1</span>
                  Overview
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  This Refund and Return Policy outlines the guidelines for returning products and 
                  requesting refunds on the Dhream Market marketplace. We aim to provide a fair and 
                  transparent process for all customers while respecting vendor policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Eligibility for Returns
                </h2>
                <p className="text-slate-600 mb-4">Products may be returned under the following circumstances:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Product does not match the description or images on the listing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Product is damaged or defective upon arrival</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Wrong item was received (different product than ordered)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Product is significantly different from what was expected</span>
                  </li>
                </ul>
                <p className="text-slate-600 mt-4">
                  Returns must be initiated within <strong>7 days</strong> of receiving the product. 
                  The product must be in its original condition with all packaging and tags intact.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Non-Returnable Items
                </h2>
                <p className="text-slate-600 mb-4">The following items are not eligible for return:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Personal care and hygiene products that have been opened or used</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Digital products and downloadable content</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Items specifically marked as &quot;final sale&quot; or &quot;non-refundable&quot;</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Products damaged due to misuse or improper care</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Items returned after the 7-day window</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Products without proof of purchase</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">4</span>
                  Return Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Initiate Return</h3>
                <p className="text-slate-600 mb-4">
                  Contact the vendor directly through your order to initiate a return request. 
                  Provide your order number, a description of the issue, and photos if applicable.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Return Approval</h3>
                <p className="text-slate-600 mb-4">
                  The vendor will review your request and approve or reject it within 3 business days. 
                  Approved returns will include instructions for returning the item.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Ship the Item</h3>
                <p className="text-slate-600 mb-4">
                  Ship the item back to the vendor using a tracked shipping method. Keep the 
                  tracking number and shipping receipt for your records.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Refund Processing</h3>
                <p className="text-slate-600 mb-4">
                  Once the vendor receives and inspects the returned item, the refund will be 
                  processed within 5-7 business days. The refund will be credited to your 
                  original payment method.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">5</span>
                  Refund Timeline
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Return Review:</strong> 3 business days after vendor receives the item</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Refund Processing:</strong> 5-7 business days after approval</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Credit to Account:</strong> Depending on your bank, may take 10-14 business days</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">6</span>
                  Refund Methods
                </h2>
                <p className="text-slate-600 mb-4">Refunds will be processed through the original payment method:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Mobile Money:</strong> Refunded to the mobile money number used for payment</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Card Payments:</strong> Refunded to the card used for payment</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Bank Transfer:</strong> Refunded to the bank account used for payment</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">7</span>
                  Shipping Costs
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Defective or Damaged Items:</strong> Vendor covers return shipping costs</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Wrong Item Received:</strong> Vendor covers return shipping costs</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><strong>Change of Mind:</strong> Customer is responsible for return shipping costs</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">8</span>
                  Exchange Policy
                </h2>
                <p className="text-slate-600">
                  We do not currently offer direct exchanges. If you wish to exchange a product, 
                  please return the original item for a refund and place a new order for the 
                  desired product. This ensures you get the exact item you want.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">9</span>
                  Vendor-Specific Policies
                </h2>
                <p className="text-slate-600">
                  Some vendors may have their own return policies that supplement this platform-wide 
                  policy. These vendor-specific policies will be clearly stated on their product 
                  listings. In case of conflict between vendor policies and this platform policy, 
                  the more customer-friendly policy will apply.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">10</span>
                  Dispute Resolution
                </h2>
                <p className="text-slate-600">
                  If you and the vendor cannot reach an agreement on a return or refund, you can 
                  open a dispute through our platform. We will review the case and make a final 
                  decision within 7 business days. Our decision will be binding on both parties.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">11</span>
                  Cancellation
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Orders can be cancelled before they are shipped without penalty</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Once an order is shipped, standard return policies apply</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">To cancel an order, contact the vendor immediately with your order number</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">12</span>
                  Contact Us
                </h2>
                <p className="text-slate-600">
                  If you have questions about returns or refunds, please contact us through our 
                  Contact page or email support@dhreammarket.com. We are here to help resolve
                  any issues fairly and quickly.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
