import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

export const metadata = {
  title: 'About Us - Dhream Market',
  description: 'Learn about Dhream Market - The Smart Commerce Ecosystem powering digital trade in Ghana.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/images/market2.jpg"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-96 h-96 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-6 mx-auto">
              Our Story
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight leading-tight">
              About Dhream Market
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              The Smart Commerce Ecosystem powering digital trade in Ghana. We are dedicated to 
              connecting vendors and customers through a seamless, secure, and modern e-commerce platform.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        {/* Mission Section */}
        <div className="text-center mb-16 lg:mb-24">
          <Badge variant="default" className="mb-6">
            Our Mission
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-deep-navy mb-6">
            Democratizing Commerce for Ghana
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            We believe in providing a trusted platform where businesses of all sizes can thrive. 
            Our mission is built on four core principles:
          </p>
        </div>

        {/* Mission Values Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 lg:mb-24">
          <Card variant="elevated" className="text-center p-6 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-navy mb-2">Accessibility</h3>
              <p className="text-sm text-slate-600">Making it easy for anyone to buy and sell online</p>
            </CardContent>
          </Card>

          <Card variant="elevated" className="text-center p-6 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-navy mb-2">Trust</h3>
              <p className="text-sm text-slate-600">Building a secure and transparent marketplace</p>
            </CardContent>
          </Card>

          <Card variant="elevated" className="text-center p-6 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-navy mb-2">Growth</h3>
              <p className="text-sm text-slate-600">Helping vendors scale and reach new customers</p>
            </CardContent>
          </Card>

          <Card variant="elevated" className="text-center p-6 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-navy mb-2">Innovation</h3>
              <p className="text-sm text-slate-600">Continuously improving with modern technology</p>
            </CardContent>
          </Card>
        </div>

        {/* What We Offer */}
        <div className="mb-16 lg:mb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <Badge variant="default" className="mb-4">For Vendors</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold text-deep-navy mb-6">
                Empower Your Business
              </h3>
              <div className="space-y-4">
                <FeatureItem
                  icon="store"
                  title="Easy Store Setup"
                  description="Quick and simple store creation with intuitive tools"
                />
                <FeatureItem
                  icon="payment"
                  title="Secure Payments"
                  description="Reliable payment processing via Paystack integration"
                />
                <FeatureItem
                  icon="analytics"
                  title="Sales Insights"
                  description="Detailed analytics and performance tracking"
                />
                <FeatureItem
                  icon="verified"
                  title="Verified Badges"
                  description="Build trust with verified vendor status"
                />
              </div>
            </div>
            
            <div>
              <Badge variant="default" className="mb-4">For Customers</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold text-deep-navy mb-6">
                Shop with Confidence
              </h3>
              <div className="space-y-4">
                <FeatureItem
                  icon="selection"
                  title="Wide Selection"
                  description="Thousands of products from verified vendors"
                />
                <FeatureItem
                  icon="secure"
                  title="Secure Checkout"
                  description="Safe and protected payment process"
                />
                <FeatureItem
                  icon="tracking"
                  title="Order Tracking"
                  description="Real-time updates on your orders"
                />
                <FeatureItem
                  icon="reviews"
                  title="Review System"
                  description="Make informed decisions with customer reviews"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="mb-16 lg:mb-24">
          <div className="text-center mb-12">
            <Badge variant="premium" className="mb-4">
              Why Choose Us
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-navy">
              The Dhream Market Difference
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card variant="outline" className="p-6 hover:border-royal-blue/50 transition-colors">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-deep-navy mb-2">Ghana-First</h3>
                <p className="text-sm text-slate-600">
                  Built specifically for the Ghanaian market with local payment methods and understanding
                </p>
              </CardContent>
            </Card>

            <Card variant="outline" className="p-6 hover:border-royal-blue/50 transition-colors">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-deep-navy mb-2">Secure Payments</h3>
                <p className="text-sm text-slate-600">
                  Powered by Paystack for reliable, safe, and fast transactions
                </p>
              </CardContent>
            </Card>

            <Card variant="outline" className="p-6 hover:border-royal-blue/50 transition-colors">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-deep-navy mb-2">Verified Vendors</h3>
                <p className="text-sm text-slate-600">
                  We vet vendors to ensure quality, reliability, and trustworthiness
                </p>
              </CardContent>
            </Card>

            <Card variant="outline" className="p-6 hover:border-royal-blue/50 transition-colors">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-deep-navy mb-2">Local Support</h3>
                <p className="text-sm text-slate-600">
                  Our support team is available to help you in Ghana with local understanding
                </p>
              </CardContent>
            </Card>

            <Card variant="outline" className="p-6 hover:border-royal-blue/50 transition-colors">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-deep-navy mb-2">GHS Pricing</h3>
                <p className="text-sm text-slate-600">
                  All prices displayed in Ghana Cedis for complete clarity and transparency
                </p>
              </CardContent>
            </Card>

            <Card variant="outline" className="p-6 hover:border-royal-blue/50 transition-colors">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-deep-navy mb-2">Fast Growth</h3>
                <p className="text-sm text-slate-600">
                  Continuously evolving platform with new features and improvements
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Our Story */}
        <div className="mb-16 lg:mb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="default" className="mb-4">Our Story</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-deep-navy mb-6">
                Building Ghana&apos;s Digital Future
              </h2>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                Dhream Market was founded with the vision of creating a trusted online marketplace 
                that serves the unique needs of Ghanaian businesses and consumers. We recognized 
                the need for a platform that understands local commerce while offering the modern 
                technology that online shopping demands.
              </p>
              <p className="text-lg text-slate-600 leading-relaxed">
                Today, we continue to grow and evolve, adding new features and services that make 
                online shopping better for everyone. We are committed to being the go-to platform 
                for digital commerce in Ghana.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden">
                <img
                  src="/assets/images/market1.jpg"
                  alt="Our Story - Dhream Market"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30"></div>
            </div>
          </div>
        </div>

        {/* Get In Touch */}
        <div className="text-center mb-16 lg:mb-24">
          <Badge variant="default" className="mb-4">
            Get In Touch
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-deep-navy mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Whether you&apos;re a vendor looking to sell on our platform, a customer with questions,
            or a potential partner, reach out to us. We&apos;d love to hear from you!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button variant="primary" size="lg">
              Contact Us
            </Button>
            <Button variant="outline" size="lg">
              Join as Vendor
            </Button>
          </div>
        </div>

        {/* Join Us */}
        <div className="bg-gradient-to-br from-royal-blue/5 to-purple-500/5 rounded-2xl p-8 lg:p-12 text-center">
          <Badge variant="premium" className="mb-4">
            Join Our Community
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-deep-navy mb-6">
            Be Part of Dhream Market
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Whether you want to start selling or prefer to shop from trusted vendors, Dhream Market 
            is here to serve you. Join our growing community of vendors and customers and experience 
            the future of digital commerce in Ghana.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg">
              Start Shopping
            </Button>
            <Button variant="outline" size="lg">
              Start Selling
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  const icons = {
    store: (
      <svg className="w-6 h-6 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    payment: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    analytics: (
      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    verified: (
      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    selection: (
      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    secure: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    tracking: (
      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    reviews: (
      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  }

  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">{icons[icon as keyof typeof icons]}</div>
      <div>
        <h4 className="font-semibold text-deep-navy mb-1">{title}</h4>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  )
}
