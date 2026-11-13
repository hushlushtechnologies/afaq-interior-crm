'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { FormField } from '@/components/forms/form-field';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useAccess } from '@/components/access/access-provider';
import { hasRequiredScope } from '@/features/access/permissions';
import { CSV_LIMITS, parseLeadCsv, type LeadCsv } from '@/features/lead-import/csv';
import { importPageInputSchema, importUploadSchema } from '@/features/lead-import/contracts';
import { previewLeadImport, type ImportPreview } from '@/features/lead-import/preview';
import { ImportClientError, stageImport, type ImportUpload } from '@/features/lead-import/client';
import type { LeadOptions, Result } from '@/features/leads/schemas';
import { LeadImportBatch } from './lead-import-batch';
import { importFieldLabels, LeadImportRows } from './lead-import-rows';

export function LeadImportWorkspace({
  initial,
  today,
  initialBatchId = '',
}: {
  initial: Result<LeadOptions>;
  today: string;
  initialBatchId?: string;
}) {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { snapshot } = useAccess();
  const options = initial.status === 'ok' ? initial.data : null;
  const validInitial = importPageInputSchema.safeParse({ batchId: initialBatchId, page: 0 }).success
    ? initialBatchId
    : '';
  const [batchId, setBatchId] = useState(validInitial);
  const [resumeId, setResumeId] = useState(initialBatchId);
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<LeadCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [source, setSource] = useState(options?.sources.find((s) => s.code === 'csv')?.code ?? '');
  const [owner, setOwner] = useState(
    options?.owners.some((o) => o.id === snapshot.userId) ? snapshot.userId : '',
  );
  const [date, setDate] = useState(today);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [batchLocked, setBatchLocked] = useState(Boolean(validInitial));
  const stageFlight = useRef(false);
  const childGate = useRef(Boolean(validInitial));
  const pending = useRef<{ metadata: ImportUpload; file: File } | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const companyAssignment = hasRequiredScope(snapshot, 'leads.assign', 'company');
  const lockBatch = useCallback((locked: boolean) => {
    childGate.current = locked;
    setBatchLocked(locked);
  }, []);
  const locked = !hydrated || busy || uncertain;

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  function updateDraft(change: () => void) {
    if (stageFlight.current || pending.current) return;
    change();
    setPreview(null);
    setError('');
  }

  function openBatch(id: string) {
    childGate.current = true;
    setBatchLocked(true);
    setBatchId(id);
    setResumeId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('batchId', id);
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    setFile(null);
    setCsv(null);
    setPreview(null);
  }

  async function chooseFile(next?: File) {
    if (stageFlight.current || pending.current) return;
    stageFlight.current = true;
    setBusy(true);
    setError('');
    setPreview(null);
    setCsv(null);
    setFile(null);
    try {
      if (!next) return;
      if (!next.size || next.size > CSV_LIMITS.bytes)
        throw new Error('Choose a nonempty UTF-8 CSV no larger than 1 MiB.');
      const parsed = parseLeadCsv(next.name, new Uint8Array(await next.arrayBuffer()));
      const mapped: Record<string, string> = {};
      for (const field of Object.keys(importFieldLabels)) {
        const index = parsed.headers.findIndex((header) => header.toLowerCase() === field);
        if (index >= 0) mapped[field] = String(index);
      }
      setMapping(mapped);
      setCsv(parsed);
      setFile(next);
    } catch (failure) {
      showError(failure instanceof Error ? failure.message : 'CSV could not be read.');
    } finally {
      stageFlight.current = false;
      setBusy(false);
    }
  }

  function input() {
    return {
      mapping: Object.fromEntries(
        Object.entries(mapping)
          .filter(([, value]) => value !== '')
          .map(([field, value]) => [field, Number(value)]),
      ),
      sourceCode: source,
      assignedUserId: owner || null,
      defaultInquiryOn: date,
    };
  }

  async function executeUpload(command: { metadata: ImportUpload; file: File }) {
    if (stageFlight.current) return;
    stageFlight.current = true;
    pending.current = command;
    setBusy(true);
    setError('');
    try {
      const response = await stageImport(command.metadata, command.file);
      pending.current = null;
      setUncertain(false);
      openBatch(response.batch.id);
    } catch (failure) {
      const retryable = !(failure instanceof ImportClientError) || failure.retryable;
      setUncertain(retryable);
      if (!retryable) pending.current = null;
      showError(
        failure instanceof Error
          ? failure.message
          : 'The upload result is uncertain. Retry the same upload.',
      );
    } finally {
      stageFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title="Import CSV"
        description="Preview inquiries, review duplicates and confirm lead creation. Original CSV files are not retained."
      />
      {initial.status === 'error' ? (
        <div className="space-y-3">
          <p role="alert">{initial.message}</p>
          <Button onClick={() => window.location.reload()}>Reload import options</Button>
        </div>
      ) : batchId ? (
        <>
          <LeadImportBatch key={batchId} batchId={batchId} onLock={lockBatch} />
          <Button
            variant="outline"
            disabled={batchLocked}
            onClick={() => {
              if (childGate.current) return;
              setBatchId('');
              setError('');
              const url = new URL(window.location.href);
              url.searchParams.delete('batchId');
              window.history.replaceState(null, '', `${url.pathname}${url.search}`);
            }}
          >
            Start another file
          </Button>
          <p className="text-sm text-muted-foreground">
            This saved batch remains in history. Copy its batch ID or bookmark this page to reopen
            it.
          </p>
        </>
      ) : (
        <>
          <DetailSection
            id="import-file"
            title="Choose and map CSV"
            description="UTF-8, comma-separated; maximum 1 MiB, 500 rows and 40 columns. Dates use YYYY-MM-DD. Phones need an international + prefix. AED budgets use plain decimal amounts."
          >
            {error && (
              <p ref={errorRef} tabIndex={-1} role="alert" className="mb-4">
                {error}
              </p>
            )}
            {busy && (
              <p role="status" className="mb-4">
                Reading or staging CSV…
              </p>
            )}
            <fieldset aria-label="CSV import settings" disabled={locked} className="space-y-5">
              <FormField label="CSV file" disabled={locked}>
                {(control) => (
                  <Input
                    {...control}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => void chooseFile(event.target.files?.[0])}
                  />
                )}
              </FormField>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Lead source" required disabled={locked}>
                  {(control) => (
                    <NativeSelect
                      {...control}
                      value={source}
                      onChange={(event) => updateDraft(() => setSource(event.target.value))}
                    >
                      <option value="">Choose a source</option>
                      {options?.sources
                        .filter((s) => s.active)
                        .map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField
                  label="Assigned employee"
                  disabled={locked || !companyAssignment}
                  description={
                    companyAssignment
                      ? 'Choose an active Sales owner or leave unassigned.'
                      : 'Your account must be the active Sales owner.'
                  }
                >
                  {(control) => (
                    <NativeSelect
                      {...control}
                      value={owner}
                      onChange={(event) => updateDraft(() => setOwner(event.target.value))}
                    >
                      {companyAssignment && <option value="">Unassigned</option>}
                      {options?.owners
                        .filter((o) => companyAssignment || o.id === snapshot.userId)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField
                  label="Default inquiry date"
                  required
                  disabled={locked}
                  description="Used only when the inquiry-date column is unmapped."
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      value={date}
                      onChange={(event) => updateDraft(() => setDate(event.target.value))}
                    />
                  )}
                </FormField>
              </div>

              {csv && (
                <div className="space-y-4">
                  <p className="text-sm">
                    {file?.name}: {csv.rows.length} data records. Empty records ignored:{' '}
                    {csv.ignoredBlankRecords}.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(importFieldLabels).map(([field, label]) => (
                      <FormField
                        key={field}
                        label={`Map ${label}`}
                        required={field === 'customer_name'}
                        disabled={locked}
                      >
                        {(control) => (
                          <NativeSelect
                            {...control}
                            value={mapping[field] ?? ''}
                            onChange={(event) =>
                              updateDraft(() =>
                                setMapping({ ...mapping, [field]: event.target.value }),
                              )
                            }
                          >
                            <option value="">
                              {field === 'customer_name' ? 'Choose a column' : 'Not mapped'}
                            </option>
                            {csv.headers.map((header, index) => (
                              <option key={index} value={String(index)}>
                                {index + 1}: {header}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                      </FormField>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={!csv || locked}
                  onClick={() => {
                    if (!csv || stageFlight.current) return;
                    try {
                      setPreview(previewLeadImport(csv, input()));
                      setPreviewPage(0);
                      setError('');
                    } catch {
                      showError(
                        'Choose the customer-name column, unique mappings and valid batch defaults.',
                      );
                    }
                  }}
                >
                  Preview CSV
                </Button>
                <Button
                  disabled={!preview || !file || locked}
                  onClick={() => {
                    if (!file || !preview || stageFlight.current) return;
                    const metadata = importUploadSchema.safeParse({
                      ...input(),
                      requestId: crypto.randomUUID(),
                      filename: file.name,
                    });
                    if (!metadata.success) {
                      showError('Review the mapping and batch defaults.');
                      return;
                    }
                    void executeUpload({ metadata: metadata.data, file });
                  }}
                >
                  Stage for review
                </Button>
              </div>
            </fieldset>

            {uncertain && (
              <div className="mt-4 space-y-3">
                <p role="status">
                  Keep this page open. The original file, mapping and request ID are preserved for
                  retry.
                </p>
                <Button
                  loading={busy}
                  onClick={() => {
                    if (pending.current) void executeUpload(pending.current);
                  }}
                >
                  Retry same upload
                </Button>
              </div>
            )}
          </DetailSection>

          {preview && (
            <DetailSection
              id="import-preview"
              title="Local preview"
              description="No leads or batch records have been created yet. Database matches are checked after staging."
            >
              <p className="mb-4 text-sm">
                Total {preview.counts.total} · Ready {preview.counts.ready} · Invalid{' '}
                {preview.counts.invalid} · Review {preview.counts.review}
              </p>
              <LeadImportRows
                rows={preview.rows.slice(previewPage * 20, (previewPage + 1) * 20).map((row) => ({
                  rowNumber: row.rowNumber,
                  data: row.data,
                  status: row.status,
                  errors: row.errors.map(
                    (error) => `${error.field.replaceAll('_', ' ')}: ${error.message}`,
                  ),
                  duplicateRows: row.possibleDuplicateRows,
                }))}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={locked || previewPage === 0}
                  onClick={() => setPreviewPage(previewPage - 1)}
                >
                  Previous preview page
                </Button>
                <Button
                  variant="outline"
                  disabled={locked || (previewPage + 1) * 20 >= preview.counts.total}
                  onClick={() => setPreviewPage(previewPage + 1)}
                >
                  Next preview page
                </Button>
              </div>
            </DetailSection>
          )}

          <DetailSection
            id="import-resume"
            title="Open a saved batch"
            description="Saved batches are private to their importing employee. Drafts and uncertain requests stay in memory only."
          >
            <FormField label="Saved batch ID" disabled={locked}>
              {(control) => (
                <Input
                  {...control}
                  value={resumeId}
                  maxLength={36}
                  onChange={(event) => setResumeId(event.target.value)}
                />
              )}
            </FormField>
            <Button
              className="mt-3"
              disabled={locked}
              onClick={() => {
                if (stageFlight.current || pending.current) return;
                const parsed = importPageInputSchema.safeParse({
                  batchId: resumeId.trim(),
                  page: 0,
                });
                if (!parsed.success) {
                  showError('Enter a valid saved batch ID.');
                  return;
                }
                setError('');
                openBatch(parsed.data.batchId);
              }}
            >
              Open saved batch
            </Button>
          </DetailSection>
        </>
      )}
    </div>
  );
}
