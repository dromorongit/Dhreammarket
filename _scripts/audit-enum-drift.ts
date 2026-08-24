import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
require('dotenv').config({ path: '.env' })

interface EnumField {
  model: string
  field: string
  table: string
  column: string
  enumType: string
}

function parseSchema(): { enumNames: Set<string>; enumFields: EnumField[] } {
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
  const lines = fs.readFileSync(schemaPath, 'utf-8').split('\n')

  const enumNames = new Set<string>()
  const enumFields: EnumField[] = []

  // Pass 1: collect all enum type names (enums are declared after models in this schema)
  for (const raw of lines) {
    const enumMatch = raw.trim().match(/^enum\s+(\w+)\s*\{/)
    if (enumMatch) enumNames.add(enumMatch[1])
  }

  // Pass 2: build model -> mapped table name (@@map appears after fields,
  // so resolve it in a first sub-pass before capturing fields)
  const modelToTable = new Map<string, string>()
  let currentModel: string | null = null
  for (const raw of lines) {
    const line = raw.trim()
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/)
    if (modelMatch) {
      currentModel = modelMatch[1]
      continue
    }
    if (line === '}') {
      currentModel = null
      continue
    }
    if (!currentModel) continue
    const mapMatch = line.match(/^@@map\("([^"]+)"\)/)
    if (mapMatch) modelToTable.set(currentModel, mapMatch[1])
  }

  // Pass 3: walk models and capture enum-typed fields
  currentModel = null
  for (const raw of lines) {
    const line = raw.trim()
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/)
    if (modelMatch) {
      currentModel = modelMatch[1]
      continue
    }
    if (line === '}') {
      currentModel = null
      continue
    }
    if (!currentModel) continue

    const fieldMatch = line.match(/^(\w+)\s+(\w+)/)
    if (fieldMatch) {
      const fieldName = fieldMatch[1]
      const fieldType = fieldMatch[2]
      if (enumNames.has(fieldType)) {
        const colMap = line.match(/@map\("([^"]+)"\)/)
        const column = colMap ? colMap[1] : fieldName
        enumFields.push({
          model: currentModel,
          field: fieldName,
          table: modelToTable.get(currentModel) || currentModel,
          column,
          enumType: fieldType,
        })
      }
    }
  }

  return { enumNames, enumFields }
}

async function auditEnumDrift() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const { enumNames, enumFields } = parseSchema()

    console.log('=== Enum-typed fields declared in schema.prisma ===')
    console.log(`Enums defined (${enumNames.size}): ${[...enumNames].join(', ')}`)
    console.log(`Enum-typed fields found: ${enumFields.length}\n`)

    // Cross-reference: what enum types actually exist in the live DB?
    const liveEnumTypes = await pool.query(
      `SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname`
    )
    const liveEnumSet = new Set(liveEnumTypes.rows.map((r: any) => r.typname))
    console.log('=== Enum types present in live DB ===')
    console.log(`${liveEnumTypes.rows.length ? liveEnumTypes.rows.map((r: any) => r.typname).join(', ') : '(none)'}\n`)

    console.log('=== Per-field audit: schema.prisma enum vs live DB column ===\n')
    const rows: any[] = []
    let mismatchCount = 0
    let missingCount = 0

    for (const ef of enumFields) {
      const res = await pool.query(
        `SELECT data_type, udt_name, is_nullable
         FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`,
        [ef.table, ef.column]
      )

      if (res.rows.length === 0) {
        missingCount++
        rows.push({
          model: ef.model,
          field: ef.field,
          table: ef.table,
          column: ef.column,
          schemaEnum: ef.enumType,
          dbDataType: '(MISSING COLUMN)',
          dbUdtName: '-',
          status: 'MISSING',
        })
        continue
      }

      const { data_type, udt_name } = res.rows[0]
      let status: string
      if (data_type === 'USER-DEFINED' && udt_name === ef.enumType) {
        status = 'MATCH'
      } else if (data_type === 'USER-DEFINED' && udt_name !== ef.enumType) {
        status = `MISMATCH (db type ${udt_name} != ${ef.enumType})`
        mismatchCount++
      } else {
        // The exact senderType-bug pattern: enum declared but column is text/varchar
        status = `DRIFT (expected enum ${ef.enumType}, got ${data_type}/${udt_name})`
        mismatchCount++
      }

      rows.push({
        model: ef.model,
        field: ef.field,
        table: ef.table,
        column: ef.column,
        schemaEnum: ef.enumType,
        dbDataType: data_type,
        dbUdtName: udt_name,
        status,
      })
    }

    console.table(rows)

    console.log('\n=== SUMMARY ===')
    console.log(`Total enum-typed fields audited: ${enumFields.length}`)
    console.log(`Matches: ${enumFields.length - mismatchCount - missingCount}`)
    console.log(`Drift / mismatches (the senderType pattern): ${mismatchCount}`)
    console.log(`Missing columns: ${missingCount}`)

    if (mismatchCount === 0 && missingCount === 0) {
      console.log('\n✅ No enum-type drift detected beyond the already-fixed senderType column.')
    } else {
      console.log('\n⚠️  Drift detected — flag the mismatched fields as a separate follow-up fix (do not bundle here).')
    }
  } catch (error) {
    console.error('Error running enum drift audit:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

auditEnumDrift()
