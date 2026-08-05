'use client'

import Image from 'next/image'
import Link from 'next/link'

const PHONES = [
  { id: 1, src: '/images/phone1.jpg', alt: 'Phone 1' },
  { id: 2, src: '/images/phone2.jpg', alt: 'Phone 2' },
  { id: 3, src: '/images/phone3.jpg', alt: 'Phone 3' },
  { id: 4, src: '/images/phone4.jpg', alt: 'Phone 4' },
  { id: 5, src: '/images/phone5.jpg', alt: 'Phone 5' },
  { id: 6, src: '/images/phone6.jpg', alt: 'Phone 6' },
]

export default function PhoneRail() {
  return (
    <section className="relative py-5 bg-slate-50 overflow-hidden" aria-label="Phone rail">
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-premium-xl">
        <div className="flex gap-4 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory pb-2 pr-4 md:pr-6 scroll-smooth touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
          {PHONES.map((phone) => (
            <div
              key={phone.id}
              className="snap-start flex-shrink-0 w-[280px] sm:w-[360px] lg:w-[400px] h-[200px] sm:h-[260px] lg:h-[300px] relative overflow-hidden rounded-2xl"
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