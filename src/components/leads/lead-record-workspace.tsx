'use client';

import { useRef, useState } from 'react';
import { useAccess } from '@/components/access/access-provider';
import { FormField } from '@/components/forms/form-field';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { PageHeader } from '@/components/layout/page-header';
import { LeadQueryControls } from '@/components/leads/lead-query-controls';
import { LeadBulkAssignment } from '@/components/leads/lead-bulk-assignment';
import { queryLeads } from '@/features/leads/query-actions';
import {
  pipelineQuerySchema,
  type PipelinePage,
  type PipelineQuery,
} from '@/features/leads/query-schemas';
import { LeadPipelineControls } from '@/components/leads/lead-pipeline-controls';
import type { DemoStage } from '@/types/demo-crm';
import { LeadsTable } from '@/components/leads/leads-table';
import { LeadsKanban } from '@/components/leads/leads-kanban';
import { LeadViewProvider, type LeadListItem } from '@/components/leads/lead-view-context';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { hasCapability, hasRequiredScope } from '@/features/access/permissions';
import type { PermissionKey } from '@/features/access/catalog';
import { loadLeads, loadLeadOptions, submitLead } from '@/features/leads/actions';
import {
  leadFieldsSchema,
  type LeadCommand,
  type LeadFields,
  type LeadOptions,
  type LeadPage,
  type LeadRow,
  type LeadSave,
  type Result,
} from '@/features/leads/schemas';

const dubaiToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const fields = [
  ['customer_name', 'Customer name', 'text', true],
  ['email', 'Email', 'email', false],
  ['phone', 'Primary phone', 'tel', false],
  ['alternate_phone', 'Alternate phone', 'tel', false],
  ['property_type', 'Property / project type', 'text', false],
  ['location', 'Project location', 'text', false],
  ['budget', 'Estimated budget (AED)', 'text', false],
  ['expected_start_on', 'Expected start date', 'date', false],
  ['inquiry_on', 'Inquiry date', 'date', true],
  ['follow_up_on', 'Next follow-up date', 'date', false],
] as const;

function LeadEditor({
  row,
  options,
  externalLocked = false,
  canEdit,
  canAssign,
  canCreateUnassigned,
  userId,
  onSaved,
  onLock,
}: {
  row: LeadRow | null;
  externalLocked?: boolean;
  options: LeadOptions;
  canEdit: boolean;
  canAssign: boolean;
  canCreateUnassigned: boolean;
  userId: string;
  onLock: (locked: boolean) => void;
  onSaved: (result: LeadSave) => void;
}) {
  const [draft, setDraft] = useState<LeadFields>(() =>
    row
      ? {
          customer_name: row.customer_name,
          email: row.email,
          phone: row.phone,
          alternate_phone: row.alternate_phone,
          source_code: row.source_code,
          assigned_user_id: row.assigned_user_id,
          priority: row.priority,
          property_type: row.property_type,
          location: row.location,
          budget: row.budget === null ? null : row.budget.toFixed(2),
          expected_start_on: row.expected_start_on,
          inquiry_on: row.inquiry_on,
          follow_up_on: row.follow_up_on,
          description: row.description,
          initial_note: row.initial_note,
        }
      : {
          customer_name: '',
          email: null,
          phone: null,
          alternate_phone: null,
          source_code: 'manual',
          assigned_user_id: canCreateUnassigned ? null : userId,
          priority: 'normal',
          property_type: null,
          location: null,
          budget: null,
          expected_start_on: null,
          inquiry_on: dubaiToday(),
          follow_up_on: null,
          description: null,
          initial_note: null,
        },
  );

  const [owner, setOwner] = useState(row?.assigned_user_id ?? '');
  const [errors, setErrors] = useState<FormSummaryError[]>([]);
  const [result, setResult] = useState<Result<LeadSave> | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const command = useRef<LeadCommand | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const locked = result?.status === 'error' && result.retryable;
  const disabled = externalLocked || busy || locked || !canEdit || Boolean(row?.archived_at);

  const errorFor = (field: string) => errors.find((e) => e.fieldId === `lead-${field}`)?.message;

  async function execute(next: LeadCommand) {
    if (inFlight.current) return;

    inFlight.current = true;
    onLock(true);
    setBusy(true);
    setResult(null);
    command.current = next;

    try {
      const response = await submitLead(next);
      setResult(response);

      if (response.status === 'ok') {
        onLock(false);
        onSaved(response.data);
      } else if (!response.retryable) {
        command.current = null;
        onLock(false);
      }
    } catch {
      setResult({
        status: 'error',
        message: 'The result could not be confirmed. Retry the same request.',
        retryable: true,
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function save() {
    const parsed = leadFieldsSchema.safeParse(draft);

    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((issue) => ({
          fieldId: `lead-${String(issue.path[0])}`,
          message: issue.message,
        })),
      );

      requestAnimationFrame(() => summary.current?.focus());
      return;
    }

    setErrors([]);

    void execute(
      row
        ? {
            command: 'update',
            requestId: crypto.randomUUID(),
            leadId: row.id,
            version: row.version,
            data: parsed.data,
          }
        : { command: 'create', requestId: crypto.randomUUID(), data: parsed.data },
    );
  }

  return (
    <div className="space-y-5">
      {row && (
        <p className="text-sm text-muted-foreground">
          Lead #{row.reference} · Version {row.version} · {row.archived_at ? 'Archived' : 'Active'}
        </p>
      )}

      <form
        aria-label={row ? 'Lead information' : 'Create lead'}
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) save();
        }}
      >
        <FormErrorSummary ref={summary} errors={errors} />

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([key, label, type, required]) => (
            <FormField
              key={key}
              id={`lead-${key}`}
              label={label}
              required={required}
              disabled={disabled}
              error={errorFor(key)}
              description={
                key === 'phone' || key === 'alternate_phone'
                  ? 'Optional. Include + and country code, without spaces.'
                  : undefined
              }
            >
              {(control) => (
                <Input
                  {...control}
                  type={type}
                  value={draft[key] ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value || (required ? '' : null) })
                  }
                />
              )}
            </FormField>
          ))}

          <FormField
            id="lead-source_code"
            label="Lead source"
            required
            disabled={disabled || Boolean(row)}
            error={errorFor('source_code')}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={draft.source_code}
                onChange={(event) => setDraft({ ...draft, source_code: event.target.value })}
              >
                {options.sources.map((source) => (
                  <option key={source.code} value={source.code}>
                    {source.name}
                  </option>
                ))}
                {row && !options.sources.some((s) => s.code === row.source_code) && (
                  <option value={row.source_code}>{row.source_code} (historical)</option>
                )}
              </NativeSelect>
            )}
          </FormField>

          <FormField id="lead-priority" label="Priority" disabled={disabled}>
            {(control) => (
              <NativeSelect
                {...control}
                value={draft.priority}
                onChange={(event) =>
                  setDraft({ ...draft, priority: event.target.value as LeadFields['priority'] })
                }
              >
                {['low', 'normal', 'high', 'urgent'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          {!row && (
            <FormField
              id="lead-assigned_user_id"
              label="Assigned employee"
              disabled={disabled || !canCreateUnassigned}
            >
              {(control) => (
                <NativeSelect
                  {...control}
                  value={draft.assigned_user_id ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, assigned_user_id: event.target.value || null })
                  }
                >
                  {canCreateUnassigned && <option value="">Unassigned</option>}
                  {options.owners.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
        </div>

        <FormField
          id="lead-description"
          label="Inquiry description"
          disabled={disabled}
          error={errorFor('description')}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              value={draft.description ?? ''}
              onChange={(event) => setDraft({ ...draft, description: event.target.value || null })}
            />
          )}
        </FormField>

        <FormField
          id="lead-initial_note"
          label="Initial internal note"
          disabled={disabled || Boolean(row)}
          error={errorFor('initial_note')}
          description="Preserved as initial evidence. This does not send a message."
        >
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              value={draft.initial_note ?? ''}
              onChange={(event) => setDraft({ ...draft, initial_note: event.target.value || null })}
            />
          )}
        </FormField>

        {canEdit && !row?.archived_at && !locked && (
          <Button type="submit" loading={busy} disabled={disabled}>
            {row ? 'Save lead changes' : 'Create lead'}
          </Button>
        )}
      </form>

      {row && canAssign && !row.archived_at && (
        <div className="space-y-3 border-t border-border pt-4">
          <FormField
            id="lead-reassign"
            label="Assign employee"
            disabled={externalLocked || busy || locked}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
              >
                <option value="">Unassigned</option>
                {options.owners.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
                {row.assigned_user_id &&
                  !options.owners.some((e) => e.id === row.assigned_user_id) && (
                    <option value={row.assigned_user_id}>
                      {row.assigned_name ?? 'Current employee'} (currently ineligible)
                    </option>
                  )}
              </NativeSelect>
            )}
          </FormField>

          <Button
            variant="outline"
            disabled={externalLocked || busy || locked || owner === (row.assigned_user_id ?? '')}
            onClick={() =>
              void execute({
                command: 'assign',
                requestId: crypto.randomUUID(),
                leadId: row.id,
                version: row.version,
                data: { assigned_user_id: owner || null },
              })
            }
          >
            Save assignment
          </Button>
        </div>
      )}

      {result?.status === 'error' && (
        <div role="alert" className="space-y-3 rounded-control border border-border p-4">
          <p>{result.message}</p>
          {result.retryable && (
            <Button loading={busy} onClick={() => command.current && void execute(command.current)}>
              Retry same request
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function LeadRecordWorkspace({
  initial,
  initialOptions,
  initialView = 'table',
}: {
  initial: Result<PipelinePage>;
  initialOptions: Result<LeadOptions>;
  initialView?: 'table' | 'kanban';
}) {
  const { snapshot } = useAccess();
  const [result, setResult] = useState(initial);
  const [optionsResult, setOptionsResult] = useState(initialOptions);
  const [page, setPage] = useState(0);
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState(() => pipelineQuerySchema.parse({}));
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkLocked, setBulkLocked] = useState(false);
  const [view, setView] = useState(initialView);
  const [loading, setLoading] = useState(false);
  const [editorLocked, setEditorLocked] = useState(false);
  const [editor, setEditor] = useState<{ row: LeadRow | null; events: LeadPage['events'] } | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const [requestedStage, setRequestedStage] = useState<DemoStage | undefined>();

  const salesActor = snapshot.roles.some(
    (role) => role === 'super_admin' || role === 'sales_executive',
  );

  const [archiveRow, setArchiveRow] = useState<LeadRow | null>(null);
  const [archivePending, setArchivePending] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const archiveCommand = useRef<LeadCommand | null>(null);
  const loadSequence = useRef(0);

  const can = (permission: PermissionKey, row: LeadRow) =>
    hasRequiredScope(snapshot, permission, 'company') ||
    (row.assigned_user_id === snapshot.userId &&
      hasRequiredScope(snapshot, permission, 'assigned')) ||
    (row.created_by === snapshot.userId && hasRequiredScope(snapshot, permission, 'own'));

  async function refresh(
    nextPage = query.page,
    nextArchived = query.archived,
    nextQuery: PipelineQuery = query,
  ) {
    const requested = { ...nextQuery, page: nextPage, archived: nextArchived };
    setQuery(requested);
    setSelected([]);

    const sequence = ++loadSequence.current;
    setLoading(true);
    setEditor(null);

    try {
      const [next, options] = await Promise.all([queryLeads(requested), loadLeadOptions()]);

      if (sequence !== loadSequence.current) return;

      setResult(next);
      setOptionsResult(options);
      setPage(nextPage);
      setArchived(nextArchived);
    } catch {
      if (sequence === loadSequence.current)
        setResult({
          status: 'error',
          message: 'Leads could not be loaded. Please retry.',
          retryable: true,
        });
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  async function open(id: string, stage?: DemoStage) {
    if (bulkLocked) return;

    setSelected([]);
    setRequestedStage(stage);

    if (optionsResult.status !== 'ok') {
      setMessage('Lead options are unavailable. Reload leads before opening a record.');
      return;
    }

    setLoading(true);
    setEditor(null);

    try {
      const detail = await loadLeads({ page: 0, archived, id });

      if (detail.status === 'ok' && detail.data.rows[0])
        setEditor({ row: detail.data.rows[0], events: detail.data.events });
      else setMessage(detail.status === 'error' ? detail.message : 'Lead is no longer accessible.');
    } catch {
      setMessage('Lead could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function archive() {
    if (!archiveRow || archivePending) return;

    archiveCommand.current ??= {
      command: 'archive',
      requestId: crypto.randomUUID(),
      leadId: archiveRow.id,
      version: archiveRow.version,
      data: {},
    };

    setArchivePending(true);
    setArchiveError('');

    try {
      const response = await submitLead(archiveCommand.current);

      if (response.status === 'error') {
        setArchiveError(response.message);
        if (!response.retryable) archiveCommand.current = null;
      } else {
        setArchiveRow(null);
        archiveCommand.current = null;
        setMessage('Lead archived. History has been retained.');
        await refresh(0);
      }
    } catch {
      setArchiveError('Result uncertain. Confirm again to retry the same request.');
    } finally {
      setArchivePending(false);
    }
  }

  const options = optionsResult.status === 'ok' ? optionsResult.data : null;
  const rows = result.status === 'ok' ? result.data.rows : [];

  const owners = new Map(
    (options?.owners ?? []).map((owner) => [owner.id, { ...owner, label: 'Employee' }]),
  );

  for (const row of rows)
    if (row.assigned_user_id)
      owners.set(row.assigned_user_id, {
        id: row.assigned_user_id,
        name: row.assigned_name ?? 'Assigned employee',
        label: 'Employee',
      });

  const eligibleIds = rows
    .filter((row) => !row.archived_at && row.stage !== 'lost' && can('leads.assign', row))
    .map((row) => row.id);

  const filterSources = [
    ...new Map(
      [...(options?.sources ?? []), ...(result.status === 'ok' ? result.data.sources : [])].map(
        (source) => [source.code, source],
      ),
    ).values(),
  ];

  const items: LeadListItem[] = rows.map((row) => ({
    id: row.id,
    clientName: row.customer_name,
    title: row.description ?? `Lead #${row.reference}`,
    priority: row.priority,
    stage: row.stage,
    ownerId: row.assigned_user_id ?? '',
    createdOn: row.inquiry_on,
    nextFollowUpOn: row.follow_up_on,
    budget: row.budget,
    source: options?.sources.find((s) => s.code === row.source_code)?.name ?? row.source_code,
    propertyType: row.property_type,
  }));

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title="Leads"
        eyebrow="Sales workspace"
        description="Recorded inquiries visible to your account. Source and history are preserved."
        actions={
          hasCapability(snapshot, 'leads.create') && options ? (
            <Button
              disabled={loading || bulkLocked}
              onClick={() => setEditor({ row: null, events: [] })}
            >
              Create lead
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3" role="group" aria-label="Lead views">
        <Button
          disabled={bulkLocked}
          variant={view === 'table' ? 'primary' : 'outline'}
          onClick={() => {
            setSelected([]);
            setView('table');
          }}
        >
          Table
        </Button>

        <Button
          variant={view === 'kanban' ? 'primary' : 'outline'}
          disabled={bulkLocked}
          onClick={() => {
            setSelected([]);
            setView('kanban');
          }}
        >
          Kanban
        </Button>

        <Button
          variant="outline"
          disabled={loading || bulkLocked}
          onClick={() => void refresh(0, !archived)}
        >
          {archived ? 'Show active leads' : 'Show archived leads'}
        </Button>

        <Button variant="outline" disabled={loading || bulkLocked} onClick={() => void refresh()}>
          Reload leads
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {archived ? 'Archived inquiries' : 'Active inquiries'}. Working stages support authorized
        forward and backward moves. Lost and reopening require recorded reasons. Quotation,
        Negotiation and Won remain unavailable. A follow-up date records intent; it does not
        schedule a reminder.
      </p>

      <LeadQueryControls
        key={JSON.stringify(query)}
        query={query}
        owners={result.status === 'ok' ? result.data.owners : []}
        sources={filterSources}
        disabled={loading || bulkLocked}
        onApply={(next) => void refresh(0, archived, next)}
      />

      {hasCapability(snapshot, 'leads.assign') && !archived && options && (
        <LeadBulkAssignment
          rows={rows
            .filter((row) => selected.includes(row.id))
            .map((row) => ({ id: row.id, version: row.version }))}
          owners={options.owners}
          disabled={loading}
          onLock={setBulkLocked}
          onSaved={(saved) => {
            setMessage(
              `${saved.replayed ? 'Bulk request already recorded.' : 'Bulk assignment recorded.'} ${saved.changed} of ${saved.affected} selected leads changed. History preserved.`,
            );
            void refresh(0);
          }}
        />
      )}

      {message && (
        <p role="status" className="rounded-control border border-border bg-card p-4">
          {message}
        </p>
      )}

      {loading ? (
        <p role="status">Loading leads…</p>
      ) : result.status === 'error' ? (
        <p role="alert">{result.message}</p>
      ) : (
        <>
          {optionsResult.status === 'error' && (
            <p role="alert">{optionsResult.message} Reload before creating or editing.</p>
          )}

          <p role="status">
            Page {page + 1}: {rows.length} of {result.data.total} visible leads
          </p>

          {rows.length === 0 ? (
            <EmptyState
              title="No leads on this page"
              description="Create an inquiry if permitted, switch active/archive views, or return to the previous page."
            />
          ) : (
            <LeadViewProvider
              value={{
                data: { owners: [...owners.values()], asOfDate: dubaiToday() },
                readOnly: true,
                stageCounts: result.data.stageCounts,
                serverTable: {
                  sort: query.sort,
                  direction: query.direction,
                  disabled: loading || bulkLocked,
                  onSort: (sort, direction) =>
                    void refresh(0, archived, {
                      ...query,
                      sort: sort as PipelineQuery['sort'],
                      direction,
                    }),
                },
                selection:
                  hasCapability(snapshot, 'leads.assign') && !archived
                    ? {
                        ids: selected,
                        eligibleIds,
                        disabled: loading || bulkLocked,
                        toggle: (id) =>
                          setSelected((current) =>
                            current.includes(id)
                              ? current.filter((value) => value !== id)
                              : [...current, id],
                          ),
                        togglePage: () =>
                          setSelected((current) =>
                            eligibleIds.every((id) => current.includes(id)) ? [] : eligibleIds,
                          ),
                      }
                    : undefined,
                onOpen: (id) => void open(id),
                moveLead: () => false,
                pipeline: {
                  canMove: (id) =>
                    !bulkLocked &&
                    salesActor &&
                    !archived &&
                    Boolean(
                      rows.find(
                        (row) => row.id === id && row.stage !== 'lost' && can('leads.update', row),
                      ),
                    ),
                  requestMove: (id, stage) => {
                    if (
                      !['new', 'assigned', 'contacted', 'requirements', 'site-visit'].includes(
                        stage,
                      )
                    ) {
                      setMessage(
                        'Use the protected Lost workflow in Lead information. Quotation, Negotiation and Won are unavailable.',
                      );
                      return;
                    }

                    void open(id, stage);
                  },
                },
                announce: setMessage,
              }}
            >
              {view === 'table' ? <LeadsTable leads={items} /> : <LeadsKanban leads={items} />}
            </LeadViewProvider>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={bulkLocked || page === 0}
              onClick={() => void refresh(page - 1)}
            >
              Previous leads page
            </Button>

            <Button
              variant="outline"
              disabled={(page + 1) * query.pageSize >= result.data.total || bulkLocked}
              onClick={() => void refresh(page + 1)}
            >
              Next leads page
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(editor)}
        dismissible={!editorLocked}
        onOpenChange={(open) => {
          if (!open && !editorLocked) setEditor(null);
        }}
        title={editor?.row ? 'Lead information' : 'Create lead'}
        description="Only authorized changes are saved. Unknown optional information may remain blank."
        className="max-w-3xl"
      >
        {editor && options && (
          <>
            {editor.row && (
              <LeadPipelineControls
                key={`${editor.row.id}-${editor.row.version}`}
                row={editor.row}
                canMove={salesActor && can('leads.update', editor.row)}
                canOutcome={salesActor && can('leads.mark_lost', editor.row)}
                initialStage={requestedStage}
                disabled={editorLocked}
                onLock={setEditorLocked}
                onSaved={() => {
                  setMessage('Pipeline request recorded. History preserved.');
                  void refresh(0);
                }}
              />
            )}

            <LeadEditor
              key={editor.row?.id ?? 'new'}
              row={editor.row}
              options={options}
              userId={snapshot.userId}
              externalLocked={editorLocked}
              canEdit={
                editor.row
                  ? editor.row.stage !== 'lost' && can('leads.update', editor.row)
                  : hasCapability(snapshot, 'leads.create')
              }
              canAssign={Boolean(
                editor.row && editor.row.stage !== 'lost' && can('leads.assign', editor.row),
              )}
              canCreateUnassigned={hasRequiredScope(snapshot, 'leads.assign', 'company')}
              onLock={setEditorLocked}
              onSaved={(saved) => {
                setMessage(
                  `${saved.replayed ? 'Request already recorded.' : 'Lead saved.'}${saved.possibleDuplicate ? ' Possible duplicate: another visible lead has matching contact details. No records were merged.' : ''}`,
                );
                void refresh(0);
              }}
            />

            {editor.row && (
              <div className="mt-6 space-y-4 border-t border-border pt-4">
                <h3 className="font-semibold">Recent lead history</h3>

                <p className="text-xs text-muted-foreground">
                  Latest 50 events; stored history is retained.
                </p>

                <ol className="space-y-2">
                  {editor.events.map((event) => (
                    <li key={event.id} className="break-words text-sm">
                      {event.action} ·{' '}
                      {new Date(event.occurred_at).toLocaleString('en-GB', {
                        timeZone: 'Asia/Dubai',
                      })}{' '}
                      Dubai · Actor {event.actor_id}
                    </li>
                  ))}
                </ol>

                {!editor.row.archived_at && can('leads.archive', editor.row) && (
                  <Button
                    variant="destructive"
                    disabled={editorLocked}
                    onClick={() => {
                      setArchiveRow(editor.row);
                      setEditor(null);
                      setArchiveError('');
                      archiveCommand.current = null;
                    }}
                  >
                    Archive lead
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </Dialog>

      <ConfirmationDialog
        open={Boolean(archiveRow)}
        onOpenChange={(open) => {
          if (!open && !archivePending) {
            setArchiveRow(null);
            archiveCommand.current = null;
          }
        }}
        title="Archive lead?"
        description="The inquiry will leave active lists. Its source, ownership and history remain retained."
        confirmLabel="Confirm archive"
        tone="destructive"
        pending={archivePending}
        error={archiveError}
        onConfirm={() => void archive()}
      />
    </div>
  );
}
