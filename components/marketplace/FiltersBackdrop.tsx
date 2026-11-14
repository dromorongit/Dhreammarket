'use client'

export function FiltersBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 pointer-events-none select-none hidden md:block"
    >
      {/* Top-left: paler band behind (340x200), fading transparent toward the right */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 z-0 pointer-events-none w-[340px] h-[200px]"
        width="340"
        height="200"
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

      {/* Top-left: solid blue crescent (150x150) hugging the corner */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 z-0 pointer-events-none w-[150px] h-[150px]"
        width="150"
        height="150"
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

      {/* Bottom-right: paler band behind (400x220), mirrored */}
      <svg
        aria-hidden="true"
        className="absolute bottom-0 right-0 z-0 pointer-events-none w-[400px] h-[220px]"
        width="400"
        height="220"
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

      {/* Bottom-right: solid blue crescent (200x170), mirrored */}
      <svg
        aria-hidden="true"
        className="absolute bottom-0 right-0 z-0 pointer-events-none w-[200px] h-[170px]"
        width="200"
        height="170"
        viewBox="0 0 200 170"
        preserveAspectRatio="xMaxYMax meet"
      >
        <path fill="url(#crescentGrad)" fillOpacity={0.9} d="M 200 170 H 50 C 110 150 160 100 200 20 Z" />
      </svg>

      {/* Dot grid: top-right (140x100, opacity 0.5) */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 z-0 pointer-events-none w-[140px] h-[100px]"
        style={{
          backgroundImage: "radial-gradient(#93c5fd 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0",
          opacity: 0.5,
        }}
      />

      {/* Dot grid: bottom-left (120x80, opacity 0.5), inside the filters block */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 z-0 pointer-events-none w-[120px] h-[80px]"
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
