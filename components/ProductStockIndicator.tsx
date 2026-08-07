interface ProductStockIndicatorProps {
  stock: number | null | undefined
  availabilityType?: string | null
}

const STOCK_REFERENCE = 20

export function ProductStockIndicator({ stock, availabilityType }: ProductStockIndicatorProps) {
  if (availabilityType === 'PREORDER' || availabilityType === 'BACKORDER') {
    return null
  }

  if (stock == null) {
    return null
  }

  const isOutOfStock = stock <= 0

  let barColor = 'bg-emerald-400'
  if (isOutOfStock) {
    barColor = 'bg-red-400'
  } else if (stock <= 2) {
    barColor = 'bg-red-400'
  } else if (stock <= 10) {
    barColor = 'bg-amber-400'
  }

  const barWidth = isOutOfStock ? 0 : Math.min((stock / STOCK_REFERENCE) * 100, 100)
  const text = isOutOfStock ? 'Out of Stock' : `${stock} left`

  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mx-0.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-500 text-left">
        {text}
      </p>
    </div>
  )
}
