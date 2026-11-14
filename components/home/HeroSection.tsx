'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FaShoppingCart, FaStore } from 'react-icons/fa'
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        background: PILL_BG,
        borderRadius: 9999,
        paddingLeft: 14,
        paddingRight: 12,
        height: 54,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: BUTTON_BLUE,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: BUTTON_BLUE }}>
        <path
          fill="currentColor"
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
      Buy &bull; Sell &bull; Grow
    </div>
  )
}

function HeroHeading() {
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: 900, marginBottom: 20 }}>
      <h1
        style={{
          fontFamily: '"Source Serif 4", serif',
          fontWeight: 800,
          fontSize: 'clamp(2.5rem, 6vw, 5.5rem)',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          color: NAVY,
          margin: 0,
          display: 'block',
        }}
      >
        Powering Digital Trade
        <br />
        <span style={{ color: NAVY }}>The </span>
        <span style={{ color: HERO_GOLD }}>Smart Way</span>
      </h1>
      <svg
        width="220"
        height="44"
        style={{
          position: 'absolute',
          left: '52%',
          bottom: -14,
          transform: 'translateX(-50%)',
          overflow: 'visible',
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
    </div>
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
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
      <Link href="/register">
        <a
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h2l.4 2M7 13h10l4-8M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6M8 13H5l1.5-3M19 13l-1.5-3M17 13v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6" />
          </svg>
          Start Selling
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </Link>
      <Link href="/marketplace">
        <a
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18V3H3zM3 9h18v3H3V9zM9 21V9h6v12H9z" />
          </svg>
          Shop Now
        </a>
      </Link>
    </div>
  )
}

function TrustItem({ icon, label1, label2 }: { icon: React.ReactNode; label1: string; label2: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ textAlign: 'center', color: TRUST_TEXT, fontSize: 'clamp(0.85rem, 1.4vw, 1rem)', lineHeight: 1.3, fontWeight: 500, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>{label1}</div>
      <div style={{ textAlign: 'center', color: TRUST_TEXT, fontSize: 'clamp(0.85rem, 1.4vw, 1rem)', lineHeight: 1.3, fontWeight: 500, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>{label2}</div>
    </div>
  )
}

function TrustRow() {
  const shield = (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BUTTON_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.78 4.58c0.58 0.7 0.9 1.6 0.9 2.6V12c0 3.39-1.84 5.76-4.68 6.94A9.2 9.2 0 0 1 12 20c-2.43 0-4.64-0.97-6.22-2.6C5.84 17.76 4 15.39 4 12V9.18c0-1 0.32-1.9 0.9-2.6L12 2z" />
    </svg>
  )
  const handshake = (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BUTTON_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5l-3-3-3 3v4M7 9l2 2 4-4m6 6l-2-2-4 4m0 0l2 2 4-4" />
    </svg>
  )
  const truck = (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BUTTON_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 18V13H4v5M4 13V6h2l3-3h10l3 3h2M4 13h16v5H4z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <TrustItem icon={shield} label1="Secure" label2="Transactions" />
      <div style={{ width: 1, height: 44, background: DIVIDER }} />
      <TrustItem icon={handshake} label1="Trusted" label2="Vendors" />
      <div style={{ width: 1, height: 44, background: DIVIDER }} />
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
      className="hero-image-wrapper"
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
        style={{
          position: 'absolute',
          left: '6%',
          top: '8%',
          width: 64,
          height: 64,
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 10px 30px rgba(15,35,80,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <FaShoppingCart size={32} color="#001A40" />
      </div>
      <div
        style={{
          position: 'absolute',
          right: '4%',
          top: '18%',
          width: 64,
          height: 64,
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 10px 30px rgba(15,35,80,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <FaStore size={32} color="#001A40" />
      </div>
    </div>
  )
}

function BottomWave() {
  return (
    <svg
      width="360"
      height="130"
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        zIndex: 30,
        display: 'block',
      }}
      aria-hidden="true"
    >
      <path d="M0 110 Q180 30 360 130 L360 130 L0 130 Z" fill={NAVY} />
      <path d="M0 94 Q180 14 360 114 L360 130 L0 130 Z" fill="none" stroke={HERO_GOLD} strokeWidth={16} strokeLinecap="round" />
    </svg>
  )
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: BG }}>
      <HeroBackground />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" style={{ zIndex: 10 }}>
        <div
          className="hero-grid grid items-start gap-8 py-12 lg:py-16"
          style={{ gridTemplateColumns: '1fr' }}
        >
          <div className="min-w-0 flex flex-col gap-6" style={{ zIndex: 10 }}>
            <Pill />
            <HeroHeading />
            <Subtext />
            <Buttons />
            <TrustRow />
          </div>
          <div className="min-w-0 flex justify-center lg:justify-end" style={{ zIndex: 1 }}>
            <HeroImage />
          </div>
        </div>
      </div>
      <BottomWave />
      <div
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
        @media (min-width: 1024px) {
          .hero-grid {
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr) !important;
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
        }
      `}</style>
    </section>
  )
}
