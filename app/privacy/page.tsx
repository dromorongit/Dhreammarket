import Image from 'next/image'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Privacy Policy - Dhream Market',
  description: 'Dhream Market Privacy Policy - How we protect and handle your data.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/privacy.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-96 h-96 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Legal Information
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
               How we protect and handle your data. Last Updated: 27th May, 2025
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
                  Introduction
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Welcome to Dhream Market. We are committed to protecting your privacy and ensuring you have a
                  positive experience using our marketplace platform. This Privacy Policy explains how we collect, use,
                  disclose, and safeguard your information when you use our platform.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Information We Collect
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Personal Information</h3>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Name and contact information (email, phone number)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Account credentials (password - stored securely encrypted)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Payment information (processed securely through Paystack)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Shipping and billing addresses</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Order history and preferences</span>
                  </li>
                </ul>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Automatically Collected Information</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Device information and identifiers</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Browser type and operating system</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">IP address and location data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Usage patterns and interactions with our platform</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  How We Use Your Information
                </h2>
                <p className="text-slate-600 mb-4">We use your information to:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Process transactions and fulfill orders</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Provide customer support and respond to inquiries</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Improve our platform and user experience</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Send important updates about your orders and account</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Comply with legal obligations and prevent fraud</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Personalize your shopping experience</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">4</span>
                  Information Sharing
                </h2>
                <p className="text-slate-600 mb-4">We share your information with:</p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><span className="font-medium">Vendors:</span> Necessary order and shipping information to fulfill your orders</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><span className="font-medium">Payment Processors:</span> Paystack handles payment processing securely</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><span className="font-medium">Service Providers:</span> IT, analytics, and email delivery services</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><span className="font-medium">Legal Authorities:</span> When required by law or to protect our rights</span>
                  </li>
                </ul>
                <p className="text-slate-600 font-medium">
                  We do not sell your personal information to third parties.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">5</span>
                  Data Security
                </h2>
                <p className="text-slate-600 mb-4">We implement appropriate technical and organizational measures to protect your data, including:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Encryption of sensitive data in transit and at rest</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Regular security assessments and updates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Access controls and authentication requirements</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Secure payment processing through Paystack</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">6</span>
                  Your Rights
                </h2>
                <p className="text-slate-600 mb-4">You have the right to:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Access and request a copy of your personal data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Correct inaccurate or incomplete data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Request deletion of your personal data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Opt out of marketing communications</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600">Object to processing of your data</span>
                  </li>
                </ul>
                <p className="text-slate-600 mt-4">
                  To exercise these rights, please contact us through our Contact page.
                </p>
              </section>

<section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">7</span>
                  Cookies and Tracking
                </h2>
                <p className="text-slate-600 mb-4">
                  We use cookies and similar tracking technologies to enhance your experience on our platform.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Types of Cookies We Use</h3>
                <ul className="space-y-3 mb-4">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><span className="font-medium">Necessary Cookies:</span> Essential for the website to function properly. These enable core functionalities like page navigation and access to secure areas. Cannot be disabled.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><span className="font-medium">Analytics Cookies:</span> Help us understand how visitors interact with our website by collecting and reporting information anonymously.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-royal-blue mt-2 flex-shrink-0"></span>
                    <span className="text-slate-600"><span className="font-medium">Marketing Cookies:</span> Used to track visitors across websites to deliver personalized advertisements relevant to your interests.</span>
                  </li>
                </ul>
                <p className="text-slate-600">
                  You can control cookies through your browser settings. Disabling cookies may affect some features of our platform. When you first visit our site, you&apos;ll see a cookie consent banner where you can manage your preferences.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">8</span>
                  Data Retention
                </h2>
                <p className="text-slate-600">
                  We retain your personal data only as long as necessary for the purposes outlined in 
                  this policy, or as required by law. Account data is retained while your account 
                  is active, and order information is retained for legal and tax purposes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">9</span>
                  Third-Party Links
                </h2>
                <p className="text-slate-600">
                  Our platform may contain links to third-party websites. We are not responsible for 
                  the privacy practices of these websites. We encourage you to review their privacy 
                  policies before providing any personal information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">10</span>
                  Changes to This Policy
                </h2>
                <p className="text-slate-600">
                  We may update this Privacy Policy from time to time. We will notify you of any 
                  material changes by posting the new policy on this page and updating the &quot;Last 
                  updated&quot; date. Your continued use of the platform after such changes constitutes 
                  acceptance of the new policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold">11</span>
                  Contact Us
                </h2>
                <p className="text-slate-600">
                  If you have questions or concerns about this Privacy Policy or our data practices, 
                  please contact us through our Contact page or email us at support@dhreammarket.com.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
