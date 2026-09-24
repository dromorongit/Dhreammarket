import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

async function main() {
  const prisma = getPrisma();

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: "INF-FF27E412" },
    select: { id: true, name: true, referralCode: true },
  });

  if (!influencer) {
    console.log("No influencer found with code INF-FF27E412");
    await prisma.$disconnect();
    return;
  }

  const [clickCount, referralCount] = await Promise.all([
    prisma.influencerClick.count({ where: { influencerId: influencer.id } }),
    prisma.influencerReferral.count({ where: { influencerId: influencer.id } }),
  ]);

  console.log(`Anabel Selby: id=${influencer.id}, currentCode=${influencer.referralCode}`);
  console.log(`Dependent row counts: clicks=${clickCount}, referrals=${referralCount}`);

  if (clickCount === 0 && referralCount === 0) {
    console.log("SAFE TO UPDATE: zero dependent rows exist.");
  } else {
    console.error("NOT SAFE: dependent rows exist. Aborting update.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
