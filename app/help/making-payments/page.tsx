import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Making Payments - Help Center - Dhream Market',
  description: 'Complete guide to payment methods on Dhream Market. Learn about Mobile Money, Card Payments, and Bank Transfers powered by Paystack.',
}

export default function MakingPaymentsGuide() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/assets/images/payments.jpg" alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Making Payments</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Secure payment guide for Dhream Market
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
                  Payment Methods Available
                </h2>
                <p className="text-slate-600 mb-4">
                  Dhream Market uses Paystack for secure payment processing. All payments are processed securely with industry-standard encryption.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Mobile Money</h3>
                <p className="text-slate-600 mb-4">
                  Pay directly from your MTN, Vodafone, or AirtelTigo mobile money wallet. Funds are deducted instantly.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Credit/Debit Cards</h3>
                <p className="text-slate-600 mb-4">
                  Visa, Mastercard, American Express, and other major cards accepted. Your card details are securely processed by Paystack.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Bank Transfer</h3>
                <p className="text-slate-600 mb-4">
                  Choose direct bank transfer for manual payment. Follow the provided instructions to complete your transfer.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  How to Pay
                </h2>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Select your preferred payment method at checkout</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Enter required payment details</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Confirm payment amount and authorize transaction</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Receive payment confirmation and order summary</span></li>
                </ol>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Payment Security
                </h2>
                <p className="text-slate-600 mb-4">
                  All payments are processed through Paystack with PCI-DSS compliance and 256-bit SSL encryption.
                </p>
                <p className="text-slate-600">
                  Your payment information is never stored on our servers. We do not have access to your card details.
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">Why did my payment fail?</h3>
                <p className="text-slate-600">Check your internet connection, ensure sufficient funds, and verify your card details are correct.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">How long does payment verification take?</h3>
                <p className="text-slate-600">Mobile Money and Card payments are instant. Bank transfers may take 1-2 hours to verify.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I pay in installments?</h3>
                <p className="text-slate-600">Currently, we only support full payments at checkout. No installment options are available.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/placing-orders" className="text-royal-blue hover:underline">Placing Orders</a>
              <a href="/help/refunds" className="text-royal-blue hover:underline">Refunds</a>
              <a href="/help/returns" className="text-royal-blue hover:underline">Returns</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               For payment-related issues, our support team is here to help.
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