import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'

    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        maxUses: 7500,
        ssl: { rejectUnauthorized: false },
      })
      const adapter = new PrismaPg(pool)
      globalForPrisma.pool = pool
      globalForPrisma.prisma = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV !== 'production' ? ['query', 'info', 'warn', 'error'] : ['error'],
      })
    } else {
      globalForPrisma.prisma = new PrismaClient({
        log: process.env.NODE_ENV !== 'production' ? ['query', 'info', 'warn', 'error'] : ['error'],
      })
    }
  }
  return globalForPrisma.prisma
}

declare global {
  function onTerminate(): void
}

if (typeof onTerminate !== 'undefined') {
  process.on('SIGTERM', () => {
    globalForPrisma.pool?.end()
    globalForPrisma.prisma?.$disconnect()
  })
  process.on('SIGINT', () => {
    globalForPrisma.pool?.end()
    globalForPrisma.prisma?.$disconnect()
  })
}
