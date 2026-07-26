import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const prisma = getPrisma()
  const start = Date.now()
  const count = await prisma.store.count({ where: { isVerified: true } })
  const elapsed = Date.now() - start
  console.log(`[DEBUG] store-count elapsed=${elapsed}ms count=${count}`)
  return NextResponse.json({ success: true, count })
}
