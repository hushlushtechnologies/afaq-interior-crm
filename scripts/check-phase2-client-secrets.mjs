import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

// Run from the repository root. Never print values or matching file contents.
if (existsSync('.env.local')) loadEnvFile('.env.local');
const names = ['SUPABASE_LOCAL_TEST_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'E2E_AUTH_PASSWORD'];
const bindings = names.filter((name) => process.env[name] && process.env[name].length >= 12);
if (!bindings.includes('SUPABASE_LOCAL_TEST_SECRET_KEY')) {
  throw new Error('Local secret binding unavailable; the check cannot be verified.');
}
const root = resolve('.next/static');
if (!existsSync(root)) throw new Error('Build the app before checking client artifacts.');
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = walk(root);
const logs = process.argv.slice(2).map((file) => resolve(file));
const matches = [];
for (const file of [...files, ...logs]) {
  const content = readFileSync(file);
  for (const name of bindings) {
    const value = process.env[name];
    const variants = [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)];
    if (variants.some((variant) => content.includes(Buffer.from(variant)))) {
      matches.push({ file, binding: name });
    }
  }
}
console.log(
  JSON.stringify(
    {
      clientFilesChecked: files.length,
      testLogsChecked: logs.length,
      bindingsChecked: bindings,
      matches,
    },
    null,
    2,
  ),
);
if (matches.length) process.exitCode = 1;