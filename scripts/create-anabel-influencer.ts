import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

function generateNameBasedCode(name: string, prisma: ReturnType<typeof getPrisma>): string {
  const baseCode = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!baseCode) {
    throw new Error("Influencer name must contain at least one letter or number");
  }

  const maxCodeLength = 20;
  const truncatedBase =
    baseCode.length > maxCodeLength ? baseCode.slice(0, maxCodeLength) : baseCode;

  let referralCode = truncatedBase;
  let suffix = 2;
  while (true) {
    const existing = prisma.influencer.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (!existing) break;
    const suffixString = String(suffix);
    const candidateBase =
      truncatedBase.length > maxCodeLength - suffixString.length
        ? truncatedBase.slice(0, maxCodeLength - suffixString.length)
        : truncatedBase;
    referralCode = `${candidateBase}${suffixString}`;
    suffix++;
  }

  return referralCode;
}

async function main() {
  const prisma = getPrisma();

  const name = "Anabel Selby";
  const email = "anabel.selby@example.com";
  const phone = null;
  const incentivePerVendor = null;
  const incentivePerCustomer = null;

  const referralCode = generateNameBasedCode(name, prisma);

  let influencer = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      influencer = await prisma.influencer.create({
        data: {
          name,
          email,
          phone,
          referralCode,
          active: true,
          incentivePerVendor,
          incentivePerCustomer,
        },
      });
      break;
    } catch (error: any) {
      if (error.code === "P2002" && attempts < maxAttempts - 1) {
        attempts++;
        continue;
      }
      throw error;
    }
  }

  if (!influencer) {
    console.error("Failed to create influencer after multiple attempts");
    process.exit(1);
  }

  console.log("Created influencer:");
  console.log(JSON.stringify(influencer, null, 2));
  console.log("\nTrackable link:");
  console.log(`http://localhost:3000/api/influencer/${influencer.referralCode}`);
}

main().catch((error) => {
  console.error("Error creating influencer:", error);
  process.exit(1);
});

