import type { PrismaClient } from '@prisma/client'
import { DEFAULT_HOMEPAGE_SECTIONS } from '@/lib/homepage-constants'
import { HomepageSectionType } from '@prisma/client'

export async function ensureDefaultHomepageSections(prisma: PrismaClient) {
  try {
    // Check if homepage_sections table exists by attempting a simple query
    await prisma.$queryRaw`SELECT 1 FROM homepage_sections LIMIT 1`
  } catch (e) {
    console.error('[ensureDefaultHomepageSections] Table homepage_sections does not exist:', e)
    return
  }

  for (const section of DEFAULT_HOMEPAGE_SECTIONS) {
    try {
      await prisma.homepageSection.upsert({
        where: { slug: section.slug },
        create: {
          name: section.name,
          slug: section.slug,
          type: section.type as HomepageSectionType,
          subtitle: section.subtitle,
          displayOrder: section.displayOrder,
          isEnabled: true,
        },
        update: {},
      })
    } catch (e) {
      console.error(`[ensureDefaultHomepageSections] Failed to upsert section ${section.slug}:`, e)
    }
  }
}
