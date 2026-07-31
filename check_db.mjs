import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const sections = await prisma.homepageSection.findMany({ orderBy: { displayOrder: 'asc' } });
  console.log(JSON.stringify(sections, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());