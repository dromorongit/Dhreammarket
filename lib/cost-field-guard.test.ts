// The guard that keeps the vendor's money fields out of the browser.
//
// FOUR FIELDS ARE SECRETS
// -----------------------
//   * Product.costPrice        - what the vendor paid for the stock
//   * ProductVariant.costPrice - the same, per variant
//   * OrderItem.costPriceSnapshot - what the line cost when it was sold
//   * Order.deliveryCost       - what the vendor paid the rider
//
// A Prisma `include: { relation: true }` returns EVERY column of the
// included row, and a read with no `select` at all returns every column of
// the row itself. Both ship the four fields to whoever reads the response.
//
// WHAT THIS TEST DOES
// -------------------
// 1. It scans app/, lib/ and components/ for the four names and fails when
//    one of them turns up in a file that is not on the allowlist.
// 2. It scans app/ and lib/ for a bare `include: { relation: true }` of a
//    relation that carries a cost field, and fails when the query has no
//    sibling `select`.
// 3. It scans app/ and lib/ for a read of a cost bearing model that selects
//    no field at all, because such a read returns every column of the row.
//
// HOW TO ADD AN ENTRY
// -------------------
// The allowlist lives in ONE file: lib/cost-field-allowlist.ts. Add the
// path of the file there, with a reason that says why the file is allowed
// to see the field, and the guard picks it up. There is no second list to
// update and no marker to put in the file itself.
//
// The file has one list per kind of permission:
//   * COST_FIELD_ALLOWLIST       - the file may NAME the fields.
//   * RELATION_INCLUDE_ALLOWLIST  - the file may load a whole relation.
//   * COST_MODEL_READ_ALLOWLIST  - the file may read a cost bearing model
//     without selecting its fields.
//
// Rules for a new entry:
//   * A vendor is entitled to the cost of their own stock. A buyer is
//     entitled to the price they pay. Never allowlist a file a buyer can
//     reach.
//   * A file that serves both (a public GET and a vendor-only PUT) may be
//     allowed to name the fields, but the reason must say so, because the
//     public half of that file is still watched by the runtime leak test
//     (app/api/cost-field-leaks.test.ts).
//   * A test may always name the fields: naming them is how a test asserts
//     that they do not travel.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  COST_FIELD_ALLOWLIST,
  COST_MODEL_READ_ALLOWLIST,
  RELATION_INCLUDE_ALLOWLIST,
} from '@/lib/cost-field-allowlist'
import {
  FORBIDDEN_PUBLIC_FIELDS,
  PUBLIC_ORDER_ITEM_SELECT,
  PUBLIC_ORDER_SELECT,
  PUBLIC_PRODUCT_SELECT,
  PUBLIC_VARIANT_SELECT,
  VENDOR_ORDER_ITEM_SELECT,
} from '@/lib/public-selects'

const REPO_ROOT = path.resolve(__dirname, '..')

/** The roots the guard reads. */
const SCANNED_ROOTS = ['app', 'lib', 'components', 'pages']

/** The roots the second check reads. */
const INCLUDE_SCANNED_ROOTS = ['app', 'lib']

/** The names that must not reach a buyer. */
const FORBIDDEN_NAMES = ['costPrice', 'costPriceSnapshot', 'deliveryCost']

/**
 * The relations that carry one of the four fields.
 *
 * A bare `include` of one of them returns every column of the row, the cost
 * columns included.
 */
const COST_BEARING_RELATIONS = new Set([
  'variants',
  'product',
  'productVariant',
  'items',
  'order',
  'orders',
])

/**
 * The relations of a model that hold no cost field.
 *
 * `items` is the name of many relations and only one of them carries a cost:
 * the items of an ORDER are OrderItems and hold the cost snapshot of the
 * line, while the items of a CART are CartItems and the items of a
 * WISHLIST are WishlistItems. The relation is looked up in the model of the
 * query, so only the real one is reported.
 */
const SAFE_RELATIONS_BY_MODEL: Record<string, Set<string>> = {
  cart: new Set(['items']),
  wishlist: new Set(['items']),
  collection: new Set(['items']),
  purchaseOrder: new Set(['items']),
  restockOrder: new Set(['items']),
  flashDeal: new Set(['products']),
  homepageSection: new Set(['products']),
}

/**
 * The model of the query that holds the code at `codeIndex`.
 *
 * `null` when the model cannot be told, in which case every cost bearing
 * relation is reported.
 */
function enclosingModel(text: string, codeIndex: number): string | null {
  const callPattern =
    /\.(\w+)\.(findMany|findUnique|findFirst|findFirstOrThrow|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)\s*\(/g

  let match = callPattern.exec(text)
  let model: string | null = null

  while (match !== null) {
    if (match.index >= codeIndex) break
    model = match[1]
    match = callPattern.exec(text)
  }

  return model
}

/**
 * True when the relation of that model carries one of the four fields.
 */
function relationIsCostBearing(model: string | null, relation: string): boolean {
  if (model) {
    const safe = SAFE_RELATIONS_BY_MODEL[model]
    if (safe && safe.has(relation)) return false
  }

  return COST_BEARING_RELATIONS.has(relation)
}

/** A test file may name the fields on purpose. */
function isTestFile(relativePath: string): boolean {
  return (
    relativePath.endsWith('.test.ts') ||
    relativePath.endsWith('.test.tsx') ||
    relativePath.endsWith('.test-utils.ts') ||
    relativePath.includes('.test-utils.')
  )
}

function listSourceFiles(root: string): string[] {
  const absoluteRoot = path.join(REPO_ROOT, root)
  if (!fs.existsSync(absoluteRoot)) return []

  const found: string[] = []

  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        walk(absolute)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      found.push(path.relative(REPO_ROOT, absolute).split(path.sep).join('/'))
    }
  }

  walk(absoluteRoot)
  return found.sort()
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

/* -------------------------------------------------------------------------- */
/* Reading an object literal                                                  */
/* -------------------------------------------------------------------------- */

interface TopLevelEntry {
  key: string
  value: string
}

/**
 * The entries of the top level of an object literal.
 *
 * `objectText` includes the outer braces. Only the keys and the values of
 * the top level are returned: a nested object is one value.
 */
function topLevelEntries(objectText: string): TopLevelEntry[] {
  const entries: TopLevelEntry[] = []
  const inner = objectText.slice(1, -1)

  let depth = 0
  let index = 0

  while (index < inner.length) {
    const character = inner[index]

    if (character === '{' || character === '[' || character === '(') {
      depth += 1
      index += 1
      continue
    }

    if (character === '}' || character === ']' || character === ')') {
      depth -= 1
      index += 1
      continue
    }

    if (depth !== 0) {
      index += 1
      continue
    }

    if (character === ',') {
      index += 1
      continue
    }

    const keyMatch = /^\s*(?:['"])?([A-Za-z_$][\w$]*)(?:['"])?\s*:/.exec(inner.slice(index))
    if (!keyMatch) {
      index += 1
      continue
    }

    const key = keyMatch[1]
    let cursor = index + keyMatch[0].length
    let valueDepth = 0

    while (cursor < inner.length) {
      const valueCharacter = inner[cursor]

      if (valueCharacter === '{' || valueCharacter === '[' || valueCharacter === '(') {
        valueDepth += 1
      } else if (valueCharacter === '}' || valueCharacter === ']' || valueCharacter === ')') {
        if (valueDepth === 0) break
        valueDepth -= 1
      } else if (valueCharacter === ',' && valueDepth === 0) {
        break
      }

      cursor += 1
    }

    entries.push({ key, value: inner.slice(index + keyMatch[0].length, cursor).trim() })
    index = cursor
  }

  return entries
}

/** The index of the brace that closes the one at `openIndex`, or -1. */
function matchBrace(text: string, openIndex: number): number {
  let depth = 0

  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1
    else if (text[index] === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

/** The object literal that holds the code at `codeIndex`. */
function enclosingObject(text: string, codeIndex: number): { start: number; end: number } {
  let depth = 0

  for (let index = codeIndex; index >= 0; index -= 1) {
    const character = text[index]
    if (character === '}') depth += 1
    else if (character === '{') {
      if (depth === 0) {
        const end = matchBrace(text, index)
        return { start: index, end }
      }
      depth -= 1
    }
  }

  return { start: -1, end: -1 }
}

/**
 * True when the object holds a `select` of its own.
 *
 * A Prisma query may not use `select` and `include` at the same level, so a
 * query that has a sibling `select` is broken code rather than a leak.
 */
function hasOwnSelect(objectText: string): boolean {
  return topLevelEntries(objectText).some((entry) => entry.key === 'select')
}

/**
 * True when the object loads a whole relation.
 *
 * A relation is loaded whole when its value is `true`, or when it is an
 * object that holds an `include` without a sibling `select`: in both cases
 * every column of the row comes back.
 */
function loadsWholeRelation(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (!trimmed.startsWith('{')) return false

  const includePattern = /\binclude\s*:/g
  let match = includePattern.exec(trimmed)

  while (match !== null) {
    const includeIndex = match.index
    const after = trimmed.slice(includeIndex + match[0].length)
    const braceOffset = after.indexOf('{')
    if (braceOffset !== -1) {
      const braceIndex = includeIndex + match[0].length + braceOffset
      const braceEnd = matchBrace(trimmed, braceIndex)
      if (braceEnd !== -1) {
        const enclosing = enclosingObject(trimmed, includeIndex)
        if (enclosing.start === -1) return true
        const objectText = trimmed.slice(enclosing.start, enclosing.end + 1)
        if (!hasOwnSelect(objectText)) return true
      }
    }

    match = includePattern.exec(trimmed)
  }

  return false
}

interface IncludeViolation {
  relation: string
  line: number
}

/**
 * The names of the four fields that turn up in the text.
 */
function findForbiddenNames(source: string): string[] {
  return FORBIDDEN_NAMES.filter((name) => source.includes(name))
}

/**
 * The relations of the file that are loaded whole without a sibling select.
 */
function findWholeRelationIncludes(text: string): IncludeViolation[] {
  const violations: IncludeViolation[] = []
  const includePattern = /\binclude\s*:/g

  let match = includePattern.exec(text)

  while (match !== null) {
    const includeIndex = match.index
    const after = text.slice(includeIndex + match[0].length)
    const braceOffset = after.indexOf('{')

    if (braceOffset !== -1) {
      const braceIndex = includeIndex + match[0].length + braceOffset
      const braceEnd = matchBrace(text, braceIndex)

      if (braceEnd !== -1) {
        const enclosing = enclosingObject(text, includeIndex)

        if (enclosing.start !== -1) {
          const objectText = text.slice(enclosing.start, enclosing.end + 1)

          if (!hasOwnSelect(objectText)) {
            const blockText = text.slice(braceIndex, braceEnd + 1)
            const model = enclosingModel(text, includeIndex)

            for (const entry of topLevelEntries(blockText)) {
              if (!relationIsCostBearing(model, entry.key)) continue
              if (!loadsWholeRelation(entry.value)) continue

              violations.push({
                relation: entry.key,
                line: text.slice(0, includeIndex).split('\n').length,
              })
            }
          }
        }
      }
    }

    match = includePattern.exec(text)
  }

  return violations
}

/**
 * The models whose rows carry one of the four fields.
 *
 * A read of one of them without a `select` returns every column of the row,
 * the cost columns included.
 */
const COST_BEARING_MODELS = new Set(['product', 'productVariant', 'order', 'orderItem'])

/**
 * The reads that return a row.
 *
 * A count and an aggregate return a number, never a row.
 */
const ROW_READS = new Set([
  'findMany',
  'findUnique',
  'findFirst',
  'findFirstOrThrow',
  'findUniqueOrThrow',
])

interface ReadViolation {
  model: string
  line: number
}

/**
 * The reads of a cost bearing model that do not select its fields.
 */
function findUnselectedCostModelReads(text: string): ReadViolation[] {
  const violations: ReadViolation[] = []
  const callPattern = /\.(\w+)\.(\w+)\s*\(/g

  let match = callPattern.exec(text)

  while (match !== null) {
    const model = match[1]
    const read = match[2]

    if (COST_BEARING_MODELS.has(model) && ROW_READS.has(read)) {
      const braceIndex = text.indexOf('{', match.index + match[0].length)

      if (braceIndex !== -1) {
        const braceEnd = matchBrace(text, braceIndex)

        if (braceEnd !== -1) {
          const args = text.slice(braceIndex, braceEnd + 1)

          if (!hasOwnSelect(args)) {
            violations.push({
              model,
              line: text.slice(0, match.index).split('\n').length,
            })
          }
        }
      }
    }

    match = callPattern.exec(text)
  }

  return violations
}

describe('the cost field guard', () => {
  const costFieldAllowlist = new Map(COST_FIELD_ALLOWLIST.map((entry) => [entry.path, entry.reason]))
  const relationAllowlist = new Map(RELATION_INCLUDE_ALLOWLIST.map((entry) => [entry.path, entry.reason]))
  const costModelReadAllowlist = new Map(
    COST_MODEL_READ_ALLOWLIST.map((entry) => [entry.path, entry.reason]),
  )

  it('names no cost field outside the allowlist', () => {
    const offences: string[] = []

    for (const root of SCANNED_ROOTS) {
      for (const relativePath of listSourceFiles(root)) {
        if (isTestFile(relativePath)) continue
        if (costFieldAllowlist.has(relativePath)) continue

        const source = read(relativePath)
        for (const name of findForbiddenNames(source)) {
          const line = source.split('\n').findIndex((text) => text.includes(name)) + 1
          offences.push(`${relativePath}:${line} names ${name}`)
        }
      }
    }

    expect(offences).toEqual([])
  })

  it('loads no cost bearing relation whole outside the allowlist', () => {
    const offences: string[] = []

    for (const root of INCLUDE_SCANNED_ROOTS) {
      for (const relativePath of listSourceFiles(root)) {
        if (isTestFile(relativePath)) continue
        if (relationAllowlist.has(relativePath)) continue

        const source = read(relativePath)
        for (const violation of findWholeRelationIncludes(source)) {
          offences.push(`${relativePath}:${violation.line} loads ${violation.relation} whole`)
        }
      }
    }

    expect(offences).toEqual([])
  })

  it('reads no cost bearing model without selecting its fields', () => {
    const offences: string[] = []

    for (const root of INCLUDE_SCANNED_ROOTS) {
      for (const relativePath of listSourceFiles(root)) {
        if (isTestFile(relativePath)) continue
        if (costModelReadAllowlist.has(relativePath)) continue

        const source = read(relativePath)
        for (const violation of findUnselectedCostModelReads(source)) {
          offences.push(`${relativePath}:${violation.line} reads ${violation.model} whole`)
        }
      }
    }

    expect(offences).toEqual([])
  })

  it('has a reason for every entry of the allowlist', () => {
    for (const entry of [
      ...COST_FIELD_ALLOWLIST,
      ...RELATION_INCLUDE_ALLOWLIST,
      ...COST_MODEL_READ_ALLOWLIST,
    ]) {
      expect(entry.reason.trim().length).toBeGreaterThan(20)
      expect(entry.path.trim().length).toBeGreaterThan(0)
    }
  })

  it('points every entry of the allowlist at a file that exists', () => {
    const missing: string[] = []

    for (const entry of [
      ...COST_FIELD_ALLOWLIST,
      ...RELATION_INCLUDE_ALLOWLIST,
      ...COST_MODEL_READ_ALLOWLIST,
    ]) {
      if (!fs.existsSync(path.join(REPO_ROOT, entry.path))) {
        missing.push(entry.path)
      }
    }

    expect(missing).toEqual([])
  })

  it('keeps the public selects free of the cost fields', () => {
    const publicSelects: Record<string, Record<string, unknown>> = {
      PUBLIC_PRODUCT_SELECT: PUBLIC_PRODUCT_SELECT as Record<string, unknown>,
      PUBLIC_VARIANT_SELECT: PUBLIC_VARIANT_SELECT as Record<string, unknown>,
      PUBLIC_ORDER_SELECT: PUBLIC_ORDER_SELECT as Record<string, unknown>,
      PUBLIC_ORDER_ITEM_SELECT: PUBLIC_ORDER_ITEM_SELECT as Record<string, unknown>,
    }

    for (const [name, select] of Object.entries(publicSelects)) {
      for (const forbidden of FORBIDDEN_PUBLIC_FIELDS) {
        expect(Object.keys(select), `${name} must not select ${forbidden}`).not.toContain(forbidden)
      }
    }

    // The vendor's own line keeps its cost snapshot, and nothing else does.
    expect(Object.keys(VENDOR_ORDER_ITEM_SELECT)).toContain('costPriceSnapshot')
  })

  it('lists the four fields in the negative list of the public selects', () => {
    expect([...FORBIDDEN_PUBLIC_FIELDS].sort()).toEqual(
      ['costPrice', 'costPriceSnapshot', 'deliveryCost'].sort(),
    )
  })
})

describe('the scanner of the cost field guard', () => {
  it('finds a cost field in a piece of text', () => {
    expect(findForbiddenNames('const price = product.costPrice')).toEqual(['costPrice'])
    expect(findForbiddenNames('const total = order.deliveryCost')).toEqual(['deliveryCost'])
    expect(findForbiddenNames('const snapshot = item.costPriceSnapshot')).toEqual([
      'costPrice',
      'costPriceSnapshot',
    ])
    expect(findForbiddenNames('const price = product.price')).toEqual([])
  })

  it('reports a bare include of a cost bearing relation', () => {
    const source = `
      const product = await getPrisma().product.findUnique({
        where: { id },
        include: { variants: true },
      })
    `
    expect(findWholeRelationIncludes(source).map((violation) => violation.relation)).toEqual([
      'variants',
    ])
  })

  it('reports a nested include that loads a whole relation', () => {
    const source = `
      const order = await getPrisma().order.findFirst({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
        },
      })
    `
    expect(findWholeRelationIncludes(source).map((violation) => violation.relation).sort()).toEqual([
      'items',
      'product',
    ])
  })

  it('accepts a relation that is selected field by field', () => {
    const source = `
      const product = await getPrisma().product.findUnique({
        where: { id },
        include: { variants: { select: { id: true, price: true } } },
      })
    `
    expect(findWholeRelationIncludes(source)).toEqual([])
  })

  it('accepts a relation of a model that holds no cost', () => {
    const source = `
      const cart = await getPrisma().cart.findUnique({
        where: { userId },
        include: { items: { include: { product: { select: { id: true } } } } },
      })
    `
    expect(findWholeRelationIncludes(source)).toEqual([])
  })

  it('reports a bare include of the lines of an order', () => {
    const source = `
      const order = await getPrisma().order.findFirst({
        where: { id },
        include: { items: true },
      })
    `
    expect(findWholeRelationIncludes(source).map((violation) => violation.relation)).toEqual([
      'items',
    ])
  })

  it('reports a read of a cost bearing model without a select', () => {
    const source = `
      const order = await getPrisma().order.findFirst({
        where: { id },
      })
    `
    expect(findUnselectedCostModelReads(source).map((violation) => violation.model)).toEqual([
      'order',
    ])
  })

  it('accepts a read of a cost bearing model that selects its fields', () => {
    const source = `
      const order = await getPrisma().order.findFirst({
        where: { id },
        select: { id: true, status: true },
      })
    `
    expect(findUnselectedCostModelReads(source)).toEqual([])
  })

  it('accepts a read of a model that holds no cost', () => {
    const source = `
      const store = await getPrisma().store.findFirst({
        where: { id },
      })
    `
    expect(findUnselectedCostModelReads(source)).toEqual([])
  })
})
