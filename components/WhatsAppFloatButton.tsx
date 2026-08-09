'use client'

import { FaWhatsapp } from 'react-icons/fa'

export default function WhatsAppFloatButton() {
  return (
    <a
      href="https://wa.me/447869840464/"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
      aria-label="Chat with us on WhatsApp"
    >
      <FaWhatsapp className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm font-semibold whitespace-nowrap hidden sm:inline">
        Chat with us
      </span>
    </a>
  )
}
