'use client'

export function FiltersBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 pointer-events-none select-none hidden md:block"
    >
      <svg
        className="absolute top-0 left-0 w-full h-[40%]"
        width="100%"
        height="100%"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveTopGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path fill="url(#waveTopGrad)" d="M0 130 Q 250 20 600 150 T 1440 80 V 0 H 0 Z" />
      </svg>

      <svg
        className="absolute bottom-0 right-0 w-full h-[44%]"
        width="100%"
        height="100%"
        viewBox="0 0 1440 440"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveBottomGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <path
          fill="url(#waveBottomGrad)"
          d="M0 360 Q 400 400 800 300 T 1440 340 V 440 H 0 V 360 Z"
        />
      </svg>

      <div
        className="absolute top-0 right-0 w-[180px] h-[180px]"
        style={{
          backgroundImage:
            "radial-gradient(#93c5fd 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0",
          opacity: 0.6,
        }}
        aria-hidden="true"
      />

      <div
        className="absolute bottom-0 left-0 w-[140px] h-[140px]"
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
