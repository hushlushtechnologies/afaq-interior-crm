import { execFileSync } from 'node:child_process';
import { createLeadFixtures } from './lead-fixtures';

export function createImportFixtures(baseURL: string) {
  const base = createLeadFixtures(baseURL);
  const actors: string[] = [];
  return {
    async account(role: Parameters<typeof base.account>[0] = 'super_admin') {
      const account = await base.account(role);
      actors.push(account.id);
      return account;
    },
    async cleanup() {
      if (actors.length) {
        if (actors.some((id) => !/^[0-9a-f-]{36}$/.test(id)))
          throw new Error('Invalid fixture UUID.');
        const ids = actors.map((id) => `'${id}'`).join(',');
        execFileSync(
          'docker',
          [
            'exec',
            '-i',
            'supabase_db_afaq-interiors-crm-s09-local',
            'psql',
            '-X',
            '-U',
            'postgres',
            '-d',
            'postgres',
            '-v',
            'ON_ERROR_STOP=1',
          ],
          {
            input: `BEGIN;
            DELETE FROM crm_sales.import_requests WHERE actor_id IN (${ids});
            DELETE FROM crm_sales.import_events WHERE batch_id IN (SELECT id FROM crm_sales.import_batches WHERE actor_id IN (${ids}));
            DELETE FROM crm_sales.import_rows WHERE batch_id IN (SELECT id FROM crm_sales.import_batches WHERE actor_id IN (${ids}));
            DELETE FROM crm_sales.import_batches WHERE actor_id IN (${ids});
            COMMIT;`,
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        );
      }
      await base.cleanup();
    },
  };
}
