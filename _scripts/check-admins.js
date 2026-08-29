const { getPrisma } = require('./lib/prisma')

async function main() {
  const prisma = getPrisma()
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, email: true, role: true, status: true }
    })
    console.log(JSON.stringify(users, null, 2))
  } catch (e) {
    console.log('DB error:', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
