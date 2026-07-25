export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 py-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
        <div className="animate-pulse space-y-8">
          <div className="h-10 w-32 bg-gray-200 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-48 bg-gray-200 rounded-lg" />
              <div className="h-64 bg-gray-200 rounded-lg" />
              <div className="h-48 bg-gray-200 rounded-lg" />
            </div>
            <div className="h-96 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
