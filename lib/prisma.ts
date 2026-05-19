import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
    
    // Use PostgreSQL adapter if DATABASE_URL is provided, otherwise use default SQLite
    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      const pool = new Pool({ connectionString: databaseUrl })
      const adapter = new PrismaPg(pool)
      globalForPrisma.prisma = new PrismaClient({ adapter })
    } else {
      // Fallback to default SQLite connection
      globalForPrisma.prisma = new PrismaClient()
    }
  }
  return globalForPrisma.prisma
}