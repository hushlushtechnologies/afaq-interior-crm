'use client';

import { useRef, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROLE_LABELS } from '@/features/access/catalog';
import {
  changeEmployeeStatus,
  loadEmployeeDirectory,
} from '@/features/employee/directory-actions';
import type { DirectoryResult, StatusChange } from '@/features/employee/directory-schemas';

export function EmployeeDirectoryWorkspace({ initial }: { initial: DirectoryResult }) {
  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', page: 0 });
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<(StatusChange & { email: string }) | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  async function reload(next = query) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      setResult(await loadEmployeeDirectory(next));
      setQuery(next);
    } catch {
      setMessage('The directory could not be refreshed. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    void reload({ search: search.trim(), page: 0 });
  }
  async function confirm() {
    if (!selected || busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const changed = await changeEmployeeStatus({
        requestId: selected.requestId,
        userId: selected.userId,
        expected: selected.expected,
        status: selected.status,
      });
      if (changed.status === 'error') {
        setError(changed.message);
        return;
      }
      setSelected(null);
      setMessage(
        changed.status === 'conflict'
          ? changed.message
          : changed.replayed
            ? 'This request was already processed. The directory has been refreshed.'
            : 'Account status updated. Existing roles were preserved.',
      );
      setResult(await loadEmployeeDirectory(query));
    } catch {
      setError('The result could not be confirmed. Retry this confirmation without changing it.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const directory = result.status === 'ok' ? result.directory : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee directory"
        description="Review employee accounts, invitations, and assigned roles."
      />
      <p className="text-sm text-muted-foreground">
        Deactivation blocks application access on subsequent protected requests. It preserves the
        account, profile, and role history.
      </p>
      <form
        aria-label="Search employee directory"
        onSubmit={find}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="space-y-2">
          <Label htmlFor="employee-search">Find employee</Label>
          <Input
            id="employee-search"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button type="submit" loading={pending}>
          Search employees
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => void reload()}>
          Reload directory
        </Button>
      </form>
      {message ? (
        <InlineNotice role="status" title="Directory result">
          <p>{message}</p>
        </InlineNotice>
      ) : null}
      {result.status === 'error' ? (
        <InlineNotice role="alert" title="Directory unavailable" tone="warning">
          <p>{result.message}</p>
        </InlineNotice>
      ) : null}
      {directory ? (
        <>
          {!directory.canManage ? (
            <p className="text-sm">Read-only access. Only Super Admin can change account status.</p>
          ) : null}
          <div className="overflow-x-auto rounded-control border border-border">
            <table className="w-full min-w-[700px] text-left text-sm">
              <caption className="sr-only">Employee accounts and pending invitations</caption>
              <thead>
                <tr>
                  {['Employee', 'Account status', 'Roles', 'Invitation', 'Action'].map((title) => (
                    <th key={title} scope="col" className="p-3">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {directory.rows.map((row) => (
                  <tr key={row.userId ?? row.email} className="border-t border-border">
                    <td className="p-3">
                      <p className="font-semibold">{row.name}</p>
                      <p>{row.email}</p>
                    </td>
                    <td className="p-3">
                      {row.status}
                      {row.blocked ? ' — Auth restricted' : ''}
                      {!row.confirmed ? ' — email unconfirmed' : ''}
                    </td>
                    <td className="p-3">
                      {row.roles.map((role) => ROLE_LABELS[role]).join(', ') || 'No roles assigned'}
                    </td>
                    <td className="p-3">{row.invitationStatus ?? 'Existing account'}</td>
                    <td className="p-3">
                      {directory.canManage && row.userId && row.status !== 'invited' ? (
                        <Button
                          variant={row.status === 'active' ? 'outline' : 'primary'}
                          disabled={
                            pending ||
                            (row.status === 'inactive' && (row.blocked || !row.confirmed))
                          }
                          onClick={(event) => {
                            triggerRef.current = event.currentTarget;
                            setError('');
                            setSelected({
                              userId: row.userId!,
                              expected: row.status as 'active' | 'inactive',
                              status: row.status === 'active' ? 'inactive' : 'active',
                              requestId: crypto.randomUUID(),
                              email: row.email,
                            });
                          }}
                        >
                          {row.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!directory.rows.length ? (
            <p role="status">No matching employee accounts or invitations.</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              {directory.total} matching records — page {directory.page + 1}
            </p>
            <Button
              variant="outline"
              disabled={pending || directory.page === 0}
              onClick={() => void reload({ ...query, page: directory.page - 1 })}
            >
              Previous page
            </Button>
            <Button
              variant="outline"
              disabled={pending || (directory.page + 1) * 20 >= directory.total}
              onClick={() => void reload({ ...query, page: directory.page + 1 })}
            >
              Next page
            </Button>
          </div>
        </>
      ) : null}
      <ConfirmationDialog
        returnFocusRef={triggerRef}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy.current) {
            setSelected(null);
            setError('');
          }
        }}
        title={
          selected?.status === 'inactive'
            ? 'Deactivate employee account?'
            : 'Activate employee account?'
        }
        description={
          selected
            ? `${selected.status === 'inactive' ? 'Block application access for' : 'Restore application access for'} ${selected.email}? Existing roles are preserved.`
            : ''
        }
        confirmLabel={
          selected?.status === 'inactive' ? 'Confirm deactivation' : 'Confirm activation'
        }
        tone={selected?.status === 'inactive' ? 'destructive' : 'neutral'}
        pending={pending}
        error={error || undefined}
        onConfirm={() => void confirm()}
      />
    </div>
  );
}
