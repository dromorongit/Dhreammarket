export function getBlurDataURL(width = 32, height = 32, color = '#e2e8f0'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${color}"/>
  </svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

export const CARD_IMAGE_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw'
export const CARD_IMAGE_SIZES_5COL = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw'
export const CARD_IMAGE_SIZES_4COL = '(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw'
export const CARD_IMAGE_SIZES_6COL = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, calc(100vw / 6)'
export const CARD_IMAGE_SIZES_3COL = '(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw'
export const CARD_IMAGE_SIZES_2COL = '(max-width: 640px) 100vw, 50vw'
export const HERO_IMAGE_SIZES = '100vw'
export const NAV_LOGO_SIZES = '128px'
export const VENDOR_LOGO_SIZES = '80px'
export const SEARCH_THUMB_SIZES = '56px'
