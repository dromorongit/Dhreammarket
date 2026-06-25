import type { FC } from 'react'

const SITE_URL = 'https://www.dhreamarket.com'
const SITE_LOGO = `${SITE_URL}/assets/images/dhreammarket.png`

export const OrganizationJsonLd: FC = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dhream Market',
    url: SITE_URL,
    logo: SITE_LOGO,
    sameAs: [
      'https://www.instagram.com/dhreamarket',
      'https://www.tiktok.com/@dhreamarket',
      'https://www.x.com/dhreamarket',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+233596522239',
        contactType: 'customer service',
        availableLanguage: 'English',
      },
      {
        '@type': 'ContactPoint',
        telephone: '+233508548181',
        contactType: 'customer service',
        availableLanguage: 'English',
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}