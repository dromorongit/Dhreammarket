import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const prisma = getPrisma()
  const existing = await prisma.superAdminSettings.findFirst()
  if (!existing) {
    console.log('No settings row found, creating with platformFee=1')
    await prisma.superAdminSettings.create({ data: { platformFee: 1 } })
    console.log('Created settings with platformFee=1')
  } else {
    console.log('Before update - platformFee:', existing.platformFee)
    await prisma.superAdminSettings.update({
      where: { id: existing.id },
      data: { platformFee: 1 },
    })
    const updated = await prisma.superAdminSettings.findFirst()
    console.log('After update - platformFee:', updated?.platformFee)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await getPrisma().$disconnect())
