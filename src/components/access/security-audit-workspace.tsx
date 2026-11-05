'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadSecurityAudit,
  type SecurityAuditPage,
} from '@/features/access/security-audit-actions';

export function SecurityAuditWorkspace() {
  const [target, setTarget] = useState('');
  const [data, setData] = useState<SecurityAuditPage | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  async function load(page: number, targetId: string | null) {
    if (busy.current) return;

    busy.current = true;
    setPending(true);
    setMessage('');
    setData(null);

    try {
      const result = await loadSecurityAudit({ page, targetId });

      if (result.status === 'ok') setData(result.data);
      else
        setMessage(
          result.status === 'invalid'
            ? 'Enter a valid optional record UUID.'
            : 'Audit unavailable. Your current Super Admin access could not be confirmed.',
        );
    } catch {
      setMessage('Audit could not be loaded. Try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(0, target.trim() || null);
  }

  return (
    <section
      aria-labelledby="security-audit-heading"
      className="space-y-4 rounded-card border border-border bg-card p-5"
    >
      <h2 id="security-audit-heading" className="text-lg font-semibold">
        Security audit
      </h2>

      <p className="text-sm text-muted-foreground">
        Successful role, account-status and invitation events. Only events recorded after auditing
        was enabled are shown. Failed or rolled-back operations are not success events.
      </p>

      <form aria-label="Load security audit" onSubmit={submit} className="max-w-xl space-y-3">
        <label htmlFor="audit-target" className="text-sm font-semibold">
          Target record UUID (optional)
        </label>

        <Input
          id="audit-target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          maxLength={36}
          autoComplete="off"
          disabled={pending}
        />

        <Button type="submit" loading={pending}>
          Show audit
        </Button>
      </form>

      {message ? (
        <p role="alert" className="text-sm">
          {message}
        </p>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <p role="status" className="text-sm">
            Page {data.page + 1}: {data.events.length} events
          </p>

          {!data.events.length ? (
            <p>No matching security events.</p>
          ) : (
            <ol aria-label="Security events" className="space-y-3">
              {data.events.map((event) => (
                <li
                  key={`${event.source}-${event.id}`}
                  className="space-y-1 rounded-control border border-border p-3 text-sm"
                >
                  <p className="font-semibold">{event.action.replaceAll('_', ' ')}</p>

                  <p>
                    {event.source.replaceAll('_', ' ')} · {event.detail}
                  </p>

                  <p className="break-all">
                    Actor: {event.actorKind.replaceAll('_', ' ')}
                    {event.actorId ? ` (${event.actorId})` : ''}
                  </p>

                  <p className="break-all">
                    Target {event.targetKind}: {event.targetId}
                  </p>

                  <p>
                    {new Date(event.at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} (Dubai)
                  </p>
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={pending || data.page === 0}
              onClick={() => void load(data.page - 1, data.targetId)}
            >
              Previous audit page
            </Button>

            <Button
              variant="outline"
              disabled={pending || !data.hasMore || data.page >= 10000}
              onClick={() => void load(data.page + 1, data.targetId)}
            >
              Next audit page
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
