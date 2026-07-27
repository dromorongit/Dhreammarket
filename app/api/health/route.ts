import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { logInfo, logError } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || undefined
  try {
    const prisma = getPrisma()
    const start = Date.now()

    await prisma.$queryRaw`SELECT 1`

    const dbLatency = Date.now() - start

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      database: {
        status: 'connected',
        latencyMs: dbLatency,
      },
    }

    logInfo('Health check passed', { requestId, dbLatency })

    return NextResponse.json(health, { status: 200 })
  } catch (error) {
    logError('Health check failed', error, { requestId })

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
