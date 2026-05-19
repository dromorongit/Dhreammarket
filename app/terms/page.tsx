import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Terms and Conditions - Dhream Market',
  description: 'Dhream Market Terms and Conditions - Platform usage terms and conditions.',
}

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Legal Information
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Terms and Conditions
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Platform usage terms and conditions. Last updated: April 2026
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
                  Acceptance of Terms
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  By accessing and using Dhream Market, you accept and agree to be bound by the terms and
                  provisions of this agreement. If you do not agree to these terms, please do not use
                  our platform.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Platform Description
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Dhream Market is an online marketplace platform that connects vendors with customers in Ghana. 
                  We provide the technology and infrastructure for e-commerce transactions but are not 
                  directly involved in the sale of goods between vendors and customers.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  User Accounts
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Registration</h3>
                <p className="text-slate-600 mb-4">
                  To use certain features of our platform, you must create an account. You agree to 
                  provide accurate, current, and complete information during registration and to update 
                  your information as necessary.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Account Responsibilities</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">You are responsible for maintaining the confidentiality of your account credentials</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">You are responsible for all activities that occur under your account</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">You must immediately notify us of any unauthorized use of your account</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">You must be at least 18 years old to create an account</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">4</span>
                  Vendor Terms
                </h2>
                <p className="text-slate-600 mb-4">Vendors on our platform agree to:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Provide accurate product descriptions and images</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Price products fairly and accurately</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Fulfill orders promptly and as described</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Maintain appropriate business licenses and registrations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Respond to customer inquiries within a reasonable timeframe</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Comply with all applicable laws and regulations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Not sell prohibited or restricted items</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">5</span>
                  Customer Terms
                </h2>
                <p className="text-slate-600 mb-4">Customers agree to:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Provide accurate shipping and contact information</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Pay for orders through approved payment methods</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Not engage in fraudulent or abusive behavior</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Respect vendor policies and terms of sale</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Provide honest and accurate reviews</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">6</span>
                  Orders and Payments
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">All orders are subject to acceptance by the vendor</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Prices are displayed in Ghana Cedis (GHS) unless otherwise stated</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Payments are processed securely through Paystack</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Order confirmation does not guarantee fulfillment</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">We reserve the right to cancel orders that violate our policies</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">7</span>
                  Shipping and Delivery
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Shipping costs and delivery times vary by vendor</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Vendors are responsible for shipping products to the address provided</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">We are not responsible for delays caused by shipping carriers</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Risk of loss transfers to the customer upon delivery to the carrier</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">8</span>
                  Returns and Refunds
                </h2>
                <p className="text-slate-600 mb-4">
                  Return and refund policies are determined by individual vendors. Please review the 
                  specific return policy before making a purchase. We provide a dispute resolution 
                  process for issues that cannot be resolved directly between customers and vendors.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">9</span>
                  Prohibited Items and Conduct
                </h2>
                <p className="text-slate-600 mb-4">The following are prohibited on our platform:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Illegal goods and services</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Counterfeit or pirated goods</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Items that violate intellectual property rights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Harmful or dangerous items</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Adult content and services</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Fraudulent activities and scams</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Harassment, hate speech, or abusive behavior</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">10</span>
                  Intellectual Property
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">All content and materials on Dhream Market are protected by intellectual property rights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">You may not copy, modify, or distribute our platform without permission</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Vendors retain ownership of their product images and descriptions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">You grant us license to use content you submit for platform purposes</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">11</span>
                  Limitation of Liability
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Our platform is provided "as is" without warranties of any kind</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">We do not guarantee the accuracy of vendor listings</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">We are not liable for disputes between vendors and customers</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Our liability is limited to the maximum extent permitted by law</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">12</span>
                  Indemnification
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  You agree to indemnify and hold Dhream Market harmless from any claims, damages, losses, 
                  or expenses arising from your use of the platform or violation of these terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">13</span>
                  Termination
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  We reserve the right to suspend or terminate your account at any time for violation 
                  of these terms or for any other reason. Users may also close their accounts at any time.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">14</span>
                  Governing Law
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  These terms are governed by the laws of Ghana. Any disputes will be resolved in the 
                  courts of Ghana.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">15</span>
                  Changes to Terms
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  We may modify these terms at any time. Continued use of the platform after changes 
                  constitutes acceptance of the new terms. We will notify users of material changes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">16</span>
                  Contact Information
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  For questions about these Terms and Conditions, please contact us through our 
                  Contact page or email us at support@dhreamarket.com.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
