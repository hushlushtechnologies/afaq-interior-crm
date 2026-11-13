'use client';
import { useRef, useState } from 'react';
import { useAccess } from '@/components/access/access-provider';
import { Button } from '@/components/ui/button';
import { hasCapability } from '@/features/access/permissions';
import type { PipelineQuery } from '@/features/leads/query-schemas';
import { LEAD_CSV_LIMITS } from '@/features/lead-export/csv';

export function LeadExportButton({ query, disabled }: { query: PipelineQuery; disabled: boolean }) {
  const { snapshot } = useAccess();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const flight = useRef(false);
  if (!hasCapability(snapshot, 'leads.export') || !hasCapability(snapshot, 'leads.view'))
    return null;
  async function download() {
    if (flight.current || disabled) return;
    flight.current = true;
    setBusy(true);
    setMessage('Preparing the applied-filter snapshot…');
    setFailed(false);
    try {
      const response = await fetch('/api/leads/export', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        const result: unknown = await response.json();
        if (
          result &&
          typeof result === 'object' &&
          'message' in result &&
          typeof result.message === 'string' &&
          result.message.length < 400
        )
          throw new Error(result.message);
        throw new Error('The export could not be verified. Request a new snapshot.');
      }
      const filename = /^attachment; filename="(afaq-leads-[a-f0-9-]{36}\.csv)"$/.exec(
        response.headers.get('content-disposition') ?? '',
      )?.[1];
      if (!filename || !response.headers.get('content-type')?.startsWith('text/csv'))
        throw new Error('Sign in again or reload before exporting.');
      const blob = await response.blob();
      if (blob.size > LEAD_CSV_LIMITS.bytes)
        throw new Error('The export exceeds the CSV size limit.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage('CSV prepared. Your browser handles saving the file.');
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'AbortError'
          ? error.message
          : 'The export could not be confirmed. Retry to request a new snapshot.',
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy}
        onClick={() => void download()}
      >
        {busy ? 'Preparing CSV…' : 'Export applied filters'}
      </Button>
      <p className="text-xs text-muted-foreground">
        All matching rows, up to 1,000 and 4 MiB. Apply draft filters first. Internal notes and
        attachments are excluded.
      </p>
      {message && (
        <p role={failed ? 'alert' : 'status'} className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}