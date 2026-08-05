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

  const existingSlugs = await prisma.homepageSection.findMany({
    where: { slug: { in: DEFAULT_HOMEPAGE_SECTIONS.map((s) => s.slug) } },
    select: { slug: true },
  })
  const existingSlugSet = new Set(existingSlugs.map((s) => s.slug))
  const missingSections = DEFAULT_HOMEPAGE_SECTIONS.filter((s) => !existingSlugSet.has(s.slug))

  for (const section of missingSections) {
    try {
      const existingSettings = {} as Record<string, any>
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
