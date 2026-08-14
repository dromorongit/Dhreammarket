interface ProductStockIndicatorProps {
  stock: number | null | undefined
  reservedQuantity?: number | null | undefined
  availabilityType?: string | null
}

const STOCK_REFERENCE = 20

export function ProductStockIndicator({ stock, reservedQuantity, availabilityType }: ProductStockIndicatorProps) {
  if (availabilityType === 'PREORDER' || availabilityType === 'BACKORDER') {
    return null
  }

  if (stock == null) {
    return null
  }

  const availableStock = stock - (reservedQuantity || 0)
  const isOutOfStock = availableStock <= 0

  let barColor = 'bg-emerald-400'
  if (isOutOfStock) {
    barColor = 'bg-red-400'
  } else if (availableStock <= 2) {
    barColor = 'bg-red-400'
  } else if (availableStock <= 10) {
    barColor = 'bg-amber-400'
  }

  const barWidth = isOutOfStock ? 0 : Math.min((availableStock / STOCK_REFERENCE) * 100, 100)
  const text = isOutOfStock ? 'Out of Stock' : `${availableStock} left`

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
