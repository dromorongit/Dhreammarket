'use client'

import { FaWhatsapp } from 'react-icons/fa'

export default function WhatsAppFloatButton() {
  return (
    <a
      href="https://wa.me/447869840464/"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        bottom: 29,
        right: 29,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 181,
        height: 65,
        borderRadius: 9999,
        background: '#30D438',
        paddingLeft: 16,
        paddingRight: 14,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
      aria-label="Chat with us on WhatsApp"
    >
      <FaWhatsapp size={36} color="#fff" style={{ flexShrink: 0 }} />
      <span
        style={{
          color: '#fff',
          fontSize: 21,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        Chat with us
      </span>
    </a>
  )
}
