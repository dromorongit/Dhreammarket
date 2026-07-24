import type { FC } from 'react'

const SITE_URL = 'https://www.dhreamarket.com'

interface OrganizationJsonLdProps {
  name?: string
  logoUrl?: string
  supportPhone?: string
}

export const OrganizationJsonLd: FC<OrganizationJsonLdProps> = ({ name = 'Dhream Market', logoUrl, supportPhone }) => {
  const siteLogo = logoUrl || `${SITE_URL}/assets/images/dhreammarket.png`
  const phones = supportPhone ? [supportPhone] : ['+233596522239', '+233508548181']
  const contactPoints = phones.map((phone) => ({
    '@type': 'ContactPoint' as const,
    telephone: phone,
    contactType: 'customer service',
    availableLanguage: 'English',
  }))

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: SITE_URL,
    logo: siteLogo,
    sameAs: [
      'https://www.instagram.com/dhreamarket',
      'https://www.tiktok.com/@dhreamarket',
      'https://www.x.com/dhreamarket',
    ],
    contactPoint: contactPoints,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}