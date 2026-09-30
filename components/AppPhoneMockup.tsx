/**
 * App Phone Mockup
 *
 * Replace the inner <div className="phone-screen"> contents with a real screenshot
 * when app screenshots are ready. Keep the outer frame classes unchanged.
 */

export default function AppPhoneMockup() {
  return (
    <div className="relative mx-auto w-64 sm:w-72">
      {/* Phone frame */}
      <div className="relative rounded-[3rem] border-[6px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-b-2xl z-10" />

        {/* Screen - replace the content below with a real screenshot later */}
        <div className="phone-screen relative aspect-[9/19] bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-royal-blue/10 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-royal-blue/20" />
            </div>
            <div className="h-3 w-24 mx-auto rounded-full bg-slate-300 mb-2" />
            <div className="h-2 w-16 mx-auto rounded-full bg-slate-200" />
          </div>
        </div>
      </div>

      {/* Decorative blur - contained so it cannot cause horizontal scroll */}
      <div className="absolute -z-10 -inset-4 bg-royal-blue/20 rounded-[3.5rem] blur-2xl" />
    </div>
  )
}
