'use client'

export function FiltersBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 pointer-events-none select-none"
    >
      {/* Mobile: Top-left smaller crescent (~90x90) and pale band (~180x110) */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 z-0 pointer-events-none w-[90px] h-[90px] md:w-[150px] md:h-[150px]"
        width="90"
        height="90"
        viewBox="0 0 150 150"
        preserveAspectRatio="xMinYMin meet"
      >
        <defs>
          <linearGradient id="crescentGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path fill="url(#crescentGrad)" fillOpacity={0.9} d="M 0 0 H 150 C 90 20 40 70 0 150 Z" />
      </svg>

      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 z-0 pointer-events-none w-[180px] h-[110px] md:w-[340px] md:h-[200px]"
        width="180"
        height="110"
        viewBox="0 0 340 200"
        preserveAspectRatio="xMinYMin meet"
      >
        <defs>
          <linearGradient id="bandTopGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1D4ED8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="url(#bandTopGrad)" d="M 0 0 H 340 C 220 20 100 80 0 200 Z" />
      </svg>

      {/* Mobile: Bottom-right smaller crescent (~110x100) and pale band (~220x130) */}
      <svg
        aria-hidden="true"
        className="absolute bottom-0 right-0 z-0 pointer-events-none w-[110px] h-[100px] md:w-[200px] md:h-[170px]"
        width="110"
        height="100"
        viewBox="0 0 200 170"
        preserveAspectRatio="xMaxYMax meet"
      >
        <defs>
          <linearGradient id="crescentGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path fill="url(#crescentGrad)" fillOpacity={0.9} d="M 200 170 H 50 C 110 150 160 100 200 20 Z" />
      </svg>

      <svg
        aria-hidden="true"
        className="absolute bottom-0 right-0 z-0 pointer-events-none w-[220px] h-[130px] md:w-[400px] md:h-[220px]"
        width="220"
        height="130"
        viewBox="0 0 400 220"
        preserveAspectRatio="xMaxYMax meet"
      >
        <defs>
          <linearGradient id="bandBottomGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1D4ED8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="url(#bandBottomGrad)" d="M 400 220 H 60 C 180 200 300 140 400 20 Z" />
      </svg>

      {/* Dot grids: only on desktop (md+) */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 z-0 pointer-events-none w-[140px] h-[100px] hidden md:block"
        style={{
          backgroundImage: "radial-gradient(#93c5fd 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0",
          opacity: 0.5,
        }}
      />

      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 z-0 pointer-events-none w-[120px] h-[80px] hidden md:block"
        style={{
          backgroundImage: "radial-gradient(#93c5fd 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          backgroundPosition: "0 0",
          opacity: 0.5,
        }}
      />
    </div>
  )
}
