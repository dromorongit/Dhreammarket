import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const prisma = getPrisma()

  const user = await prisma.user.findUnique({
    where: { id: 'cmugyxbpr00001rp8143exrkj' },
    select: { id: true, email: true, role: true, createdAt: true, emailVerifiedAt: true, isEmailVerified: true },
  })

  const pending = await prisma.pendingRegistration.findUnique({
    where: { email: 'doreeneweonamkingsford@gmail.com' },
  })

  console.log(JSON.stringify({ user, pendingRegistration: pending ? { email: pending.email, createdAt: pending.createdAt } : null }, null, 2))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
