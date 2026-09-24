import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

async function main() {
  const prisma = getPrisma();
  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: "INF-FF27E412" },
    include: {
      referrals: true,
      clicks: true,
    },
  });
  console.log(JSON.stringify(influencer, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
