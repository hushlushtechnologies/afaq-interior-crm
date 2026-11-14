import 'server-only';
import { createHash } from 'node:crypto';

/** Request-time default in the CRM's approved Asia/Dubai timezone (UTC+04:00). */
export function currentDubaiQuotationDate() {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Reset an initial-data client view when its fresh authorized server data changes. */
export function quotationViewKey(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
