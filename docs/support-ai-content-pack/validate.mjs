#!/usr/bin/env node
// Dependency-free validator for the Support AI content pack.
// Built-ins only. Run: node docs/support-ai-content-pack/validate.mjs
// Exits 0 when everything passes, 1 on any failure.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const PACK_FILE = path.join(HERE, 'pack.json')
const GAPS_FILE = path.join(HERE, 'gaps.json')

const errors = []
const warnings = []
const checks = []

function check(name, fn) {
  try {
    const detail = fn()
    checks.push({ name, ok: true, detail })
  } catch (err) {
    checks.push({ name, ok: false, detail: err.message })
    errors.push(`${name}: ${err.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// ---------------------------------------------------------------- rules

const ALLOWED_INTENTS = new Set([
  'general.greeting',
  'general.about_platform',
  'buyer.how_to_order',
  'buyer.track_order_info',
  'buyer.payment_methods_info',
  'buyer.delivery_info',
  'buyer.returns_policy_info',
  'buyer.cancellation_info',
  'vendor.onboarding_guide',
  'vendor.listing_guide',
  'vendor.store_management_guide',
  'vendor.fees_plans_info',
  'vendor.payout_info_general',
  'vendor.kyc_info_general',
  'agent.procedure_lookup',
  'account.help_general',
])

const ALLOWED_FLAGS = new Set([
  'CONTAINS_COMMITMENT',
  'CONFLICT',
  'NEEDS_OWNER_DECISION',
  'PERSONAL_DATA_RELATED',
  'LEGAL_TEXT',
  'STALE_RISK',
])

const ALLOWED_AUDIENCE = new Set(['visitor', 'buyer', 'vendor', 'support_agent'])

const ALLOWED_GAP_KINDS = new Set(['policy-gap', 'code-derived-needs-approval', 'needs-owner-decision'])

const REQUIRED_DOC_FIELDS = [
  'id', 'topicKey', 'title', 'question', 'audience', 'locale', 'status', 'version',
  'body', 'sourceRefs', 'overlapsWith', 'intentHints', 'flags', 'contentHash',
  'effectiveFrom', 'reviewBy', 'owner', 'approvedBy', 'approvedAt',
]

const REQUIRED_GAP_FIELDS = ['id', 'topic', 'whyItMatters', 'dependsOnIntents', 'whereItShouldAppear', 'evidence', 'kind']

// the one document that is allowed to contain an email address or a phone number
const CONTACT_TOPIC_KEY = 'contact.support-channels'

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE_RE = /\+\d[\d\s().-]{6,}\d/

function wordCount(body) {
  const cleaned = body
    .split('\n')
    .map((l) => l.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, ''))
    .join('\n')
    .trim()
  if (!cleaned) return 0
  return cleaned.split(/\s+/).length
}

function contentHash(body) {
  return crypto.createHash('sha256').update(body.trim().replace(/\s+/g, ' ')).digest('hex')
}

// ---------------------------------------------------------------- load

let pack
let gaps

check('pack.json and gaps.json are readable JSON', () => {
  assert(fs.existsSync(PACK_FILE), 'pack.json not found')
  assert(fs.existsSync(GAPS_FILE), 'gaps.json not found')
  pack = JSON.parse(fs.readFileSync(PACK_FILE, 'utf8'))
  gaps = JSON.parse(fs.readFileSync(GAPS_FILE, 'utf8'))
  return `${pack.documents.length} documents, ${gaps.length} gaps`
})

if (!pack) {
  console.error('FATAL: pack.json could not be read, stopping.')
  process.exit(1)
}

const documents = Array.isArray(pack.documents) ? pack.documents : []

// legacy knowledge-base intent ids, read from the repo so the allow-list stays honest
let legacyIntents = new Set()
const kbFile = path.join(ROOT, 'lib/support-ai/knowledge-base.ts')
if (fs.existsSync(kbFile)) {
  const kb = fs.readFileSync(kbFile, 'utf8')
  const re = /id:\s*'([a-z0-9-]+)'/g
  let m
  while ((m = re.exec(kb)) !== null) legacyIntents.add(m[1])
}

// ---------------------------------------------------------------- checks

check('meta block is complete and consistent', () => {
  const meta = pack.meta || {}
  for (const field of ['generatedAt', 'baseBranch', 'baseCommit', 'documentCount', 'schemaVersion']) {
    assert(field in meta, `meta.${field} is missing`)
  }
  assert(meta.schemaVersion === 1, `meta.schemaVersion must be 1, got ${meta.schemaVersion}`)
  assert(meta.documentCount === documents.length,
    `meta.documentCount ${meta.documentCount} does not match ${documents.length} documents`)
  assert(typeof meta.baseCommit === 'string' && /^[0-9a-f]{7,40}$/.test(meta.baseCommit),
    'meta.baseCommit must be a commit hash')
  return `${meta.baseBranch} @ ${meta.baseCommit}`
})

check('every document has exactly the required fields', () => {
  for (const d of documents) {
    const keys = Object.keys(d).sort()
    const expected = [...REQUIRED_DOC_FIELDS].sort()
    assert(keys.length === expected.length && keys.every((k, i) => k === expected[i]),
      `${d.id}: field set is [${keys.join(', ')}], expected [${expected.join(', ')}]`)
  }
  return `${documents.length} documents`
})

check('status, locale, version and approval fields', () => {
  for (const d of documents) {
    assert(d.status === 'draft', `${d.id}: status must be 'draft', got '${d.status}'`)
    assert(d.locale === 'en', `${d.id}: locale must be 'en', got '${d.locale}'`)
    assert(d.version === 1, `${d.id}: version must be 1, got ${d.version}`)
    assert(d.approvedBy === null, `${d.id}: approvedBy must be null`)
    assert(d.approvedAt === null, `${d.id}: approvedAt must be null`)
    assert(d.effectiveFrom === null, `${d.id}: effectiveFrom must be null`)
    assert(d.reviewBy === null, `${d.id}: reviewBy must be null`)
    assert(d.owner === null, `${d.id}: owner must be null`)
    assert(typeof d.title === 'string' && d.title.trim().length > 0, `${d.id}: title must be a non-empty string`)
    assert(d.question === null || typeof d.question === 'string', `${d.id}: question must be a string or null`)
    assert(typeof d.body === 'string' && d.body.trim().length > 0, `${d.id}: body must be a non-empty string`)
  }
  return 'all documents are draft, locale en, version 1, unapproved'
})

check('ids and topicKeys are unique', () => {
  const ids = new Set()
  const topics = new Set()
  for (const d of documents) {
    assert(/^DOC-\d{4}$/.test(d.id), `${d.id}: id must look like DOC-0001`)
    assert(!ids.has(d.id), `${d.id}: duplicate id`)
    ids.add(d.id)
    assert(typeof d.topicKey === 'string' && /^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(d.topicKey),
      `${d.id}: topicKey '${d.topicKey}' must be a dotted lower-case key`)
    assert(!topics.has(d.topicKey), `${d.id}: duplicate topicKey '${d.topicKey}'`)
    topics.add(d.topicKey)
  }
  return `${ids.size} ids, ${topics.size} topicKeys`
})

check('audience, intentHints and flags use allowed values', () => {
  for (const d of documents) {
    assert(Array.isArray(d.audience) && d.audience.length > 0, `${d.id}: audience must be a non-empty array`)
    for (const a of d.audience) {
      assert(ALLOWED_AUDIENCE.has(a), `${d.id}: audience '${a}' is not allowed`)
    }
    assert(Array.isArray(d.intentHints), `${d.id}: intentHints must be an array`)
    for (const i of d.intentHints) {
      assert(ALLOWED_INTENTS.has(i), `${d.id}: intentHint '${i}' is not in the v2 intent list`)
    }
    assert(Array.isArray(d.flags), `${d.id}: flags must be an array`)
    for (const f of d.flags) {
      assert(ALLOWED_FLAGS.has(f), `${d.id}: flag '${f}' is not allowed`)
    }
  }
  return 'all values allowed'
})

check('contentHash matches the body', () => {
  for (const d of documents) {
    const expected = contentHash(d.body)
    assert(d.contentHash === expected,
      `${d.id}: contentHash ${d.contentHash} does not match recomputed ${expected}`)
  }
  return `${documents.length} hashes verified`
})

check('body length is between 20 and 600 words', () => {
  for (const d of documents) {
    const words = wordCount(d.body)
    assert(words >= 20, `${d.id}: body is ${words} words, minimum is 20`)
    assert(words <= 600, `${d.id}: body is ${words} words, maximum is 600`)
  }
  return 'all bodies within 20..600 words'
})

check('no email address or phone number outside the contact document', () => {
  const contacts = documents.filter((d) => d.topicKey === CONTACT_TOPIC_KEY)
  assert(contacts.length === 1, `expected exactly one contact document, found ${contacts.length}`)
  for (const d of documents) {
    if (d.topicKey === CONTACT_TOPIC_KEY) continue
    assert(!EMAIL_RE.test(d.body), `${d.id}: body contains an email address`)
    assert(!PHONE_RE.test(d.body), `${d.id}: body contains a phone number`)
  }
  return 'contact.support-channels is the only document with contact details'
})

check('every document has sourceRefs that point at real files and plausible lines', () => {
  for (const d of documents) {
    assert(Array.isArray(d.sourceRefs) && d.sourceRefs.length > 0, `${d.id}: sourceRefs must be a non-empty array`)
    for (const ref of d.sourceRefs) {
      for (const field of ['file', 'lineStart', 'lineEnd']) {
        assert(field in ref, `${d.id}: sourceRef is missing ${field}`)
      }
      assert(typeof ref.file === 'string' && ref.file.length > 0, `${d.id}: sourceRef.file must be a string`)
      const abs = path.join(ROOT, ref.file)
      assert(fs.existsSync(abs), `${d.id}: source file does not exist: ${ref.file}`)
      assert(Number.isInteger(ref.lineStart) && ref.lineStart >= 1, `${d.id}: ${ref.file} lineStart must be a positive integer`)
      assert(Number.isInteger(ref.lineEnd) && ref.lineEnd >= ref.lineStart,
        `${d.id}: ${ref.file} lineEnd must be >= lineStart`)
      const lineCount = fs.readFileSync(abs, 'utf8').split('\n').length
      assert(ref.lineEnd <= lineCount,
        `${d.id}: ${ref.file} lineEnd ${ref.lineEnd} is past the end of the file (${lineCount} lines)`)
    }
  }
  return 'all sourceRefs resolve'
})

check('overlapsWith points at existing documents or legacy knowledge-base intents', () => {
  const ids = new Set(documents.map((d) => d.id))
  for (const d of documents) {
    assert(Array.isArray(d.overlapsWith), `${d.id}: overlapsWith must be an array`)
    for (const o of d.overlapsWith) {
      if (ids.has(o)) continue
      if (legacyIntents.has(o)) continue
      assert(!/^DOC-\d{4}$/.test(o), `${d.id}: overlapsWith references unknown document id '${o}'`)
      warnings.push(`${d.id}: overlapsWith '${o}' is not a known legacy intent id`)
    }
  }
  return `${legacyIntents.size} legacy intents known`
})

check('no document states a cancellation rule', () => {
  for (const d of documents) {
    assert(!/\bcancel/i.test(d.body), `${d.id}: body mentions cancellation`)
    assert(!/before shipment/i.test(d.body), `${d.id}: body mentions cancelling before shipment`)
  }
  return 'no cancellation rule published'
})

check('every gap has all required fields', () => {
  assert(Array.isArray(gaps), 'gaps.json must be an array')
  const ids = new Set()
  for (const g of gaps) {
    for (const field of REQUIRED_GAP_FIELDS) {
      assert(field in g, `${g.id || '(no id)'}: gap is missing '${field}'`)
    }
    assert(typeof g.id === 'string' && /^GAP-\d{3}$/.test(g.id), `gap id '${g.id}' must look like GAP-001`)
    assert(!ids.has(g.id), `duplicate gap id ${g.id}`)
    ids.add(g.id)
    assert(typeof g.topic === 'string' && g.topic.trim().length > 0, `${g.id}: topic must be a non-empty string`)
    assert(typeof g.whyItMatters === 'string' && g.whyItMatters.trim().length > 0, `${g.id}: whyItMatters must be a non-empty string`)
    assert(typeof g.whereItShouldAppear === 'string' && g.whereItShouldAppear.trim().length > 0,
      `${g.id}: whereItShouldAppear must be a non-empty string`)
    assert(ALLOWED_GAP_KINDS.has(g.kind), `${g.id}: kind '${g.kind}' is not allowed`)
    assert(Array.isArray(g.dependsOnIntents) && g.dependsOnIntents.length > 0, `${g.id}: dependsOnIntents must be a non-empty array`)
    for (const i of g.dependsOnIntents) {
      assert(ALLOWED_INTENTS.has(i), `${g.id}: dependsOnIntents '${i}' is not in the v2 intent list`)
    }
    assert(Array.isArray(g.evidence) && g.evidence.length > 0, `${g.id}: evidence must be a non-empty array`)
    for (const e of g.evidence) {
      assert(typeof e === 'string' && e.trim().length > 0, `${g.id}: evidence entries must be non-empty strings`)
    }
  }
  return `${gaps.length} gaps`
})

check('gap evidence points at real files and lines', () => {
  const refRe = /([A-Za-z0-9_.\/\[\]-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?/g
  for (const g of gaps) {
    for (const e of g.evidence) {
      refRe.lastIndex = 0
      let m
      while ((m = refRe.exec(e)) !== null) {
        const file = m[1]
        const abs = path.join(ROOT, file)
        assert(fs.existsSync(abs), `${g.id}: evidence file does not exist: ${file}`)
        const lineCount = fs.readFileSync(abs, 'utf8').split('\n').length
        const start = Number(m[2])
        const end = m[3] ? Number(m[3]) : start
        assert(start >= 1 && end >= start && end <= lineCount,
          `${g.id}: evidence ${file}:${m[2]}${m[3] ? '-' + m[3] : ''} is out of range (file has ${lineCount} lines)`)
      }
    }
  }
  return 'evidence lines checked'
})

// ---------------------------------------------------------------- output

const pad = (s, n) => String(s).padEnd(n)
console.log('Support AI content pack validation')
console.log('='.repeat(72))
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${pad(c.name, 62)} ${c.detail || ''}`)
}
if (warnings.length) {
  console.log('-'.repeat(72))
  for (const w of warnings) console.log('WARN  ' + w)
}
console.log('='.repeat(72))
if (errors.length) {
  console.log(`FAILED: ${errors.length} error(s)`)
  for (const e of errors) console.log('  - ' + e)
  process.exit(1)
}
console.log(`OK: ${documents.length} documents, ${gaps.length} gaps, ${checks.length} checks passed`)
process.exit(0)
