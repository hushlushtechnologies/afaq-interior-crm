import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Update previous Sprint 11 test fixtures for the new private audit foreign keys.
// This edits local test source only; it never connects to a database or email service.
const root = resolve(process.argv[2] ?? '.');

const files = [
  ['tests/e2e/employee-invitation-ui.spec.ts', 'actorIds'],
  ['tests/e2e/employee-invitation-delivery.spec.ts', 'actors'],
  ['tests/e2e/employee-directory.spec.ts', 'users'],
];

const changes = [];

for (const [name, actorVariable] of files) {
  const path = resolve(root, name);
  const source = readFileSync(path, 'utf8');

  const hasEvents = source.includes('DELETE FROM crm_employees.invitation_events');
  const hasReceipts = source.includes('DELETE FROM crm_employees.invitation_recovery_requests');

  if (hasEvents && hasReceipts) continue;
  if (hasEvents || hasReceipts) throw new Error(`Review the partial cleanup in ${name}.`);

  const actors = '${' + actorVariable + '}';
  const marker = `DELETE FROM crm_employees.invitation_receipts WHERE requested_by IN (${actors});`;

  if (source.split(marker).length !== 2)
    throw new Error(`Expected fixture cleanup missing in ${name}.`);

  const owned = `SELECT id FROM crm_employees.invitations WHERE requested_by IN (${actors})`;
  const cleanup = `DELETE FROM crm_employees.invitation_events WHERE invitation_id IN (${owned}); DELETE FROM crm_employees.invitation_recovery_requests WHERE invitation_id IN (${owned}); `;

  changes.push([path, source.replace(marker, cleanup + marker)]);
}

// Preflight every file before writing any changes.
for (const [path, source] of changes) writeFileSync(path, source, 'utf8');

console.log(
  `Prepared ${changes.length} local test fixture files. Already prepared files were retained.`,
);