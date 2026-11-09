import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = dirname(fileURLToPath(import.meta.url))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p)
  }
  return out
}

// Build regexes via RegExp so the quote characters don't upset the parser.
const SQ = String.fromCharCode(39)
const DQ = String.fromCharCode(34)
const Q = SQ + DQ
const FROM_RE = new RegExp(
  '(?:import|export)[^' + Q + ']*?from\\s*[' + Q + ']([^' + Q + ']+)[' + Q + ']',
  'g',
)
const DYNAMIC_RE = new RegExp(
  '(?:import|require)\\s*\\(\\s*[' + Q + ']([^' + Q + ']+)[' + Q + ']\\s*\\)',
  'g',
)
const FORBIDDEN = ['prisma', 'next', 'fs', 'http', 'https', 'net', 'child_process']

function specifiers(source: string): string[] {
  const specs: string[] = []
  for (const re of [FROM_RE, DYNAMIC_RE]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) specs.push(m[1])
  }
  return specs
}

describe('import hygiene', () => {
  const files = walk(SRC)
  const specsByFile = files.map((f) => ({ f, specs: specifiers(readFileSync(f, 'utf8')) }))

  it('finds non-test source files', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('every source import is a relative path inside src/', () => {
    const offenders: Array<{ file: string; spec: string }> = []
    for (const { f, specs } of specsByFile) {
      for (const spec of specs) {
        if (!spec.startsWith('.')) {
          offenders.push({ file: f, spec })
          continue
        }
        const abs = resolve(dirname(f), spec)
        if (abs !== SRC && !abs.startsWith(SRC + sep)) offenders.push({ file: f, spec })
      }
    }
    expect(offenders).toEqual([])
  })

  it('no source file imports forbidden modules (prisma/next/fs/http/https/net/child_process)', () => {
    const hits: string[] = []
    for (const { f, specs } of specsByFile) {
      for (const spec of specs) {
        if (
          spec.startsWith('node:') ||
          FORBIDDEN.some((bad) => spec === bad || spec.startsWith(`${bad}/`))
        ) {
          hits.push(`${f} -> ${spec}`)
        }
      }
    }
    expect(hits).toEqual([])
  })
})
