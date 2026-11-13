import { execFileSync } from 'node:child_process';
import { createLocalAuthFixtures, type LocalTestAccount } from './local-auth-fixtures';

export function createLeadFixtures(baseURL: string) {
  const auth = createLocalAuthFixtures(baseURL);
  const ids: string[] = [];

  return {
    async account(
      role: 'super_admin' | 'sales_executive' | 'management_director' | null = 'super_admin',
    ) {
      const user = await auth.createAccount({ role });
      ids.push(user.id);
      return user;
    },
    async cleanup() {
      if (ids.length) {
        if (ids.some((id) => !/^[0-9a-f-]{36}$/.test(id))) throw new Error('Invalid fixture UUID.');

        const values = ids.map((id) => `'${id}'`).join(',');

        execFileSync(
          'docker',
          [
            'exec',
            '-i',
            'supabase_db_afaq-interiors-crm-s09-local',
            'psql',
            '-U',
            'postgres',
            '-d',
            'postgres',
            '-X',
            '-v',
            'ON_ERROR_STOP=1',
          ],
          {
            input: `BEGIN;
SELECT pg_advisory_xact_lock(90310001::bigint);
DELETE FROM crm_sales.export_events WHERE actor_id IN (${values});
DELETE FROM crm_sales.follow_up_reminders WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.sales_requests WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.follow_up_events WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.manual_activities WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.follow_ups WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.attachment_link_requests WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.attachment_link_events WHERE link_id IN (SELECT id FROM crm_sales.attachment_links WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values})));
DELETE FROM crm_sales.attachment_links WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.attachment_upload_windows WHERE actor_id IN (${values});
DELETE FROM crm_sales.attachment_events WHERE attachment_id IN (SELECT id FROM crm_sales.attachments WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values})));
DELETE FROM crm_sales.attachments WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.visit_requests WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.visit_events WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.site_visits WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.detail_requests WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.detail_events WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.detail_records WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.bulk_assignment_requests WHERE actor_id IN (${values});
UPDATE crm_sales.leads SET stage='new',current_loss_id=null WHERE created_by IN (${values});
DELETE FROM crm_sales.losses WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.requests WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.events WHERE lead_id IN (SELECT id FROM crm_sales.leads WHERE created_by IN (${values}));
DELETE FROM crm_sales.leads WHERE created_by IN (${values});
COMMIT;`,
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        );
      }

      await auth.cleanup();
    },
  };
}

export type LeadFixtures = ReturnType<typeof createLeadFixtures>;
export type { LocalTestAccount };