export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/dhreamarket',
  tiktok: 'https://www.tiktok.com/@dhreamarket',
  x: 'https://www.x.com/dhreamarket',
  facebook: 'https://www.facebook.com/share/1LkEuGWrL7/?mibextid=wwXIfr',
} as const

export type SocialPlatform = keyof typeof SOCIAL_LINKS
