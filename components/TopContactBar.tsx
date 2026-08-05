'use client'

export default function TopContactBar() {
  return (
    <div className="w-full bg-deep-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-9 sm:h-10">
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-premium-gold"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span className="text-xs sm:text-sm font-medium tracking-wide">
              Call to Order Now
            </span>
          </div>

          <a
            href="tel:+233592938746"
            className="flex items-center gap-1.5 sm:gap-2 text-premium-gold hover:text-white transition-colors duration-200 group"
          >
            <svg
              className="w-3.5 h-3.5 text-premium-gold group-hover:text-white transition-colors duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span className="text-xs sm:text-sm font-semibold tracking-wide">
              +233 592 938 746
            </span>
          </a>
        </div>
      </div>
    </div>
  )
}
