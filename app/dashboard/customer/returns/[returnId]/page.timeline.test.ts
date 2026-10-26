import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const DETAIL_DIR = path.join(
  process.cwd(),
  'app',
  'dashboard',
  'customer',
  'returns',
  '[returnId]'
)

function source(file: string): string {
  return fs.readFileSync(path.join(DETAIL_DIR, file), 'utf8')
}

describe('return detail timeline excludes raw notes', () => {
  const page = source('page.tsx')

  it('does not select note from Prisma for events', () => {
    const eventsBlock = page.match(/events:\s*\{\s*select:\s*\{[^}]*\}/)
    expect(eventsBlock).not.toBeNull()
    expect(eventsBlock![0]).not.toContain('note')
  })

  it('maps events without a note field, even when the source event has one', () => {
    expect(page).not.toContain('event.note')
    expect(page).not.toMatch(/note:\s*event/)
  })
})

describe('ReturnTimeline component excludes notes', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'components', 'returns', 'ReturnTimeline.tsx'),
    'utf8'
  )

  it('has no note field on the timeline event type', () => {
    expect(src).not.toContain('note?: string')
    expect(src).not.toContain('note: string')
  })

  it('does not render event.note', () => {
    expect(src).not.toContain('event.note')
  })
})
