'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FaArrowRight, FaHandshake, FaShoppingBag } from 'react-icons/fa'
import { LuShoppingCart, LuStore } from 'react-icons/lu'
import { PiShieldCheckFill } from 'react-icons/pi'
import { TbTruckDelivery } from 'react-icons/tb'
import { RecentActivityTicker } from '@/components/RecentActivityTicker'

const NAVY = '#001A40'
const HERO_GOLD = '#FBA70B'
const BUTTON_BLUE = '#00399C'
const PILL_BG = '#DCE5FE'
const SUBTEXT = '#33405F'
const TRUST_TEXT = '#14203C'
const DIVIDER = '#CBD5E1'
const BLOB = 'linear-gradient(135deg,#FFB62E,#FFCB5F)'
const BG = 'linear-gradient(105deg,#FFFFFF 0%,#FDFDFE 40%,#EAEFFD 100%)'

function Pill() {
  return (
    <div
      className="hero-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        width: 'fit-content',
        gap: 10,
        background: PILL_BG,
        borderRadius: 9999,
        paddingLeft: 14,
        paddingRight: 12,
        height: 54,
        fontSize: 'clamp(0.95rem, 4vw, 1.375rem)',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: BUTTON_BLUE,
        whiteSpace: 'nowrap',
      }}
    >
      <FaShoppingBag size={20} color={BUTTON_BLUE} aria-hidden="true" />
      Buy &bull; Sell &bull; Grow
    </div>
  )
}

function HeroHeading() {
  return (
    <h1
      style={{
        fontFamily: '"Source Serif 4", serif',
        fontWeight: 800,
        fontSize: 'clamp(1.9rem, 4.6vw, 4.5rem)',
        lineHeight: 1.1,
        letterSpacing: '-0.01em',
        color: NAVY,
        margin: 0,
        display: 'block',
      }}
    >
      <span className="hero-line" style={{ display: 'block', color: NAVY }}>
        Powering Digital Trade
      </span>
      <span className="hero-line" style={{ display: 'block', color: NAVY, position: 'relative' }}>
        The <span style={{ color: HERO_GOLD, position: 'relative', display: 'inline-block' }}>Smart</span> Way
        <svg
          viewBox="0 0 220 44"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left: 0,
            bottom: '-0.2em',
            width: '100%',
            height: '0.3em',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <path
            d="M10 36 Q 70 12 210 38"
            fill="none"
            stroke={HERO_GOLD}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </h1>
  )
}

function Subtext() {
  return (
    <p
      style={{
        maxWidth: 640,
        fontSize: 'clamp(1rem, 1.8vw, 1.7rem)',
        lineHeight: 1.5,
        color: SUBTEXT,
        margin: 0,
        marginTop: '1.25rem',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: 400,
      }}
    >
      Shop amazing products, discover trusted vendors, and grow your business — all in one place.
    </p>
  )
}

function Buttons() {
  return (
    <div className="hero-buttons" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
      <Link href="/register">
        <a
          className="hero-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: 'clamp(200px, 30vw, 266px)',
            height: 70,
            borderRadius: 9999,
            background: BUTTON_BLUE,
            color: '#fff',
            fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            boxShadow: '0 4px 12px rgba(0,57,156,0.35)',
          }}
        >
          <LuShoppingCart size={24} color="#fff" aria-hidden="true" />
          Start Selling
          <FaArrowRight size={18} color="#fff" aria-hidden="true" style={{ marginLeft: 2 }} />
        </a>
      </Link>
      <Link href="/marketplace">
        <a
          className="hero-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: 'clamp(180px, 26vw, 238px)',
            height: 70,
            borderRadius: 9999,
            background: '#fff',
            border: `2px solid ${BUTTON_BLUE}`,
            color: NAVY,
            fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <LuStore size={24} color={BUTTON_BLUE} aria-hidden="true" />
          Shop Now
        </a>
      </Link>
    </div>
  )
}

function TrustItem({ icon, label1, label2 }: { icon: React.ReactNode; label1: string; label2: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div className="hero-trust-icon" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div className="hero-trust-label"
        style={{
          textAlign: 'center',
          color: TRUST_TEXT,
          fontSize: 'clamp(0.85rem, 1.4vw, 1rem)',
          lineHeight: 1.3,
          fontWeight: 500,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {label1}
      </div>
      <div className="hero-trust-label"
        style={{
          textAlign: 'center',
          color: TRUST_TEXT,
          fontSize: 'clamp(0.85rem, 1.4vw, 1rem)',
          lineHeight: 1.3,
          fontWeight: 500,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {label2}
      </div>
    </div>
  )
}

function TrustRow() {
  const shield = <PiShieldCheckFill size={40} color={BUTTON_BLUE} aria-hidden="true" />
  const handshake = <FaHandshake size={40} color={BUTTON_BLUE} aria-hidden="true" />
  const truck = <TbTruckDelivery size={40} color={BUTTON_BLUE} aria-hidden="true" />
  return (
    <div className="hero-trust-row" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <TrustItem icon={shield} label1="Secure" label2="Transactions" />
      <div className="hero-trust-divider" style={{ width: 1, height: 48, background: DIVIDER }} />
      <TrustItem icon={handshake} label1="Trusted" label2="Vendors" />
      <div className="hero-trust-divider" style={{ width: 1, height: 48, background: DIVIDER }} />
      <TrustItem icon={truck} label1="Fast &amp; Reliable" label2="Delivery" />
    </div>
  )
}

function HeroBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ zIndex: 0, overflow: 'hidden' }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1672 786"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <filter id="archBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <g filter="url(#archBlur)" fill="#9DB4E8" opacity="0.16">
          <path d="M820 840 L820 660 Q860 660 860 590 Q860 520 900 520 L900 840 Z" />
          <path d="M860 590 L860 520 L880 520 L880 590 Z" />
          <circle cx="870" cy="565" r="10" fill="#9DB4E8" />
          <path d="M800 740 L800 840 M920 700 L920 840" stroke="#9DB4E8" strokeWidth="4" opacity="0.12" />
        </g>
        <g fill="#9DB4E8" opacity="0.12">
          <path d="M1560 850 L1560 620 L1590 620 L1590 560 L1620 560 L1620 640 L1660 640 L1660 720 L1672 720 L1672 850 Z" />
        </g>
        <g fill="#9DB4E8" opacity="0.10">
          <path d="M740 840 L740 700 L760 700 L760 640 L780 640 L780 740 L800 740 L800 840 Z" />
        </g>
      </svg>
      <div style={{ position: 'absolute', right: 30, top: 20, zIndex: 0 }}>
        <svg width="64" height="64" aria-hidden="true">
          <path d="M8 48 Q32 8 56 48" fill="none" stroke={HERO_GOLD} strokeWidth={5} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function HeroImage() {
  return (
    <div
      className="hero-image-wrapper hero-image"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 640,
        aspectRatio: '1221 / 1288',
        marginLeft: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: '-8%',
          top: '4%',
          width: '92%',
          height: '92%',
          background: BLOB,
          borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
          filter: 'blur(40px)',
          opacity: 0.95,
          zIndex: 0,
        }}
      />
      <Image
        src="/images/herolady.png"
        alt="Woman holding shopping bags and phone"
        priority
        sizes="(min-width: 1024px) 640px, 420px"
        style={{
          position: 'relative',
          width: '100%',
          height: 'auto',
          display: 'block',
          zIndex: 1,
        }}
      />
          <div
            className="hero-cart"
            style={{
              position: 'absolute',
              left: '6%',
              top: '8%',
              width: 80,
              height: 80,
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 10px 30px rgba(15,35,80,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <LuShoppingCart className="hero-cart-icon" size={40} color={NAVY} aria-hidden="true" />
          </div>
          <div
            className="hero-store"
            style={{
              position: 'absolute',
              right: '4%',
              top: '18%',
              width: 80,
              height: 80,
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 10px 30px rgba(15,35,80,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <LuStore className="hero-store-icon" size={40} color={BUTTON_BLUE} aria-hidden="true" />
          </div>
    </div>
  )
}

function BottomWave() {
  return (
    <svg
      className="hero-wave"
      viewBox="0 0 360 110"
      preserveAspectRatio="xMinYMax meet"
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 'clamp(140px, 28vw, 360px)',
        height: 'auto',
        maxHeight: 110,
        zIndex: 0,
        display: 'block',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <path d="M0 0 Q120 60 360 110 L0 110 Z" fill={NAVY} />
      <path d="M0 0 Q120 60 360 110" fill="none" stroke={HERO_GOLD} strokeWidth={6} strokeLinecap="round" />
    </svg>
  )
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: BG }}>
      <HeroBackground />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-28 lg:pb-32" style={{ zIndex: 10 }}>
        <div
          className="hero-grid grid items-start gap-8 pt-12 lg:pt-16"
          style={{ gridTemplateColumns: '1fr' }}
        >
          <div className="min-w-0 flex flex-col" style={{ zIndex: 10 }}>
            <Pill />
            <div style={{ marginTop: 24 }}>
              <HeroHeading />
              <Subtext />
            </div>
            <div style={{ marginTop: 24 }}>
              <Buttons />
            </div>
            <div style={{ marginTop: 24 }}>
              <TrustRow />
            </div>
          </div>
          <div className="min-w-0 flex justify-center lg:justify-end hero-image-col" style={{ zIndex: 1 }}>
            <HeroImage />
          </div>
        </div>
      </div>
      <BottomWave />
      <div
        className="hero-ticker"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 20,
          transform: 'translateX(-50%)',
          width: 'clamp(280px, 80vw, 758px)',
          zIndex: 40,
        }}
      >
        <RecentActivityTicker variant="hero" />
      </div>
      <style jsx>{`
        @media (min-width: 768px) {
          .hero-line {
            white-space: nowrap;
          }
        }
        @media (min-width: 1024px) {
          .hero-grid {
            grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr) !important;
            gap: 3rem;
            align-items: center;
          }
        }
        @media (max-width: 1023px) {
          .hero-image-wrapper {
            max-width: 420px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .hero-ticker {
            position: static !important;
            left: auto !important;
            bottom: auto !important;
            transform: none !important;
            width: calc(100% - 32px) !important;
            margin: 16px auto 0 auto !important;
            z-index: auto !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            text-overflow: ellipsis !important;
          }
        }
        @media (max-width: 767px) {
          .hero-image-wrapper {
            max-width: 340px !important;
          }
          .hero-image-col {
            margin-top: 8px !important;
          }
          .hero-trust-row {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
            align-items: start !important;
          }
          .hero-trust-icon {
            width: 32px !important;
            height: 32px !important;
          }
          .hero-trust-icon svg {
            width: 32px !important;
            height: 32px !important;
          }
          .hero-trust-label {
            font-size: 0.8rem !important;
            line-height: 1.2 !important;
          }
          .hero-trust-divider {
            width: 1px !important;
            height: auto !important;
            min-height: 32px !important;
            margin: 0 4px !important;
          }
          .hero-cart {
            left: 8px !important;
            top: 8px !important;
            width: 56px !important;
            height: 56px !important;
          }
          .hero-cart-icon {
            width: 28px !important;
            height: 28px !important;
          }
          .hero-store {
            right: 8px !important;
            top: 16px !important;
            width: 56px !important;
            height: 56px !important;
          }
          .hero-store-icon {
            width: 28px !important;
            height: 28px !important;
          }
          .hero-wave {
            max-height: 70px !important;
          }
        }
        @media (max-width: 639px) {
          .hero-buttons {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .hero-btn {
            width: 100% !important;
            height: 56px !important;
            min-height: 56px !important;
            font-size: 1rem !important;
            justify-content: center !important;
          }
        }
        @media (min-width: 640px) {
          .hero-btn {
            width: auto !important;
            min-height: 0 !important;
            height: auto !important;
          }
        }
      `}</style>
    </section>
  )
}
