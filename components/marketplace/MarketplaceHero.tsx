'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FaArrowRight, FaCrown } from 'react-icons/fa'
import { MdSupportAgent } from 'react-icons/md'
import { PiShieldCheckFill } from 'react-icons/pi'
import { TbTruckDelivery } from 'react-icons/tb'
import { LuLayoutGrid, LuShoppingCart } from 'react-icons/lu'
import { RecentActivityTicker } from '@/components/RecentActivityTicker'
import { HeroVideo } from '@/components/HeroVideo'

const NAVY = '#001A40'
const HERO_GOLD = '#FBA70B'
const BUTTON_BLUE = '#00399C'
const PILL_BG = '#FCE7BA'
const SUBTEXT = '#1B2B4B'
const DIVIDER = '#CBD5E1'
const BG = 'linear-gradient(105deg,#FFFFFF 0%,#FDFDFE 40%,#EAEFFD 100%)'
const OVERLAY = 'linear-gradient(to right, rgba(255,255,255,0.55), transparent)'

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
        color: NAVY,
        whiteSpace: 'nowrap',
      }}
    >
      <FaCrown size={20} color={NAVY} aria-hidden="true" />
      Shop Smart&nbsp;&bull;&nbsp;Live Better
    </div>
  )
}

function HeroHeading() {
  return (
    <h1
      style={{
        fontFamily: '"Source Serif 4", serif',
        fontWeight: 800,
        fontSize: 'clamp(2rem, 5vw, 4.75rem)',
        lineHeight: 1.05,
        letterSpacing: '-0.01em',
        color: NAVY,
        margin: 0,
      }}
    >
      <span className="hero-line" style={{ display: 'block', color: NAVY }}>
        Discover Premium
      </span>
      <span className="hero-line" style={{ display: 'block', color: HERO_GOLD }}>
        Products
      </span>
    </h1>
  )
}

function Subtext() {
  return (
    <p
      style={{
        maxWidth: 640,
        fontSize: 'clamp(1rem, 1.8vw, 1.125rem)',
        lineHeight: 1.5,
        color: SUBTEXT,
        margin: 0,
        marginTop: '1.25rem',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: 400,
      }}
    >
      Browse our curated selection of quality products from trusted vendors across Ghana.
    </p>
  )
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="hero-trust-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div className="hero-trust-icon" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div className="hero-trust-label"
        style={{
          textAlign: 'center',
          color: '#14203C',
          fontSize: 'clamp(0.85rem, 1.4vw, 1rem)',
          lineHeight: 1.3,
          fontWeight: 500,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function TrustRow() {
  const shield = <PiShieldCheckFill size={36} color={BUTTON_BLUE} aria-hidden="true" />
  const truck = <TbTruckDelivery size={36} color={BUTTON_BLUE} aria-hidden="true" />
  const headset = <MdSupportAgent size={36} color={BUTTON_BLUE} aria-hidden="true" />
  return (
    <div className="hero-trust-row" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <TrustItem icon={shield} label="Trusted Vendors" />
      <div className="hero-trust-divider" style={{ width: 1, height: 36, background: DIVIDER }} />
      <TrustItem icon={truck} label="Fast &amp; Reliable Delivery" />
      <div className="hero-trust-divider" style={{ width: 1, height: 36, background: DIVIDER }} />
      <TrustItem icon={headset} label="Dedicated Support" />
    </div>
  )
}

function Buttons() {
  return (
    <div className="hero-buttons" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <Link href="/marketplace#products">
        <a className="hero-btn hero-btn-filled" style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: 'clamp(200px, 30vw, 266px)',
          height: 70,
          borderRadius: 9999,
          background: NAVY,
          color: '#fff',
          fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <LuShoppingCart size={20} color="#fff" aria-hidden="true" />
          Shop Now
          <FaArrowRight size={16} color="#fff" aria-hidden="true" style={{ marginLeft: 2 }} />
        </a>
      </Link>
      <Link href="/marketplace#products">
        <a className="hero-btn hero-btn-outline" style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: 'clamp(200px, 30vw, 266px)',
          height: 70,
          borderRadius: 9999,
          background: 'transparent',
          border: `2px solid ${NAVY}`,
          color: NAVY,
          fontSize: 'clamp(1rem, 1.6vw, 1.4rem)',
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <LuLayoutGrid size={20} color={NAVY} aria-hidden="true" />
          Explore Marketplace
        </a>
      </Link>
    </div>
  )
}

function HeroImage() {
  return (
    <div className="hero-image-wrapper" style={{ position: 'relative', width: '100%', maxWidth: 780, marginLeft: 'auto' }}>
      <Image
        src="/images/marketimage.png"
        alt="Marketplace products"
        priority
        sizes="(min-width: 1024px) 780px, 90vw"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          maskImage: 'linear-gradient(to right, transparent, #000 22%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 22%)',
        }}
      />
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
        zIndex: 2,
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

export default function MarketplaceHero() {
  return (
    <section className="relative overflow-hidden" style={{ background: BG }}>
      <HeroVideo src="/videos/newvideo.mp4" />
      <div
        className="hero-video-overlay"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, background: OVERLAY }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 hero-content" style={{ zIndex: 10, position: 'relative', paddingBottom: 'clamp(2rem, 5vw, 3rem)' }}>
        <div className="hero-grid" style={{ display: 'grid', gap: 'clamp(2rem, 5vw, 3rem)', marginTop: 'clamp(2rem, 5vw, 4rem)' }}>
          <div className="min-w-0 flex flex-col" style={{ position: 'relative', zIndex: 10 }}>
            <Pill />
            <div style={{ marginTop: 24 }}>
              <HeroHeading />
              <Subtext />
            </div>
            <div style={{ marginTop: 32 }}>
              <Buttons />
            </div>
            <div style={{ marginTop: 32 }}>
              <TrustRow />
            </div>
          </div>
          <div className="min-w-0 hero-image-col" style={{ position: 'relative', zIndex: 5 }}>
            <HeroImage />
          </div>
        </div>
      </div>
      <BottomWave />
      <div className="hero-ticker" style={{ width: 'clamp(280px, 80vw, 758px)', margin: '0 auto' }}>
        <RecentActivityTicker variant="hero" label="Trending Now" />
      </div>
      <style jsx>{`
        @media (min-width: 768px) {
          .hero-line {
            white-space: nowrap;
          }
        }
        @media (min-width: 1024px) {
          .hero-grid {
            grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr) !important;
            gap: 3rem !important;
            align-items: center !important;
          }
          .hero-image-col {
            margin-right: -32px !important;
          }
          .hero-ticker {
            position: absolute !important;
            left: 50% !important;
            bottom: 20px !important;
            transform: translateX(-50%) !important;
            width: clamp(280px, 80vw, 758px) !important;
          }
        }
        @media (max-width: 1023px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
            align-items: start !important;
          }
          .hero-image-wrapper {
            max-width: 520px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .hero-image-col {
            margin-right: 0 !important;
          }
          .hero-ticker {
            position: static !important;
            left: auto !important;
            bottom: auto !important;
            transform: none !important;
            width: calc(100% - 32px) !important;
            margin: 16px auto 0 auto !important;
          }
        }
        @media (max-width: 767px) {
          .hero-content {
            padding-bottom: 1.5rem !important;
          }
          .hero-video-overlay {
            background: rgba(255, 255, 255, 0.75) !important;
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
          .hero-trust-divider {
            width: 1px !important;
            height: auto !important;
            min-height: 32px !important;
            margin: 0 4px !important;
          }
          .hero-trust-label {
            font-size: 0.8rem !important;
            line-height: 1.2 !important;
          }
          .hero-wave {
            max-height: 48px !important;
          }
        }
        @media (max-width: 639px) {
          .hero-wave {
            display: none !important;
          }
          .hero-buttons {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .hero-btn {
            width: 100% !important;
            height: 56px !important;
            min-height: 56px !important;
          }
        }
        @media (min-width: 640px) {
          .hero-btn {
            width: auto !important;
            min-height: 0 !important;
            height: auto !important;
          }
        }
        .hero-video-overlay {
          background: ${OVERLAY};
        }
      `}</style>
    </section>
  )
}
