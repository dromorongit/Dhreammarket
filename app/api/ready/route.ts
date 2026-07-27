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

    const checks = {
      database: { status: 'ready', latencyMs: dbLatency },
      prismaClient: { status: 'ready' },
    }

    logInfo('Readiness check passed', { requestId, dbLatency })

    return NextResponse.json(
      {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
      },
      { status: 200 }
    )
  } catch (error) {
    logError('Readiness check failed', error, { requestId })

    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'error', error: error instanceof Error ? error.message : 'Unknown' },
          prismaClient: { status: 'error' },
        },
      },
      { status: 503 }
    )
  }
}
