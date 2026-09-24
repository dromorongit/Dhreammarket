import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

async function main() {
  const prisma = getPrisma();

  const oldCode = "INF-FF27E412";
  const newCode = "ANABELSELBY";

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: oldCode },
    select: { id: true, name: true, referralCode: true },
  });

  if (!influencer) {
    console.log(`No influencer found with referralCode=${oldCode}. Nothing to update.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Found influencer: ${influencer.name} (id=${influencer.id}, code=${influencer.referralCode})`);

  const [clickCount, referralCount] = await Promise.all([
    prisma.influencerClick.count({ where: { influencerId: influencer.id } }),
    prisma.influencerReferral.count({ where: { influencerId: influencer.id } }),
  ]);

  console.log(`Dependent rows: influencer_clicks=${clickCount}, influencer_referrals=${referralCount}`);

  if (clickCount > 0 || referralCount > 0) {
    console.error("REFUSING TO UPDATE: dependent rows exist. Updating the code would leave them pointing to the old code via influencerId foreign key.");
    await prisma.$disconnect();
    process.exit(1);
  }

  const updated = await prisma.influencer.update({
    where: { id: influencer.id },
    data: { referralCode: newCode },
  });

  console.log("\nUpdated influencer:");
  console.log(JSON.stringify(updated, null, 2));

  const verify = await prisma.influencer.findUnique({
    where: { id: influencer.id },
    select: { id: true, name: true, referralCode: true },
  });
  console.log("\nVerification query:");
  console.log(JSON.stringify(verify, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
