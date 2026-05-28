import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
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
                  src="/assets/images/dhreammarket.png"
                  alt="Dhream Market Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <span className="text-xl font-bold text-white">Dhream Market</span>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Smart Commerce
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
                <Link href="/help-center" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
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
                <Link href="/help-center" className="text-slate-400 hover:text-white transition-colors duration-200 text-sm flex items-center gap-2 group">
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
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.266.058 2.095.526 2.684 1.115.589.589 1.057 1.418 1.115 2.684.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.058 1.266-.526 2.095-1.115 2.684-.589.589-1.418 1.057-2.684 1.115-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.266-.058-2.095-.526-2.684-1.115-.589-.589-1.057-1.418-1.115-2.684C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.058-1.266.526-2.095 1.115-2.684.589-.589 1.418-1.057 2.684-1.115C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.333.014 7.053.072 5.773.13 4.752.377 3.922.726c-.884.37-1.63.87-2.368 1.608C1.12 3.413.62 4.159.25 5.042.014 5.872 0 6.28.072 7.56.058 8.84.07 12c0 3.204-.012 3.584-.07 4.85-.058 1.266.526 2.095 1.115 2.684.589.589 1.418 1.057 2.684 1.115 1.266.058 1.646.07 4.85.07s3.584-.012 4.85-.07c1.266-.058 2.095-.526 2.684-1.115.589-.589 1.057-1.418 1.115-2.684.058-1.266.07-1.646.07-4.85s-.012-3.584-.07-4.85c-.058-1.266-.526-2.095-1.115-2.684-.589-.589-1.418-1.057-2.684-1.115C15.747.175 15.367.163 12.163.163z"/>
                 <path d="M12 5.837a6.163 6.163 0 100 12.326 6.163 6.163 0 100-12.326zm0 10.163a3.999 3.999 0 110-7.998 3.999 3.999 0 110 7.998zm6.406-11.845a1.44 1.44 0 100 2.88 1.44 1.44 0 100-2.88z"/>
               </svg>
             </a>
             <a
               href="https://www.tiktok.com/@dhreamarket"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Follow us on TikTok"
               className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-black hover:scale-110 transition-all duration-300"
             >
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M12.5 2.5c.833 0 1.604.052 2.363.156a2.5 2.5 0 0 0 1.063-.156v3.063a2.5 2.5 0 0 0-1.063.156c-.759.104-1.53.156-2.363.156s-1.604-.052-2.363-.156a2.5 2.5 0 0 0-1.063.156V2.69a2.5 2.5 0 0 0 1.063-.156C10.896 2.552 11.667 2.5 12.5 2.5zm0-2C10.71 0 9.053.21 7.5.606v4.788C9.053 4.21 10.71 4 12.5 4s2.447.21 4 .394V0C14.947 0 13.29 0 12.5 0z"/>
                 <path d="M12.5 7.5c-2.481 0-4.5 2.019-4.5 4.5v6.5a4.5 4.5 0 0 0 9 0v-6.5c0-2.481-2.019-4.5-4.5-4.5zm0-2C15.481 5.5 18 8.019 18 11v6.5a6.5 6.5 0 0 1-13 0v-6.5c0-2.981 2.519-5.5 5.5-5.5h.5z"/>
                 <path d="M12.5 12.5a1 1 0 0 1 1 1V22a1 1 0 0 1-2 0v-8.5a1 1 0 0 1 1-1z"/>
               </svg>
             </a>
             <a
               href="https://www.x.com/dhreamarket"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Follow us on X"
               className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-slate-100 hover:text-black hover:scale-110 transition-all duration-300"
             >
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.512H1.68l7.73-8.84L-1.012 2.25H5.15l4.657 6.231zm-1.161 17.552h1.833L7.084 5.15H5.117z"/>
               </svg>
             </a>
           </div>
         </div>

         {/* Bottom section */}
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-700/50">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Dhream Market. All rights reserved.
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