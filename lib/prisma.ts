import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { logInfo } from './logger'

const MAX_CACHE_SIZE = 500

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
  disconnectHandlersRegistered: boolean
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

    registerDisconnectHandlers()
  }
  return globalForPrisma.prisma
}

function registerDisconnectHandlers(): void {
  if (globalThis.process?.env?.NODE_ENV === 'test') return
  if (globalForPrisma.disconnectHandlersRegistered) return

  const gracefulShutdown = async (signal: string) => {
    logInfo(`Received ${signal} - initiating graceful shutdown`)
    try {
      await globalForPrisma.pool?.end()
      await globalForPrisma.prisma?.$disconnect()
      logInfo('Prisma disconnected successfully')
    } catch (error) {
      console.error('Error during Prisma graceful shutdown:', error)
    } finally {
      process.exit(0)
    }
  }

  if (typeof process !== 'undefined') {
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    globalForPrisma.disconnectHandlersRegistered = true
    logInfo('Graceful shutdown handlers registered for Prisma')
  }
}

function enforceCacheCap<T>(cache: Map<string, { value: T; expiresAt: number }>): void {
  if (cache.size <= MAX_CACHE_SIZE) return

  const keys = Array.from(cache.keys())
  const excess = cache.size - MAX_CACHE_SIZE
  for (let i = 0; i < excess && i < keys.length; i++) {
    cache.delete(keys[i])
  }
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 60000
): Promise<T> {
  const cache = globalForPrisma as unknown as { _cache?: Map<string, { value: T; expiresAt: number }> }
  if (!cache._cache) {
    cache._cache = new Map()
  }
  const cached = cache._cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }
  const value = await fetcher()
  enforceCacheCap(cache._cache)
  cache._cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}
