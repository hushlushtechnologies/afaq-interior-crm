'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { startTransition, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Button, buttonClassName } from '@/components/ui/button';
import { loadReminders, markReminderRead } from '@/features/reminders/actions';
import type { ReminderPage } from '@/features/reminders/contracts';
import type { Result } from '@/features/leads/schemas';

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function FollowUpNotifications() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result<ReminderPage> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const gate = useRef(false);

  async function load(page: number, readId?: string) {
    if (gate.current) return;

    gate.current = true;
    setBusy(true);
    setMessage('');

    try {
      if (readId) {
        const read = await markReminderRead({ id: readId });
        if (read.status === 'error') setMessage(read.message);
      }

      setResult(await loadReminders({ page }));
    } catch {
      setResult({
        status: 'error',
        message: 'Reminders could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <IconButton
        label="Open notifications"
        icon={Bell}
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setResult(null);
          setOpen(true);

          startTransition(() => {
            void load(0);
          });
        }}
      />

      {open && (
        <Dialog
          open
          title="Follow-up reminders"
          description="Personal in-app notices. Refresh to check for new reminders; no email or WhatsApp message is sent."
          dismissible={!busy}
          onOpenChange={(value) => {
            if (!value && !busy) {
              setOpen(false);
              setResult(null);
            }
          }}
        >
          <div className="space-y-4">
            {busy && <p role="status">Loading reminders…</p>}
            {message && <p role="alert">{message}</p>}
            {result?.status === 'error' && <p role="alert">{result.message}</p>}

            {result?.status === 'ok' && (
              <>
                <p role="status">
                  {result.data.unread} unread · {result.data.total} current reminders
                </p>

                {result.data.rows.length === 0 && <p>No current follow-up reminders.</p>}

                <ol className="space-y-4">
                  {result.data.rows.map((row) => (
                    <li key={row.id} className="space-y-2 rounded-control border border-border p-3">
                      <h3 className="font-semibold">{row.title}</h3>
                      <p className="text-sm">Due {time(row.due_at)} (Dubai)</p>
                      <p className="text-sm">{row.read_at ? 'Read' : 'Unread'}</p>

                      <div className="flex flex-wrap gap-2">
                        {!row.read_at && (
                          <Button
                            disabled={busy}
                            variant="outline"
                            onClick={() =>
                              startTransition(() => {
                                void load(result.data.page, row.id);
                              })
                            }
                          >
                            Mark reminder read
                          </Button>
                        )}

                        <Link
                          prefetch={false}
                          href={`/leads/details/${row.lead_id}#lead-follow-ups-heading`}
                          className={buttonClassName({ variant: 'outline' })}
                          onClick={(event) => {
                            if (gate.current) event.preventDefault();
                            else {
                              setOpen(false);
                              setResult(null);
                            }
                          }}
                        >
                          Open reminder lead
                        </Link>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || result.data.page === 0}
                    onClick={() =>
                      startTransition(() => {
                        void load(result.data.page - 1);
                      })
                    }
                  >
                    Previous reminder page
                  </Button>

                  <Button
                    variant="outline"
                    disabled={busy || (result.data.page + 1) * 20 >= result.data.total}
                    onClick={() =>
                      startTransition(() => {
                        void load(result.data.page + 1);
                      })
                    }
                  >
                    Next reminder page
                  </Button>
                </div>
              </>
            )}

            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                startTransition(() => {
                  void load(0);
                })
              }
            >
              Refresh reminders
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}