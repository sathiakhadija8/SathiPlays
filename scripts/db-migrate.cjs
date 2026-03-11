#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const ROOT_DIR = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'db', 'migrations');

function printUsage() {
  console.log('Usage: node scripts/db-migrate.cjs <status|up|create> [name] [--env <path>]');
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift() || 'status';
  let name = null;
  let envFile = path.join(ROOT_DIR, '.env.local');

  while (args.length > 0) {
    const token = args.shift();
    if (token === '--env') {
      const next = args.shift();
      if (!next) {
        throw new Error('Missing value for --env');
      }
      envFile = path.resolve(ROOT_DIR, next);
      continue;
    }
    if (!name) {
      name = token;
      continue;
    }
    throw new Error(`Unexpected argument: ${token}`);
  }

  return { command, name, envFile };
}

function parseEnvFile(envFile) {
  if (!fs.existsSync(envFile)) {
    throw new Error(`Env file not found: ${envFile}`);
  }

  const result = {};
  const content = fs.readFileSync(envFile, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function dbConfigFromEnv(env) {
  return {
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'sathia',
    password: env.MYSQL_PASSWORD || 'sathiapass',
    database: env.MYSQL_DATABASE || 'sathiplays',
    multipleStatements: true,
  };
}

function safeName(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function timestampSlug(date = new Date()) {
  const y = String(date.getUTCFullYear());
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${d}_${hh}${mm}${ss}`;
}

function fileChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => {
      const fullPath = path.join(MIGRATIONS_DIR, name);
      const sql = fs.readFileSync(fullPath, 'utf8');
      return { name, fullPath, sql, checksum: fileChecksum(sql) };
    });
}

async function ensureMigrationsTable(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getApplied(connection) {
  const [rows] = await connection.execute(
    `SELECT filename, checksum, applied_at FROM schema_migrations ORDER BY filename ASC`,
  );
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.filename), {
      checksum: String(row.checksum),
      appliedAt: row.applied_at,
    });
  }
  return map;
}

async function runStatus(connection) {
  const files = listMigrationFiles();
  const applied = await getApplied(connection);

  const pending = [];
  for (const file of files) {
    const existing = applied.get(file.name);
    if (!existing) {
      pending.push(file);
      continue;
    }
    if (existing.checksum !== file.checksum) {
      throw new Error(`Checksum mismatch for applied migration: ${file.name}`);
    }
  }

  console.log(`Migrations dir: ${MIGRATIONS_DIR}`);
  console.log(`Total files: ${files.length}`);
  console.log(`Applied: ${applied.size}`);
  console.log(`Pending: ${pending.length}`);

  if (pending.length > 0) {
    console.log('Pending migrations:');
    for (const file of pending) {
      console.log(`- ${file.name}`);
    }
  }
}

async function runUp(connection) {
  const files = listMigrationFiles();
  const applied = await getApplied(connection);

  let appliedCount = 0;

  for (const file of files) {
    const existing = applied.get(file.name);
    if (existing) {
      if (existing.checksum !== file.checksum) {
        throw new Error(`Checksum mismatch for applied migration: ${file.name}`);
      }
      continue;
    }

    console.log(`Applying ${file.name} ...`);

    await connection.beginTransaction();
    try {
      await connection.query(file.sql);
      await connection.execute(
        `INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)`,
        [file.name, file.checksum],
      );
      await connection.commit();
      appliedCount += 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  console.log(`Applied ${appliedCount} migration(s).`);
}

function runCreate(name) {
  const cleaned = safeName(name);
  if (!cleaned) {
    throw new Error('Migration name is required for create command.');
  }

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }

  const fileName = `${timestampSlug()}_${cleaned}.sql`;
  const fullPath = path.join(MIGRATIONS_DIR, fileName);

  const template = `-- Migration: ${fileName}\n-- Write forward-only SQL changes here.\n\n`;
  fs.writeFileSync(fullPath, template, 'utf8');

  console.log(`Created migration: ${path.relative(ROOT_DIR, fullPath)}`);
}

async function main() {
  const { command, name, envFile } = parseArgs(process.argv.slice(2));

  if (command === 'create') {
    runCreate(name);
    return;
  }

  if (command !== 'status' && command !== 'up') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const env = {
    ...process.env,
    ...parseEnvFile(envFile),
  };

  const connection = await mysql.createConnection(dbConfigFromEnv(env));
  try {
    await ensureMigrationsTable(connection);
    if (command === 'status') {
      await runStatus(connection);
      return;
    }
    await runUp(connection);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`db-migrate: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
