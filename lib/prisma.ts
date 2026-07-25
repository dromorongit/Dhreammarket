import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

export function getPrisma(): PrismaClient {
  console.log('[PRISMA] getPrisma called')
  if (!globalForPrisma.prisma) {
    const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
    console.log('[PRISMA] Initializing new Prisma client, DATABASE_URL starts with:', databaseUrl.substring(0, 10))
    
    // Use PostgreSQL adapter if DATABASE_URL is provided, otherwise use default SQLite
    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      console.log('[PRISMA] Using PostgreSQL adapter')
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
      globalForPrisma.prisma = new PrismaClient({ adapter })
    } else {
      // Fallback to default SQLite connection
      console.log('[PRISMA] Using SQLite connection')
      globalForPrisma.prisma = new PrismaClient()
    }
  }
  console.log('[PRISMA] Returning existing Prisma client')
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