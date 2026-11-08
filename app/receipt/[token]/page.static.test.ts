import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('receipt page notFound handling', () => {
  it('calls notFound for missing receipts instead of rendering NotFound', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'receipt', '[token]', 'page.tsx'), 'utf8')
    expect(source).toContain("import { notFound } from 'next/navigation'")
    expect(source).toContain('if (!receipt) {')
    expect(source).toContain('notFound()')
    expect(source).not.toContain('return <NotFound />')
  })
})

describe('receipt page client/server boundary', () => {
  it('keeps interactive handlers out of the server page', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'app', 'receipt', '[token]', 'page.tsx'), 'utf8')
    const printButton = fs.readFileSync(
      path.join(process.cwd(), 'app', 'receipt', '[token]', 'PrintButton.tsx'),
      'utf8'
    )

    expect(page).not.toContain('onClick=')
    expect(page).not.toContain('window.')
    expect(page).toContain('id="receipt-content"')
    expect(printButton.startsWith("'use client'")).toBe(true)
  })
})