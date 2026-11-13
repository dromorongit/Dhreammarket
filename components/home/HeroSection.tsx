'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FaShoppingCart, FaArrowRight, FaStore, FaHandshake, FaTruck } from 'react-icons/fa'
import { RecentActivityTicker } from '@/components/RecentActivityTicker'

const NAVY = '#001A40'
const HERO_GOLD = '#FBA70B'
const BUTTON_BLUE = '#00399C'
const PILL_BG = '#DCE5FE'
const SUBTEXT = '#33405F'
const TRUST_TEXT = '#14203C'
const LIVE_GREEN = '#00A383'
const WHATSAPP_GREEN = '#30D438'
const DIVIDER = '#CBD5E1'
const BLOB = 'linear-gradient(135deg,#FFB62E,#FFCB5F)'
const BG = 'linear-gradient(105deg,#FFFFFF 0%,#FDFDFE 40%,#EAEFFD 100%)'

function Pill() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 79,
        top: 67,
        width: 241,
        height: 54,
        background: PILL_BG,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 14,
        paddingRight: 12,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: BUTTON_BLUE }}
      >
        <path
          fill="currentColor"
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
      <span
        style={{
          color: BUTTON_BLUE,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        Buy &bull; Sell &bull; Grow
      </span>
    </div>
  )
}

function HeroHeading() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 79,
        top: 150,
        maxWidth: 900,
      }}
    >
      <h1
        style={{
          fontFamily: '"Source Serif 4", serif',
          fontWeight: 800,
          fontSize: 88,
          lineHeight: 1.08,
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

      {/* Hand-drawn gold brush underline under 'Smart' only */}
      <svg
        width="200"
        height="40"
        style={{
          position: 'absolute',
          left: 310,
          top: 300,
          overflow: 'visible',
        }}
        aria-hidden="true"
      >
        <path
          d="M10 35 Q 60 10 140 30"
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
        position: 'absolute',
        left: 79,
        top: 350,
        maxWidth: 640,
        fontSize: 27,
        lineHeight: 1.4,
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
    <div
      style={{
        position: 'absolute',
        left: 79,
        top: 458,
        display: 'flex',
        gap: 17,
      }}
    >
      <Link href="/register">
        <a
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: 266,
            height: 70,
            borderRadius: 9999,
            background: BUTTON_BLUE,
            color: '#fff',
            fontSize: 26,
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            boxShadow: '0 4px 12px rgba(0,57,156,0.35)',
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fff' }}>
            <path d="M3 3h2l.4 2M7 13h10l4-8M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6M8 13H5l1.5-3M19 13l-1.5-3M17 13v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6" />
          </svg>
          Start Selling
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fff', marginLeft: 2 }}>
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
            width: 238,
            height: 70,
            borderRadius: 9999,
            background: '#fff',
            border: `2px solid ${BUTTON_BLUE}`,
            color: NAVY,
            fontSize: 26,
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: NAVY }}>
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ textAlign: 'center', color: TRUST_TEXT, fontSize: 19, lineHeight: 1.3, fontWeight: 500, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
        {label1}
      </div>
      <div style={{ textAlign: 'center', color: TRUST_TEXT, fontSize: 19, lineHeight: 1.3, fontWeight: 500, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
        {label2}
      </div>
    </div>
  )
}

function TrustRow() {
  const shield = (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: BUTTON_BLUE }}>
      <path
        fill="currentColor"
        d="M12 2L3 7v2c0 5.5 5 10 9 14s9-8.5 9-14V7L12 2zM12 7l1 1 1-1v5.5c0 3.5-2.5 5.5-5 5.5s-5-2-5-5.5V8l1-1 1 1V7z"
      />
    </svg>
  )
  const handshake = (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: BUTTON_BLUE }}>
      <path
        fill="currentColor"
        d="M15 17H5a1 1 0 01-.894-1.447l1.789-2H7.2l-1.342 2.684A1 1 0 015 17h-3a1 1 0 01-.894-.553l-2-4A1 1 0 010 11h3.2l1.789-3.578A1 1 0 015.894 7H11l-1.789 2A1 1 0 0111 10h3v5l1 1-1 1zm2-4h-3l-1-1 1-1v-2l-1-1-1 1V9h2.894l-1.789-3.578A1 1 0 0113 5h3a1 1 0 01.894.553l2 4A1 1 0 0117 11h-3.2l-1.789 3.578A1 1 0 0112 15h-1v-2z"
      />
    </svg>
  )
  const truck = (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: BUTTON_BLUE }}>
      <path
        fill="currentColor"
        d="M1 6h3v1h12V6h3v12H1zM3 11h4.5l1.5-4H4zM20 20H4v-2h16zM8 18a1 1 0 110-2 1 1 0 010 2zm9-2a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  )
  return (
    <div
      style={{
        position: 'absolute',
        left: 79,
        top: 573,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <TrustItem icon={shield} label1="Secure" label2="Transactions" />
      <div style={{ width: 1, height: 48, background: DIVIDER, margin: '0 18px' }} />
      <TrustItem icon={handshake} label1="Trusted" label2="Vendors" />
      <div style={{ width: 1, height: 48, background: DIVIDER, margin: '0 18px' }} />
      <TrustItem icon={truck} label1="Fast &amp; Reliable" label2="Delivery" />
    </div>
  )
}

function RightArt() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '43%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Orange blob behind lady */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 145,
          width: 600,
          height: 641,
          background: BLOB,
          borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
          filter: 'blur(40px)',
          opacity: 0.95,
          zIndex: 0,
        }}
      />
      {/* Background art: faint arch + skyline - under blob */}
      <svg
        width="1672"
        height="786"
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="archBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        {/* Black Star Gate / Independence Arch silhouette - faint */}
        <g filter="url(#archBlur)" fill="#9DB4E8" opacity="0.16">
          <path d="M820 840 L820 660 Q860 660 860 590 Q860 520 900 520 L900 840 Z" />
          <path d="M860 590 L860 520 L880 520 L880 590 Z" />
          <circle cx="870" cy="565" r="10" fill="#9DB4E8" />
          <path d="M800 740 L800 840 M920 700 L920 840" stroke="#9DB4E8" strokeWidth="4" opacity="0.12" />
        </g>
        {/* City skyline silhouettes - far right */}
        <g fill="#9DB4E8" opacity="0.12">
          <path d="M1560 850 L1560 620 L1590 620 L1590 560 L1620 560 L1620 640 L1660 640 L1660 720 L1672 720 L1672 850 Z" />
        </g>
        {/* City skyline silhouettes - left of arch */}
        <g fill="#9DB4E8" opacity="0.10">
          <path d="M740 840 L740 700 L760 700 L760 640 L780 640 L780 740 L800 740 L800 840 Z" />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
        }}
      >
        {/* Lady image - fills right column, bleeds off right and bottom */}
        <Image
          src="/images/herolady.png"
          alt="Woman holding shopping bags and phone"
          priority
          sizes="(min-width: 1024px) 620px, 100vw"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'bottom right',
            zIndex: 20,
          }}
          unoptimized
        />
        {/* White floating cards */}
        <div
          style={{
            position: 'absolute',
            left: 1058,
            top: 106,
            width: 80,
            height: 80,
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 10px 30px rgba(15,35,80,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 25,
          }}
        >
          <FaShoppingCart size={44} color="#001A40" />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1525,
            top: 215,
            width: 80,
            height: 80,
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 10px 30px rgba(15,35,80,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 25,
          }}
        >
          <FaStore size={44} color="#001A40" />
        </div>
        {/* Gold sparkles */}
        <div style={{ position: 'absolute', left: 1480, top: 70, zIndex: 25 }}>
          <svg width="80" height="80" aria-hidden="true">
            <path d="M10 60 Q40 10 70 60" fill="none" stroke={HERO_GOLD} strokeWidth={6} strokeLinecap="round" />
          </svg>
        </div>
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
      <path
        d="M0 110 Q180 30 360 130 L360 130 L0 130 Z"
        fill={NAVY}
      />
      <path
        d="M0 94 Q180 14 360 114 L360 130 L0 130 Z"
        fill="none"
        stroke={HERO_GOLD}
        strokeWidth={16}
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function HeroSection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        minHeight: 'calc(100vh - 155px)',
        height: 786,
        background: BG,
      }}
    >
      <div className="absolute inset-0" aria-hidden="true">
        <RightArt />
      </div>
      <div className="absolute inset-0 pl-[79px]">
        <div className="relative max-w-[900px]" style={{ minHeight: '100%' }}>
          <Pill />
          <HeroHeading />
          <Subtext />
          <Buttons />
          <TrustRow />
        </div>
      </div>
      <BottomWave />

      {/* Ticker inside hero, absolutely positioned, centered, bottom 44px */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 44,
          transform: 'translateX(-50%)',
          width: 758,
          zIndex: 40,
        }}
      >
        <RecentActivityTicker variant="hero" />
      </div>
    </section>
  )
}
