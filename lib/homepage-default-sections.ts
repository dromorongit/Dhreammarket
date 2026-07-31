import type { PrismaClient } from '@prisma/client'
import { DEFAULT_HOMEPAGE_SECTIONS, type ContentSource } from '@/lib/homepage-constants'
import { HomepageSectionType } from '@prisma/client'

export async function ensureDefaultHomepageSections(prisma: PrismaClient) {
  try {
    await prisma.$queryRaw`SELECT 1 FROM homepage_sections LIMIT 1`
  } catch (e) {
    console.error('[ensureDefaultHomepageSections] Table homepage_sections does not exist:', e)
    return
  }

  for (const section of DEFAULT_HOMEPAGE_SECTIONS) {
    try {
      const existing = await prisma.homepageSection.findUnique({
        where: { slug: section.slug },
      })

      const existingSettings = (existing?.settings || {}) as Record<string, any>
      const settings = {
        ...existingSettings,
        contentSource: section.contentSource,
      }

      await prisma.homepageSection.upsert({
        where: { slug: section.slug },
        create: {
          name: section.name,
          slug: section.slug,
          type: section.type as HomepageSectionType,
          subtitle: section.subtitle,
          displayOrder: section.displayOrder,
          isEnabled: true,
          settings: settings as any,
        },
        update: {
          name: section.name,
          type: section.type as HomepageSectionType,
          subtitle: section.subtitle,
          displayOrder: section.displayOrder,
          settings: settings as any,
        },
      })
    } catch (e) {
      console.error(`[ensureDefaultHomepageSections] Failed to upsert section ${section.slug}:`, e)
    }
  }
}
