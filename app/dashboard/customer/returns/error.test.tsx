import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const src = fs.readFileSync(
  path.join(process.cwd(), 'app', 'dashboard', 'customer', 'returns', 'error.tsx'),
  'utf8'
)

describe('returns error boundary', () => {
  it('is a client component with a reset button', () => {
    expect(src).toContain('use client')
    expect(src).toContain('reset')
  })

  it('links back to My Returns', () => {
    expect(src).toContain('/dashboard/customer/returns')
  })
})
