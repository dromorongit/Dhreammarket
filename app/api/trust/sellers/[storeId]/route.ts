import { NextRequest, NextResponse } from 'next/server'
import { isTrustProfileEnabled } from '@/lib/feature-flags'
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'
import { composeProfile } from '@/lib/trust/metrics'
import { rehydrateProfileInput } from '@/lib/trust/rehydrate'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const STORE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

export async function GET(request: NextRequest, { params }: { params: { storeId: string } }) {
  if (!isTrustProfileEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rl = rateLimit('search')(request)
  if (!rl.success) return rl.response

  const storeId = params?.storeId
  if (!storeId || !STORE_ID_PATTERN.test(storeId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 400 })
  }

  const result = await getCachedSellerTrustProfile(storeId)
  if (!result.found) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const profile = composeProfile(rehydrateProfileInput(result.data))

  const response = NextResponse.json(profile)
  response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60')
  return response
}
