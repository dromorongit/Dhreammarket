#!/usr/bin/env node
// Runs the guarded local database commands.
//
// The local DATABASE_URL is built here, from constants only. Nothing in this
// file reads .env, so the production (Railway) DATABASE_URL can never reach a
// local command. The guard in assert-local-db.mjs runs first: no docker and no
// prisma process is started until the URL is proven to be local.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDatabaseUrl } from './assert-local-db.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE_FILE = 'docker-compose.dev.yml';
const PRISMA_CLI = path.join(REPO_ROOT, 'node_modules', 'prisma', 'build', 'index.js');

const LOCAL_DATABASE = {
  host: 'localhost',
  port: 5433,
  user: 'dhream_dev',
  password: 'dhream_dev',
  database: 'dhream_dev',
};

export function buildLocalDatabaseUrl() {
  const { user, password, host, port, database } = LOCAL_DATABASE;
  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function composeArgs(...rest) {
  return ['compose', '-f', COMPOSE_FILE, ...rest];
}

function prismaEnv(databaseUrl) {
  const env = { ...process.env, DATABASE_URL: databaseUrl };

  // Make sure no ambient PG* variable can steer the connection somewhere else.
  for (const key of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGCONNECT_TIMEOUT']) {
    delete env[key];
  }

  return env;
}

async function runPrisma(databaseUrl, ...args) {
  if (!existsSync(PRISMA_CLI)) {
    throw new Error(`prisma CLI not found at ${PRISMA_CLI}; run npm install first`);
  }

  // Run the CLI through node directly so this works on Windows too, where
  // node_modules/.bin/prisma is a .cmd shim that cannot be spawned without a shell.
  await run(process.execPath, [PRISMA_CLI, ...args], { env: prismaEnv(databaseUrl) });
}

async function waitForHealthy(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;

  let containerId = '';
  while (Date.now() < deadline && !containerId) {
    containerId = await capture('docker', composeArgs('ps', '-q', 'postgres'));
    if (!containerId) {
      await delay(1000);
    }
  }

  if (!containerId) {
    throw new Error('the postgres container did not start');
  }

  while (Date.now() < deadline) {
    const status = await capture('docker', [
      'inspect',
      '--format={{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
      containerId,
    ]);

    if (status === 'healthy') {
      console.log('postgres is healthy on localhost:5433');
      return;
    }

    if (status === 'unhealthy' || status === 'exited') {
      throw new Error(`the postgres container reported status ${status}`);
    }

    await delay(1000);
  }

  throw new Error('timed out waiting for postgres to become healthy');
}

async function up() {
  await run('docker', composeArgs('up', '-d'));
  await waitForHealthy();
}

async function down() {
  await run('docker', composeArgs('down'));
}

async function reset() {
  // -v removes the named volume, so the next start comes up with an empty database.
  await run('docker', composeArgs('down', '-v', '--remove-orphans'));
  await up();
}

async function main() {
  const command = process.argv[2];
  const known = ['up', 'down', 'reset', 'migrate', 'status'];

  if (!known.includes(command)) {
    console.error(`Usage: node scripts/local-db.mjs <${known.join('|')}>`);
    process.exit(1);
  }

  const databaseUrl = buildLocalDatabaseUrl();

  // Guard first. Nothing below this line runs for a non-local URL.
  assertLocalDatabaseUrl(databaseUrl);

  console.log(`local-db: running "${command}" against the local development database (localhost:5433/dhream_dev)`);

  if (command === 'up') {
    await up();
    return;
  }

  if (command === 'down') {
    await down();
    return;
  }

  if (command === 'reset') {
    await reset();
    return;
  }

  if (command === 'migrate') {
    await runPrisma(databaseUrl, 'migrate', 'deploy');
    return;
  }

  if (command === 'status') {
    await runPrisma(databaseUrl, 'migrate', 'status');
  }
}

main().catch((error) => {
  console.error(`local-db: ${error.message}`);
  process.exit(1);
});
