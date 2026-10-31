import { FiShoppingCart, FiHome, FiShield, FiZap } from 'react-icons/fi'

const items = [
  { title: 'Shop', text: 'Great products at your fingertips', icon: FiShoppingCart, color: 'bg-dhream-orange' },
  { title: 'Sell', text: 'Grow your business', icon: FiHome, color: 'bg-dhream-teal' },
  { title: 'Safe', text: 'Secure & reliable', icon: FiShield, color: 'bg-dhream-coral' },
  { title: 'Fast', text: 'Smooth experience', icon: FiZap, color: 'bg-dhream-orange-deep' },
]

export default function FeatureCards() {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-poppins font-bold text-2xl sm:text-3xl text-dhream-navy mb-8">
          Why you&apos;ll love it
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="relative flex flex-col items-center text-center px-4 py-6"
              >
                {idx > 0 && (
                  <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-px h-16 bg-slate-200" />
                )}
                <div className={`w-14 h-14 rounded-full ${item.color} text-white flex items-center justify-center mb-3 shadow-md`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-poppins font-bold text-lg text-dhream-navy">{item.title}</h3>
                <p className="text-sm text-dhream-muted mt-1">{item.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
