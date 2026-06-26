import Image from 'next/image'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Creating a Store - Help Center - Dhream Market',
  description: 'Guide for vendors on setting up their store on Dhream Market. Learn how to create and configure your vendor store.',
}

export default function CreatingStoreGuide() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
<div className="absolute inset-0">
          <Image src="/assets/images/vendor-store.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Vendor Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Creating a Store</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Set up your vendor store on Dhream Market
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
                  Getting Started
                </h2>
                <p className="text-slate-600 mb-4">
                  To create a store, you must first register as a vendor on Dhream Market. During registration, select &quot;Vendor&quot; as your role.
                </p>
                <p className="text-slate-600">
                  Navigate to your Vendor Dashboard and click &quot;Store Setup&quot; to begin the process.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Store Setup Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Store Information</h3>
                <p className="text-slate-600 mb-3">
                  Enter your store name, description, and contact information in the Store Setup section.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Business Details</h3>
                <p className="text-slate-600 mb-3">
                  Provide your business address, operating hours, and social media links.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Store Branding</h3>
                <p className="text-slate-600 mb-3">
                  Upload your store logo and banner image to personalize your storefront.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Verification Submission</h3>
                <p className="text-slate-600">
                  Submit your store for verification. Our team will review within 1-2 business days.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Store Requirements
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Valid business registration or vendor permit</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Clear product images and descriptions</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Responsive customer service</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Accurate pricing and stock information</span></li>
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">How long does store verification take?</h3>
                <p className="text-slate-600">Verification typically takes 1-2 business days. You&apos;ll receive email updates on your status.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What documents are required?</h3>
                <p className="text-slate-600">A valid government-issued ID and proof of business registration are required.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I edit my store after submission?</h3>
                <p className="text-slate-600">Yes, you can make edits before verification is complete. After approval, some fields are locked.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/vendor-verification" className="text-royal-blue hover:underline">Vendor Verification</a>
              <a href="/help/kyc-submission" className="text-royal-blue hover:underline">KYC Submission</a>
              <a href="/help/managing-products" className="text-royal-blue hover:underline">Managing Products</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               Contact our vendor support team for assistance with store setup.
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



