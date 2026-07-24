import Link from 'next/link'
import Image from 'next/image'
import { FiInstagram } from 'react-icons/fi'
import { SiTiktok } from 'react-icons/si'
import { FaXTwitter } from 'react-icons/fa6'

export function Footer({ branding }: { branding?: { logoUrl?: string; companyAddress?: string; supportEmail?: string; supportPhone?: string; tagline?: string } }) {
  const platformName = 'Dhream Market'
  const displayName = platformName
  const tagline = branding?.tagline || 'Smart Commerce'
  const supportEmail = branding?.supportEmail || 'support@dhreamarket.com'
  const address = branding?.companyAddress || 'Ghana'
  const phone = branding?.supportPhone || '+233 59 652 2239'

  return (
    <footer className="relative bg-deep-navy text-white overflow-hidden">
      {/* Decorative gradient blob */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-royal-blue/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12 lg:mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4 group">
              <div className="relative w-10 h-10">
                <Image
                  src={branding?.logoUrl || '/assets/images/dhreammarket.png'}
                  alt={displayName ? `${displayName} Logo` : 'Platform Logo'}
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <span className="text-xl font-bold text-white">{displayName}</span>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  {tagline}
                </p>
              </div>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md mb-6">
              Powering Digital Trade - The Smart Commerce Ecosystem connecting businesses and people worldwide with trust, efficiency, and innovation.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">Verified Secure Platform</span>
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
              <span className="text-xs text-slate-500">24/7 Support</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wider uppercase">Platform</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/marketplace" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Categories
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wider uppercase">Support</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/help" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Support Tickets
                </Link>
              </li>
            </ul>
          </div>

{/* Legal */}
           <div>
             <h4 className="text-sm font-semibold text-white mb-4 tracking-wider uppercase">Legal</h4>
             <ul className="space-y-3">
               <li>
                 <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                   <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                   Privacy Policy
                 </Link>
               </li>
               <li>
                  <Link href="/terms" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/refund" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link href="/payment-policy" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Payment Policy
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Cookies
                  </Link>
                </li>
             </ul>
           </div>

          {/* Contact */}
           <div>
              <h4 className="text-sm font-semibold text-white mb-4 tracking-wider uppercase">Contact</h4>
              <ul className="space-y-3">
                {branding?.supportEmail && (
                  <li>
                    <a href={`mailto:${supportEmail}`} className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                      <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                      {supportEmail}
                    </a>
                  </li>
                )}
                {branding?.supportPhone && (
                  <li>
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
                      <span className="w-1 h-1 bg-royal-blue rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                      {phone}
                    </a>
                  </li>
                )}
                {branding?.companyAddress && (
                  <li>
                    <span className="text-slate-400 text-sm flex items-start gap-2">
                      <span className="w-1 h-1 bg-royal-blue rounded-full mt-2 flex-shrink-0"></span>
                      {address}
                    </span>
                  </li>
                )}
              </ul>
            </div>
         </div>

        {/* Trust badges */}
         <div className="relative border-t border-slate-700/50 pt-8 mb-8">
           <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-12 text-slate-400 text-sm">
             <div className="flex items-center gap-2">
               <svg className="w-5 h-5 text-premium-gold" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
               </svg>
               <span>Trusted by 10K+ Businesses</span>
             </div>
             <div className="flex items-center gap-2">
               <svg className="w-5 h-5 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
               </svg>
               <span>Secure Payments</span>
             </div>
             <div className="flex items-center gap-2">
               <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
               </svg>
               <span>Fast Delivery</span>
             </div>
             <div className="flex items-center gap-2">
               <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/>
               </svg>
               <span>24/7 Support</span>
             </div>
           </div>
         </div>

         {/* Social Media Links */}
         <div className="relative flex flex-col sm:flex-row items-center justify-center gap-6 pt-6 border-t border-slate-700/50 mb-8">
           <span className="text-slate-400 text-sm font-medium">Follow Us:</span>
           <div className="flex items-center gap-4">
             <a
               href="https://www.instagram.com/dhreamarket"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Follow us on Instagram"
               className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-pink-500 hover:scale-110 transition-all duration-300"
             >
               <FiInstagram className="w-5 h-5" />
             </a>
             <a
               href="https://www.tiktok.com/@dhreamarket"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Follow us on TikTok"
               className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-black hover:scale-110 transition-all duration-300"
             >
               <SiTiktok className="w-5 h-5" />
             </a>
             <a
               href="https://www.x.com/dhreamarket"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Follow us on X"
               className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-slate-100 hover:text-black hover:scale-110 transition-all duration-300"
             >
               <FaXTwitter className="w-5 h-5" />
             </a>
           </div>
         </div>

         {/* Bottom section */}
         <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-700/50">
           <p className="text-slate-500 text-sm">
             © {new Date().getFullYear()} {displayName}. All rights reserved.
           </p>
           <div className="flex items-center gap-6">
             <span className="text-slate-500 text-sm">Ghana-First Marketplace</span>
             <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
             <span className="text-slate-500 text-sm">Powered by Innovation</span>
           </div>
         </div>
      </div>
    </footer>
  )
}