const { getPrisma } = require('../lib/prisma')

async function main() {
  const prisma = getPrisma()
  try {
    const result = await prisma.$queryRawUnsafe('SELECT 1 AS one')
    console.log('SELECT 1 result:', JSON.stringify(result))
  } catch (e) {
    console.error('SELECT 1 error:', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
