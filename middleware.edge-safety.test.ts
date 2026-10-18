import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null
  const base = spec.startsWith('@/')
    ? path.join(ROOT, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec)
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
  for (const extension of extensions) {
    const candidate = base + extension
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  for (const extension of extensions) {
    const candidate = path.join(base, `index${extension}`)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function parseRuntimeImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8')
  const imports: string[] = []
  for (const line of source.split(/\r?\n/)) {
    const fromMatch = line.match(/^\s*(?:import|export)\s+(.+?)\s+from\s+['"]([^'"]+)['"]/)
    if (fromMatch) {
      const clause = fromMatch[1].trim()
      const typeOnly = /^type\b/.test(clause) || /^\{\s*type\b/.test(clause)
      if (!typeOnly) imports.push(fromMatch[2])
    }
    const dynamicMatch = line.match(/import\(['"]([^'"]+)['"]\)/)
    if (dynamicMatch) imports.push(dynamicMatch[1])
  }
  return imports
}

function walkImports(startFile: string): string[] {
  const seen = new Set<string>()
  const stack = [startFile]
  const files: string[] = []
  while (stack.length > 0) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    files.push(file)
    for (const spec of parseRuntimeImports(file)) {
      const resolved = resolveImport(file, spec)
      if (resolved && !seen.has(resolved)) stack.push(resolved)
    }
  }
  return files
}

function forbiddenIssues(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8')
  const issues: string[] = []
  if (/process\.on\(/.test(source)) issues.push('process.on(')
  if (/process\.once\(/.test(source)) issues.push('process.once(')
  if (/^setInterval\(/m.test(source)) issues.push('module-scope setInterval(')

  const importSpecs: string[] = []
  for (const line of source.split(/\r?\n/)) {
    const fromMatch = line.match(/^\s*(?:import|export)\s+.*from\s+['"]([^'"]+)['"]/)
    if (fromMatch) importSpecs.push(fromMatch[1])
    for (const match of Array.from(line.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g))) {
      importSpecs.push(match[1])
    }
  }
  const nodeModules = new Set(['fs', 'path', 'crypto', 'os', 'net', 'child_process'])
  for (const spec of importSpecs) {
    if (nodeModules.has(spec) || spec.startsWith('node:')) {
      issues.push(`forbidden module import: ${spec}`)
    }
  }
  if (/require\(/.test(source)) issues.push('require(')
  if (importSpecs.some((spec) => /(?:^|\/)logger['"]?$/.test(spec))) issues.push('imports logger')
  if (importSpecs.some((spec) => /(?:^|\/)prisma['"]?$/.test(spec))) issues.push('imports prisma')
  if (importSpecs.some((spec) => /(?:^|\/)rate-limit['"]?$/.test(spec))) issues.push('imports lib/rate-limit')

  return issues
}

describe('middleware edge safety', () => {
  it('has an Edge-safe transitive import graph', () => {
    const start = path.join(ROOT, 'middleware.ts')
    const files = walkImports(start)
    const violations = files
      .map((file) => ({ file: path.relative(ROOT, file), issues: forbiddenIssues(file) }))
      .filter((entry) => entry.issues.length > 0)
    expect(violations).toEqual([])
  })
})
