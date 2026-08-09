'use client'

import { FaWhatsapp } from 'react-icons/fa'

export default function WhatsAppFloatButton() {
  return (
    <a
      href="https://wa.me/447869840464/"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-[#25D366]/80 backdrop-blur-md backdrop-saturate-150 border border-white/30 text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:bg-[#25D366]/90 transition-all duration-300 group ring-1 ring-white/20 hover:scale-105"
      aria-label="Chat with us on WhatsApp"
    >
      <FaWhatsapp className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm font-semibold whitespace-nowrap hidden sm:inline">
        Chat with us
      </span>
    </a>
  )
}
