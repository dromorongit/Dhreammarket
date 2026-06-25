import Image from 'next/image'

export function MarketplaceHeroImage() {
  return (
    <div className="relative h-64 sm:h-80 lg:h-96">
      <Image
        src="/assets/images/marketplace-hero.jpg"
        alt="Dhream Market - Premium products from verified Ghanaian vendors"
        fill
        className="object-cover"
        priority
        placeholder="blur"
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI4MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3htbG5zIyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y4ZjhmOCIvPjwvc3ZnPg=="
      />
    </div>
  )
}