'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'

const PHONES = [
  { id: 1, src: '/images/phone1.jpg', alt: 'Phone 1' },
  { id: 2, src: '/images/phone2.jpg', alt: 'Phone 2' },
  { id: 3, src: '/images/phone3.jpg', alt: 'Phone 3' },
  { id: 4, src: '/images/phone4.jpg', alt: 'Phone 4' },
  { id: 5, src: '/images/phone5.jpg', alt: 'Phone 5' },
  { id: 6, src: '/images/phone6.jpg', alt: 'Phone 6' },
]

export default function PhoneRail() {
  useEffect(() => {
    const track = document.querySelector('.phone-rail-track') as HTMLElement | null
    if (!track) return

    const pause = () => { track.style.animationPlayState = 'paused' }
    const resume = () => { track.style.animationPlayState = 'running' }

    track.addEventListener('touchstart', pause, { passive: true })
    track.addEventListener('touchend', resume)
    track.addEventListener('touchcancel', resume)
    track.addEventListener('mousedown', pause)
    track.addEventListener('mouseup', resume)
    track.addEventListener('mouseleave', resume)

    let wheelTimeout: ReturnType<typeof setTimeout>
    track.addEventListener('wheel', () => {
      pause()
      clearTimeout(wheelTimeout)
      wheelTimeout = setTimeout(resume, 1000)
    })

    return () => {
      track.removeEventListener('touchstart', pause)
      track.removeEventListener('touchend', resume)
      track.removeEventListener('touchcancel', resume)
      track.removeEventListener('mousedown', pause)
      track.removeEventListener('mouseup', resume)
      track.removeEventListener('mouseleave', resume)
      clearTimeout(wheelTimeout)
    }
  }, [])

  const duplicatedPhones = [...PHONES, ...PHONES]

  return (
    <section className="relative py-5 bg-slate-50 overflow-hidden" aria-label="Phone rail">
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-premium-xl rail-container">
        <div className="rail-track phone-rail-track">
          {duplicatedPhones.map((phone, index) => (
            <div
              key={`${phone.id}-${index}`}
              className="phone-item flex-shrink-0 w-[280px] sm:w-[360px] lg:w-[400px] h-[200px] sm:h-[260px] lg:h-[300px] relative overflow-hidden rounded-2xl"
            >
              <Link href="/marketplace?category=Electronics%20and%20Technology" className="block w-full h-full" aria-label={phone.alt}>
                <Image
                  src={phone.src}
                  alt={phone.alt}
                  className="object-contain w-full h-full"
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 280px, (max-width: 1024px) 360px, 400px"
                />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
