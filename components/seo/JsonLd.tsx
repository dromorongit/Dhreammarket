import type { FC } from 'react'

interface JsonLdProps {
  schema: Record<string, unknown>
}

export const JsonLd: FC<JsonLdProps> = ({ schema }) => {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}