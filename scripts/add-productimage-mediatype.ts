import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

const prisma = getPrisma();

async function main() {
  console.log("=== PHASE 4: ADD mediaType TO ProductImage ===");

  console.log("\n--- BEFORE SNAPSHOT ---");
  const beforeCount = await prisma.productImage.count();
  console.log(`product_images row count before: ${beforeCount}`);

  const sql = `
    ALTER TABLE "product_images"
    ADD COLUMN IF NOT EXISTS "mediaType" VARCHAR(20) NOT NULL DEFAULT 'image';
  `;

  console.log("\n--- EXECUTING MIGRATION ---");
  console.log(sql);
  try {
    const result = await prisma.$executeRawUnsafe(sql);
    console.log("RESULT:", result);
  } catch (e) {
    console.error("ERROR:", e);
    process.exit(1);
  }

  console.log("\n--- AFTER SNAPSHOT ---");
  const afterCount = await prisma.productImage.count();
  console.log(`product_images row count after: ${afterCount}`);

  const nullMediaTypeAfter = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS "count"
    FROM "product_images"
    WHERE "mediaType" IS NULL
  `);
  const nullCountAfter = nullMediaTypeAfter[0]?.count ?? BigInt(0);
  console.log(`product_images rows with NULL mediaType after: ${nullCountAfter}`);

  const mediaTypeDistribution = await prisma.$queryRawUnsafe<{ mediaType: string; count: bigint }[]>(`
    SELECT "mediaType", COUNT(*)::bigint AS "count"
    FROM "product_images"
    GROUP BY "mediaType"
    ORDER BY "count" DESC
  `);
  console.log(`product_images mediaType distribution: ${JSON.stringify(mediaTypeDistribution)}`);

  if (afterCount !== beforeCount) {
    console.error("DATA LOSS DETECTED: row count changed during migration.");
    process.exit(1);
  }

  if (nullCountAfter > BigInt(0)) {
    console.error("DATA LOSS DETECTED: NULL mediaType rows remain after migration.");
    process.exit(1);
  }

  console.log("\n=== MIGRATION COMPLETE: no data loss detected ===");
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
