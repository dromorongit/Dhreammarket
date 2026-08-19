export function getOptimizedCloudinaryUrl(url: string | null | undefined, width: number = 400, quality: number = 80): string {
  if (!url) return ''
  if (!url.includes('res.cloudinary.com') && !url.includes('cloudinary.com')) return url

  const transformation = `f_auto,q_auto,w_${width}`

  if (url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/${transformation}/`)
  }

  return url
}
