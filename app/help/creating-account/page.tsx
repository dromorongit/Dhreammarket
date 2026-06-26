import Image from 'next/image'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'Creating an Account - Help Center - Dhream Market',
  description: 'Step-by-step guide on how to create an account on Dhream Market. Learn about registration, email verification, and account setup.',
}

export default function CreatingAccountGuide() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/register.jpg" alt="" className="w-full h-full object-cover opacity-30" fill priority />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Customer Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Creating an Account</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Complete guide to registering on Dhream Market
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
                  Account Creation Process
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Navigate to Registration</h3>
                <p className="text-slate-600 mb-3">
                  Click the &quot;Sign Up&quot; button in the top right corner of the homepage or visit /register directly.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Enter Email and Password</h3>
                <p className="text-slate-600 mb-3">
                  Enter your email address and create a secure password. Your password must be at least 8 characters.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Select Account Type</h3>
                <p className="text-slate-600 mb-3">
                  Choose &quot;Customer&quot; if you want to shop on our marketplace. Vendors should select &quot;Vendor&quot; for selling.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Verify Email</h3>
                <p className="text-slate-600">
                  Check your inbox for a verification email and click the link to confirm your account.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Setting Up Your Profile
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Add Personal Information</h3>
                <p className="text-slate-600 mb-3">
                  After verification, complete your profile with your name, phone number, and shipping address.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Shipping Address</h3>
                <p className="text-slate-600 mb-3">
                  Add your default shipping address for faster checkout. You can add multiple addresses later.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Phone Number</h3>
                <p className="text-slate-600">
                  Add a valid phone number for delivery updates and order notifications.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Account Security
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Use a strong password with letters, numbers, and symbols</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Never share your password with anyone</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Log out from shared devices after use</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Contact support if you suspect unauthorized access</span></li>
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
                <h3 className="text-lg font-medium text-deep-navy mb-2">Why haven&apos;t I received the verification email?</h3>
                <p className="text-slate-600">Check your spam folder. If still not found, try registering again or contact support.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I change my account type later?</h3>
                <p className="text-slate-600">No, account type cannot be changed after registration. Contact support for assistance.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What if I forgot my password?</h3>
                <p className="text-slate-600">Use the &quot;Forgot Password&quot; link on the login page to reset your password via email.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/placing-orders" className="text-royal-blue hover:underline">Placing Orders</a>
              <a href="/help/making-payments" className="text-royal-blue hover:underline">Making Payments</a>
              <a href="/help/tracking-orders" className="text-royal-blue hover:underline">Tracking Orders</a>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
            <p className="text-slate-600 mb-4">
              If you&apos;re experiencing issues with account creation, our support team is here to help.
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