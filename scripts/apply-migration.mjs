// Migration runner using node-postgres against the Supabase pooler. Used
// when the supabase CLI isn't authenticated. Connects with SUPABASE_DB_PASSWORD
// + the project ref from env, executes the SQL file as a single batch.
//
// Idempotent migrations should use IF NOT EXISTS / drop+create. The runner
// wraps everything in a transaction so a single failure rolls back the
// whole file.
//
// Usage:
//   node scripts/apply-migration.mjs supabase/migrations/<file>.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const [filepath] = process.argv.slice(2);
if (!filepath) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to-sql-file>");
  process.exit(1);
}

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!password || !projectRef) {
  console.error("Need SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF in .env.local");
  process.exit(1);
}

const sql = readFileSync(filepath, "utf8");

// Supabase project region isn't in the URL — try every common region until
// one accepts the tenant/user combination.
const REGIONS = [
  "us-west-1", // confirmed for this project — keep first
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "sa-east-1",
];

async function tryConnect(host, port) {
  const client = new pg.Client({
    host,
    port,
    user: `postgres.${projectRef}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  return client;
}

let client = null;
let foundHost = null;
for (const region of REGIONS) {
  for (const prefix of ["aws-0", "aws-1"]) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    try {
      client = await tryConnect(host, 6543);
      foundHost = host;
      break;
    } catch (e) {
      // Tenant not found / timeout — try next
      if (!String(e.message).includes("not found") && !String(e.message).includes("ETIMEDOUT")) {
        console.error(`[apply-migration] ${host}: ${e.message}`);
      }
    }
  }
  if (client) break;
}

if (!client) {
  console.error(`[apply-migration] Could not find pooler for project ${projectRef}`);
  console.error("Apply this SQL manually via Supabase Dashboard → SQL Editor:");
  console.error(`  File: ${filepath}`);
  process.exit(3);
}

console.log(`[apply-migration] Connected via ${foundHost}`);

try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`[apply-migration] ${filepath} applied OK`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error(`[apply-migration] FAILED: ${e.message}`);
  process.exit(2);
} finally {
  await client.end();
}
