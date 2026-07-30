import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, filters } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    await getPrisma().savedSearch.create({
      data: {
        userId: payload.userId,
        query,
        filters: filters || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const savedSearches = await getPrisma().savedSearch.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ savedSearches })
  } catch (error) {
    console.error('Error fetching saved searches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchId } = await request.json()

    if (!searchId) {
      return NextResponse.json({ error: 'Search ID is required' }, { status: 400 })
    }

    const savedSearch = await getPrisma().savedSearch.findUnique({
      where: { id: searchId },
      select: { userId: true },
    })

    if (!savedSearch || savedSearch.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await getPrisma().savedSearch.delete({ where: { id: searchId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting saved search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}