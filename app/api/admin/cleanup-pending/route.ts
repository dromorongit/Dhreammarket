import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

// Cleanup expired pending registrations (can be called via cron or on startup)
export async function POST(request: NextRequest) {
  try {
    // Simple auth check - in production use proper admin auth
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getPrisma().pendingRegistration.deleteMany({
      where: {
        otpExpiresAt: { lt: new Date() }
      }
    })

    return NextResponse.json({ 
      message: 'Cleanup completed',
      deletedCount: result.count
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Cleanup on module load
if (typeof window === 'undefined') {
  getPrisma().pendingRegistration.deleteMany({
    where: {
      otpExpiresAt: { lt: new Date() }
    }
  }).catch(err => {
    console.error('Initial cleanup of expired pending registrations failed:', err)
  })
}