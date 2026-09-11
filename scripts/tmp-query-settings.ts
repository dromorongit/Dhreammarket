import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const s = await getPrisma().superAdminSettings.findFirst()
  console.log('platformFee:', s?.platformFee)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await getPrisma().$disconnect())
