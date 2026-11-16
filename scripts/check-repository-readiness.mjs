import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const migrationDirectory = 'supabase/migrations';
const historicalEmpty = '20261114000200_sprint19_revision_creation.sql';
const repair = '20261114000300_sprint19_revision_repair.sql';
const problems = [];
const versions = new Set();

const files = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();

for (const file of files) {
  const match = /^(\d{14})_.+\.sql$/.exec(file);

  if (!match) {
    problems.push(`Invalid migration filename: ${file}`);
    continue;
  }

  if (versions.has(match[1])) problems.push(`Duplicate migration version: ${match[1]}`);

  versions.add(match[1]);

  const sql = readFileSync(join(migrationDirectory, file), 'utf8');

  const content = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\r\n]*/g, '')
    .trim();

  if (!content && file !== historicalEmpty) problems.push(`Empty migration: ${file}`);
}

const required = [
  join(migrationDirectory, repair),
  'src/app/api/integrations/website/leads/route.ts',
  'src/app/api/integrations/capture-worker/route.ts',
  'src/app/api/integrations/meta/[connectionId]/route.ts',
  'package-lock.json',
];

for (const file of required)
  if (!existsSync(file) || !statSync(file).size)
    problems.push(`Required file missing or empty: ${file}`);

if (
  existsSync(join(migrationDirectory, repair)) &&
  !readFileSync(join(migrationDirectory, repair), 'utf8').includes(
    'create or replace function public.crm_create_quotation_revision',
  )
)
  problems.push('The forward repair does not contain the revision RPC definition.');

if (problems.length) {
  for (const problem of problems) console.error(problem);

  process.exitCode = 1;
} else {
  console.log(`Repository structure checks passed: ${files.length} migrations checked.`);
  console.log(`Historical empty ${historicalEmpty} is retained; ${repair} is required.`);
  console.log('This checks files only. Run database, authorization and browser checks separately.');
}