import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'KYC Submission - Help Center - Dhream Market',
  description: 'Complete guide to KYC (Know Your Customer) submission for vendors on Dhream Market. Learn about required documents and verification.',
}

export default async function KYCSubmissionGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
<div className="absolute inset-0">
          <Image src="/assets/images/kyc.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Vendor Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">KYC Submission</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Know Your Customer documentation guide
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
                  What is KYC?
                </h2>
                <p className="text-slate-600 mb-4">
                  KYC (Know Your Customer) is a standard verification process to confirm vendor identity and business legitimacy.
                </p>
                <p className="text-slate-600">
                  This helps build trust with customers and ensures compliance with platform policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Required Documents
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Primary Documents</h3>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Government-issued photo ID (passport, driver&apos;s license, or national ID)</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Proof of address (utility bill or bank statement)</span></li>
                </ul>
                <h3 className="text-xl font-medium text-deep-navy mb-3">For Businesses</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Business registration certificate</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Business license (if applicable)</span></li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Document Requirements
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Documents must be clear and legible</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">No glare or reflections in photos</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">All text must be readable and not cropped</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Documents must be current (within last 3 months)</span></li>
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if my document is rejected?</h3>
                <p className="text-slate-600">You&apos;ll receive specific reasons. Correct the issues and resubmit within 7 days.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">How long does KYC review take?</h3>
                <p className="text-slate-600">KYC review takes 1-2 business days. You&apos;ll receive email notification of status.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Is my information secure?</h3>
                <p className="text-slate-600">Yes, all documents are encrypted and stored securely. We never share with third parties.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/vendor-verification" className="text-royal-blue hover:underline">Vendor Verification</a>
              <a href="/help/creating-store" className="text-royal-blue hover:underline">Creating a Store</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               Contact our vendor support team if you have KYC questions.
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






