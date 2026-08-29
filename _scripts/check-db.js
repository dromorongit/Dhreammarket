const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.$queryRaw`SELECT 1`
  .then(() => console.log('DB OK'))
  .catch(e => console.log('DB ERROR:', e.message))
  .finally(() => prisma.$disconnect())
