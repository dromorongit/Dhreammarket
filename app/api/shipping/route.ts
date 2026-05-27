import { NextRequest, NextResponse } from 'next/server'
import { getShippingRate, getAvailableRegions, SHIPPING_ZONES } from '@/lib/shipping'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const city = searchParams.get('city') || ''
  const region = searchParams.get('region') || ''

  if (!city && !region) {
    return NextResponse.json({
      error: 'City or region parameter is required',
      regions: getAvailableRegions()
    }, { status: 400 })
  }

  const rate = getShippingRate(city, region)

  if (!rate) {
    return NextResponse.json({
      error: 'Unable to calculate shipping for this location',
      price: 40.00,
      estimatedDays: { min: 3, max: 7 }
    }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    price: rate.price,
    estimatedDays: rate.estimatedDays,
    zone: rate.zone.name,
    description: rate.zone.description
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, city, region } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({
        error: 'Items array is required'
      }, { status: 400 })
    }

    if (!city && !region) {
      return NextResponse.json({
        error: 'City or region is required'
      }, { status: 400 })
    }

    const rate = getShippingRate(city, region)
    const shippingPrice = rate ? rate.price : 40.00

    return NextResponse.json({
      success: true,
      shippingPrice,
      estimatedDays: rate?.estimatedDays || { min: 3, max: 7 },
      zone: rate?.zone.name || 'Other Locations'
    })
  } catch (error) {
    console.error('Shipping calculation error:', error)
    return NextResponse.json({
      error: 'Failed to calculate shipping'
    }, { status: 500 })
  }
} 
