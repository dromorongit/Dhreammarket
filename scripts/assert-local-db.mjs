#!/usr/bin/env node
// Guard for every local database command.
//
// A DATABASE_URL is only accepted when it points at the local development
// database that docker-compose.dev.yml creates:
//   host     -> localhost | 127.0.0.1 | ::1
//   port     -> 5433
//   database -> dhream_dev
//
// The URL is never printed. Not on success, not on failure, not partially:
// the error messages only name the check that failed. That keeps production
// credentials and host names out of CI logs and terminal scrollback.
//
// Usage:
//   node scripts/assert-local-db.mjs "<DATABASE_URL>"
//   DATABASE_URL="<...>" node scripts/assert-local-db.mjs

import { pathToFileURL } from 'node:url';

const ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];
const REQUIRED_PORT = '5433';
const REQUIRED_DATABASE = 'dhream_dev';

export class LocalDatabaseGuardError extends Error {
  constructor(check) {
    super(`refusing to run: the target is not the local development database (${check})`);
    this.name = 'LocalDatabaseGuardError';
    this.check = check;
  }
}

function parseUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new LocalDatabaseGuardError('no DATABASE_URL was provided');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new LocalDatabaseGuardError('the DATABASE_URL could not be parsed');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new LocalDatabaseGuardError('the DATABASE_URL is not a PostgreSQL URL');
  }

  return parsed;
}

/**
 * Throws LocalDatabaseGuardError unless the URL points at the local dev database.
 * Returns true when the URL is acceptable.
 */
export function assertLocalDatabaseUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);

  // Node keeps the brackets around IPv6 literals: [::1] -> ::1
  const host = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!ALLOWED_HOSTS.includes(host)) {
    throw new LocalDatabaseGuardError('the host must be localhost, 127.0.0.1 or ::1');
  }

  // An empty port means the protocol default (5432), which is not allowed here.
  if (parsed.port !== REQUIRED_PORT) {
    throw new LocalDatabaseGuardError(`the port must be ${REQUIRED_PORT}`);
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (database !== REQUIRED_DATABASE) {
    throw new LocalDatabaseGuardError(`the database name must be ${REQUIRED_DATABASE}`);
  }

  return true;
}

function main(argv) {
  const candidate = argv[2] ?? process.env.DATABASE_URL;

  try {
    assertLocalDatabaseUrl(candidate);
  } catch (error) {
    if (error instanceof LocalDatabaseGuardError) {
      console.error(`assert-local-db: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  console.log('assert-local-db: the URL points at the local development database.');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv);
}
