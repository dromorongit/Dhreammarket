'use client'

import { useEffect, useState } from 'react'
import { FaWhatsapp } from 'react-icons/fa'

const WA_LINK = 'https://wa.me/447869840464/'

export default function WhatsAppFloatButton() {
  const [attention, setAttention] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!media.matches) {
      setAttention(true)
      const timer = setTimeout(() => setAttention(false), 1500)
      return () => clearTimeout(timer)
    }
    return () => media.removeEventListener('change', () => {})
  }, [])

  return (
    <a
      className="wa-float"
      href={WA_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
    >
      {attention && <div className="wa-ring" aria-hidden="true" />}
      <FaWhatsapp className="wa-icon" color="#fff" aria-hidden="true" />
      <span className="wa-label">Chat with us</span>
      <style jsx>{`
        .wa-float {
        position: fixed;
        right: 16px;
          bottom: 16px;
          z-index: 45;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 52px;
          padding: 0 20px 0 16px;
          border-radius: 999px;
          background: linear-gradient(135deg, #25D366, #1EBE5A);
          color: #fff;
          font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          white-space: nowrap;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(37, 211, 102, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }

        .wa-float:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }

        .wa-float:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(37, 211, 102, 0.5);
        }

        .wa-icon {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }

        .wa-label {
          flex-shrink: 0;
        }

        .wa-ring {
          position: absolute;
          inset: 0;
          margin: -6px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          border-radius: 999px;
          opacity: 0;
          animation: wa-attention 1.4s ease-out forwards;
          pointer-events: none;
        }

        @keyframes wa-attention {
          0% {
            transform: scale(0.9);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.35);
            opacity: 0.35;
          }
          100% {
            transform: scale(1.7);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wa-ring {
            animation: none;
            opacity: 0;
          }
        }

        @media (max-width: 767px) {
          .wa-float {
            width: 56px;
            height: 56px;
            padding: 0;
            border-radius: 50%;
            background: #25D366;
            box-shadow: 0 6px 18px rgba(37, 211, 102, 0.35);
            bottom: calc(16px + env(safe-area-inset-bottom));
          }
          .wa-float:hover {
            transform: none;
            box-shadow: 0 6px 18px rgba(37, 211, 102, 0.35);
          }
          .wa-float:focus-visible {
            outline: 2px solid #fff;
            outline-offset: 2px;
          }
          .wa-label {
            display: none;
          }
          .wa-icon {
            width: 28px;
            height: 28px;
          }
          .wa-ring {
            margin: -8px;
          }
        }
      `}</style>
    </a>
  )
}
