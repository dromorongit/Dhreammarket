import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'prisma', 'migrations');

function hasPrefix(buffer, prefix) {
  if (buffer.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (buffer[i] !== prefix[i]) return false;
  }
  return true;
}

function detectBom(buffer) {
  if (hasPrefix(buffer, [0xef, 0xbb, 0xbf])) return 'UTF-8 BOM';
  if (hasPrefix(buffer, [0xff, 0xfe, 0x00, 0x00])) return 'UTF-32LE BOM';
  if (hasPrefix(buffer, [0x00, 0x00, 0xfe, 0xff])) return 'UTF-32BE BOM';
  if (hasPrefix(buffer, [0xff, 0xfe])) return 'UTF-16LE BOM';
  if (hasPrefix(buffer, [0xfe, 0xff])) return 'UTF-16BE BOM';
  return null;
}

function checkFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const problems = [];

  const bom = detectBom(buffer);
  if (bom) {
    problems.push(`${bom} at byte offset 0`);
  }

  const nulIndex = buffer.indexOf(0);
  if (nulIndex !== -1) {
    problems.push(`NUL byte at byte offset ${nulIndex}`);
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    problems.push(`Invalid UTF-8: ${message}`);
  }

  return problems;
}

if (!fs.existsSync(migrationsDir)) {
  console.error(`Migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

const failures = [];
let checked = 0;

for (const dir of dirs) {
  const file = path.join(migrationsDir, dir, 'migration.sql');
  if (!fs.existsSync(file)) continue;
  checked += 1;
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const problems = checkFile(file);
  for (const problem of problems) {
    failures.push(`${rel}: ${problem}`);
  }
}

if (failures.length > 0) {
  console.error('Migration encoding check failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`Migration encoding check passed (${checked} migration file(s) checked).`);
