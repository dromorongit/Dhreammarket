export default function QuickLinksContactBar() {
  return (
    <div className="w-full bg-deep-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-10 sm:h-12">
          <a
            href="tel:+233592938746"
            className="flex items-center gap-2 text-white hover:text-premium-gold transition-colors duration-200"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
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
            <span className="text-sm sm:text-base font-bold tracking-wide">
              Call to Order 0592938746
            </span>
          </a>
        </div>
      </div>
    </div>
  )
}
