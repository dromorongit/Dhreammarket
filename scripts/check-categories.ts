import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const prisma = getPrisma()
  try {
    const cats = await prisma.productCategory.findMany({
      where: { name: { in: ['Pets','Dogs & Puppies','Cats & Kittens','Aquariums','Pet Food'] } },
      select: { id: true, name: true, parentId: true, slug: true }
    })
    console.log(JSON.stringify(cats, null, 2))
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
