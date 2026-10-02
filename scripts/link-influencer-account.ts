import "dotenv/config"
import { getPrisma } from "@/lib/prisma"

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes("--apply")
  return { dryRun }
}

async function main() {
  const { dryRun } = parseArgs()
  const prisma = getPrisma()

  const userEmail = "anabelselby@dhreamarket.com"
  const influencerCode = "ANABELSELBY"

  console.log(`\nMode: ${dryRun ? "DRY-RUN" : "APPLY"}\n`)

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, email: true, role: true },
  })

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: influencerCode },
    select: { id: true, name: true, referralCode: true },
  })

  console.log("--- BEFORE ---")
  console.log("User:", JSON.stringify(user, null, 2))
  console.log("Influencer:", JSON.stringify(influencer, null, 2))

  if (!user) {
    console.error(`\nABORT: User with email "${userEmail}" not found.`)
    process.exit(1)
  }

  if (!influencer) {
    console.error(`\nABORT: Influencer with referral code "${influencerCode}" not found.`)
    process.exit(1)
  }

  if (dryRun) {
    console.log("\n--- DRY-RUN: would apply the following changes ---")
    console.log(`Update user ${user.id} role: ${user.role} -> INFLUENCER`)
    console.log(`Update influencer ${influencer.id} userId: null -> ${user.id}`)
    console.log("\nRe-run with --apply to execute.")
    process.exit(0)
  }

  const result = await prisma.$transaction(async (tx) => {
    const freshUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true },
    })

    if (!freshUser || (freshUser.role !== 'ADMIN' && freshUser.role !== 'INFLUENCER')) {
      throw new Error(`ABORT: User ${user.id} is no longer ADMIN or INFLUENCER (current role: ${freshUser?.role ?? 'MISSING'})`)
    }

    const fullInfluencer = await tx.influencer.findUnique({
      where: { referralCode: influencerCode },
      select: { id: true, name: true, referralCode: true, userId: true },
    })

    if (!fullInfluencer) {
      throw new Error(`ABORT: Influencer with referral code "${influencerCode}" not found.`)
    }

    if (fullInfluencer.userId && fullInfluencer.userId !== user.id) {
      throw new Error(`ABORT: Influencer is already linked to a different user (userId: ${fullInfluencer.userId}).`)
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { role: "INFLUENCER" },
    })

    const updatedInfluencer = await tx.influencer.update({
      where: { id: influencer.id },
      data: { userId: user.id },
    })

    return { updatedUser, updatedInfluencer }
  })

  console.log("\n--- AFTER ---")
  console.log("User:", JSON.stringify(result.updatedUser, null, 2))
  console.log("Influencer:", JSON.stringify(result.updatedInfluencer, null, 2))
  console.log("\nDone.")
}

main().catch((error) => {
  console.error("ERROR:", error.message)
  process.exit(1)
}).finally(async () => {
  await getPrisma().$disconnect()
})
