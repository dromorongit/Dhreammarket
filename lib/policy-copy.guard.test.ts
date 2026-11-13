import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const FORBIDDEN = [
  '3-5 business days',
  '10-14 business days',
  '5-10 business days',
  'within 3 days of receiving',
  '1-3 business days',
  'Paystack fees are deducted',
  'minus platform commission (if applicable) and payment processing fees',
]

const LEGAL_DIRS = ['app/terms', 'app/refund', 'app/payment-policy']
const GUARD_FILE = 'policy-copy.guard.test.ts'

function isExcluded(filePath: string): boolean {
  if (filePath.includes('/docs/') || filePath.includes('\\docs\\')) return true
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) return true
  if (filePath.includes('/node_modules/') || filePath.includes('\\node_modules\\')) return true
  if (filePath.includes('\\.next\\') || filePath.includes('/.next/')) return true
  if (filePath.includes('\\.git\\') || filePath.includes('/.git/')) return true
  if (path.basename(filePath) === GUARD_FILE) return true
  return LEGAL_DIRS.some((dir) => {
    const target = dir.split('/').join(path.sep)
    return filePath.includes(path.sep + target)
  })
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (/^(node_modules|\.next|\.git|docs)$/i.test(entry.name)) continue
      yield* walk(full)
    } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) yield full
  }
}

describe('policy copy guard', () => {
  it('no non-legal source file contains retired policy phrases', () => {
    const root = process.cwd()
    const violations: Array<{ file: string; line: number; phrase: string }> = []
    for (const file of walk(root)) {
      if (isExcluded(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split('\n')
      for (const phrase of FORBIDDEN) {
        lines.forEach((line, i) => {
          if (line.includes(phrase)) {
            violations.push({ file: path.relative(root, file), line: i + 1, phrase })
          }
        })
      }
    }
    expect(violations).toEqual([])
  })
})
