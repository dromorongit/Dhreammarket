import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import ContactForm from './ContactForm'
import { FiInstagram } from 'react-icons/fi'
import { SiTiktok } from 'react-icons/si'
import { FaXTwitter } from 'react-icons/fa6'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata = {
  title: 'Contact Us - Dhream Market',
  description: 'Get in touch with Dhream Market support team.',
}

export default async function ContactPage() {
  const branding = await getBrandingPreferences()
  const supportEmail = branding.supportEmail || 'support@dhreamarket.com'
  const phone = branding.supportPhone || '+233 59 652 2239'
  const address = branding.companyAddress || 'Ghana'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Get In Touch
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Contact Us
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Have questions or need help? We&apos;re here to assist you. Fill out the form or reach out
              through any of our contact channels.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-16 lg:pb-24">
        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-deep-navy">Email Support</h3>
                  <p className="text-sm text-slate-500">For general inquiries and support</p>
                </div>
              </div>
              <a href={`mailto:${supportEmail}`} className="text-royal-blue hover:text-royal-blue/80 font-medium">
                {supportEmail}
              </a>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.505a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516.516l1.13-2.257a1 1 0 011.21-.502l4.505 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-deep-navy">Phone Support</h3>
                  <p className="text-sm text-slate-500">Available Monday to Friday, 9:00 AM - 6:00 PM (GMT)</p>
                </div>
              </div>
              <div className="space-y-1">
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="block text-royal-blue hover:text-royal-blue/80 font-medium">{phone}</a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <ContactForm supportEmail={supportEmail} />

        {/* Response Times */}
        <Card variant="outline" className="mt-8">
          <CardContent className="p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-deep-navy mb-4">Response Times</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div>
                  <p className="font-medium text-slate-700">General Inquiries</p>
                  <p className="text-sm text-slate-500">24-48 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-slate-700">Order Issues</p>
                  <p className="text-sm text-slate-500">12-24 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-slate-700">Payment Concerns</p>
                  <p className="text-sm text-slate-500">12-24 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.572-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="font-medium text-slate-700">Technical Support</p>
                  <p className="text-sm text-slate-500">24-48 hours</p>
                </div>
              </div>
            </div>
             <p className="mt-4 text-sm text-slate-500 text-center">
                Our support team operates Monday to Friday, 9:00 AM - 6:00 PM (GMT)
             </p>
           </CardContent>
         </Card>

         {/* Social Media Links */}
         <div className="mt-12 text-center">
           <h3 className="text-lg font-semibold text-deep-navy mb-6">Connect With Us</h3>
           <div className="flex items-center justify-center gap-6">
             <a
                href="https://www.instagram.com/dhreamarket"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white hover:scale-110 transition-all duration-300 shadow-lg"
              >
                <FiInstagram className="w-6 h-6" />
             </a>
             <a
                href="https://www.tiktok.com/@dhreamarket"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on TikTok"
                className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white hover:scale-110 transition-all duration-300 shadow-lg"
              >
                <SiTiktok className="w-6 h-6" />
             </a>
             <a
                href="https://www.x.com/dhreamarket"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on X"
                className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-black hover:scale-110 transition-all duration-300 shadow-lg"
              >
                <FaXTwitter className="w-6 h-6" />
             </a>
           </div>
         </div>
       </div>
    </div>
  )
}
