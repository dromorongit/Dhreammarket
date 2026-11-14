'use client'

export function FiltersBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 pointer-events-none select-none hidden md:block"
    >
      <svg
        className="absolute top-0 left-0 w-[110px] h-[90px]"
        width="110"
        height="90"
        viewBox="0 0 110 90"
        preserveAspectRatio="xMinYMin meet"
      >
        <defs>
          <linearGradient id="waveTopGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path fill="url(#waveTopGrad)" fillOpacity={0.9} d="M 45 0 Q 12 0 12 20 L 0 20 Q 0 0 45 0 Z" />
      </svg>

      <svg
        className="absolute bottom-0 right-0 w-[360px] h-[200px]"
        width="360"
        height="200"
        viewBox="0 0 360 200"
        preserveAspectRatio="xMaxYMax meet"
      >
        <defs>
          <linearGradient id="waveBottomGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path fill="url(#waveBottomGrad)" fillOpacity={0.9} d="M 360 200 L 160 200 Q 100 160 160 100 L 320 60 Q 360 80 360 140 Z" />
      </svg>

      <div
        className="absolute top-0 right-0 w-[140px] h-[100px]"
        style={{
          backgroundImage:
            "radial-gradient(#93c5fd 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0",
          opacity: 0.5,
        }}
        aria-hidden="true"
      />

      <div
        className="absolute bottom-0 left-0 w-[120px] h-[80px]"
        style={{
          backgroundImage:
            "radial-gradient(#93c5fd 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          backgroundPosition: "0 0",
          opacity: 0.5,
        }}
        aria-hidden="true"
      />
    </div>
  )
}
