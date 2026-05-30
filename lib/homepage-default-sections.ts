import type { PrismaClient } from '@prisma/client'
import { DEFAULT_HOMEPAGE_SECTIONS } from '@/lib/homepage-constants'

export async function ensureDefaultHomepageSections(prisma: PrismaClient) {
  for (const section of DEFAULT_HOMEPAGE_SECTIONS) {
    await prisma.homepageSection.upsert({
      where: { slug: section.slug },
      create: {
        name: section.name,
        slug: section.slug,
        type: section.type,
        subtitle: section.subtitle,
        displayOrder: section.displayOrder,
        isEnabled: true,
      },
      update: {},
    })
  }
}
