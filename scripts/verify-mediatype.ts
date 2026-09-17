import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

const prisma = getPrisma();

async function main() {
  const count = await prisma.productImage.count();
  const nulls = await prisma.$queryRawUnsafe<{ count: string }[]>(`
    SELECT COUNT(*)::text AS "count" FROM "product_images" WHERE "mediaType" IS NULL
  `);
  const dist = await prisma.$queryRawUnsafe<{ mediaType: string; count: string }[]>(`
    SELECT "mediaType", COUNT(*)::text AS "count" FROM "product_images" GROUP BY "mediaType" ORDER BY "count" DESC
  `);
  console.log("count", count);
  console.log("nulls", nulls[0]?.count);
  console.log("dist", dist.map((r) => r.mediaType + ":" + r.count).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
