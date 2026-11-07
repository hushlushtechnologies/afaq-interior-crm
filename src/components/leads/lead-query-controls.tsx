'use client';

import { useRef, useState } from 'react';
import { FormField } from '@/components/forms/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Button } from '@/components/ui/button';
import { DEMO_STAGES } from '@/lib/demo/stages';
import { pipelineQuerySchema, type PipelineQuery } from '@/features/leads/query-schemas';

export function LeadQueryControls({
  query,
  owners,
  sources,
  disabled,
  onApply,
}: {
  query: PipelineQuery;
  owners: { id: string; name: string }[];
  sources: { code: string; name: string }[];
  disabled: boolean;
  onApply: (query: PipelineQuery) => void;
}) {
  const [draft, setDraft] = useState(query);
  const [error, setError] = useState('');
  const summary = useRef<HTMLParagraphElement>(null);

  const text = (key: 'search' | 'from' | 'to', label: string, type: string) => (
    <FormField
      id={`query-${key}`}
      label={label}
      disabled={disabled}
      description={
        key === 'search' ? 'Customer, email, phone, location or numeric lead reference.' : undefined
      }
    >
      {(control) => (
        <Input
          {...control}
          type={type}
          value={draft[key] ?? ''}
          maxLength={key === 'search' ? 100 : undefined}
          onChange={(event) =>
            setDraft({ ...draft, [key]: event.target.value || (key === 'search' ? '' : null) })
          }
        />
      )}
    </FormField>
  );

  return (
    <form
      aria-label="Filter leads"
      noValidate
      className="space-y-4 rounded-card border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;

        const parsed = pipelineQuerySchema.safeParse({ ...draft, page: 0 });

        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Review the filters.');
          requestAnimationFrame(() => summary.current?.focus());
          return;
        }

        setError('');
        onApply(parsed.data);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {text('search', 'Search leads', 'search')}

        <FormField id="query-stage" label="Stage filter" disabled={disabled}>
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.stage ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  stage: (event.target.value || null) as PipelineQuery['stage'],
                })
              }
            >
              <option value="">All stages</option>
              {DEMO_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField id="query-source" label="Source filter" disabled={disabled}>
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.source ?? ''}
              onChange={(event) => setDraft({ ...draft, source: event.target.value || null })}
            >
              <option value="">All sources</option>
              {draft.source && !sources.some((item) => item.code === draft.source) && (
                <option value={draft.source}>Selected source ({draft.source})</option>
              )}
              {sources.map((source) => (
                <option key={source.code} value={source.code}>
                  {source.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField id="query-owner" label="Owner filter" disabled={disabled}>
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.owner ?? ''}
              onChange={(event) => setDraft({ ...draft, owner: event.target.value || null })}
            >
              <option value="">All visible owners</option>
              <option value="unassigned">Unassigned</option>
              {draft.owner &&
                draft.owner !== 'unassigned' &&
                !owners.some((item) => item.id === draft.owner) && (
                  <option value={draft.owner}>Selected owner (not present in this view)</option>
                )}
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField id="query-priority" label="Priority filter" disabled={disabled}>
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.priority ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  priority: (event.target.value || null) as PipelineQuery['priority'],
                })
              }
            >
              <option value="">All priorities</option>
              {['low', 'normal', 'high', 'urgent'].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        {text('from', 'Inquiry from', 'date')}
        {text('to', 'Inquiry to', 'date')}

        <FormField id="query-size" label="Lead rows per page" disabled={disabled}>
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.pageSize}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  pageSize: Number(event.target.value) as PipelineQuery['pageSize'],
                })
              }
            >
              {[10, 20, 50].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField id="query-sort" label="Sort leads by" disabled={disabled}>
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.sort}
              onChange={(event) =>
                setDraft({ ...draft, sort: event.target.value as PipelineQuery['sort'] })
              }
            >
              {[
                ['created_at', 'Created date'],
                ['customer_name', 'Customer name'],
                ['reference', 'Lead reference'],
                ['budget', 'Budget'],
                ['inquiry_on', 'Inquiry date'],
                ['follow_up_on', 'Follow-up date'],
                ['priority', 'Priority'],
                ['source_code', 'Source'],
                ['owner', 'Owner'],
                ['stage', 'Stage'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField id="query-direction" label="Sort direction" disabled={disabled}>
          {(control) => (
            <NativeSelect
              {...control}
              value={draft.direction}
              onChange={(event) =>
                setDraft({ ...draft, direction: event.target.value as PipelineQuery['direction'] })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </NativeSelect>
          )}
        </FormField>
      </div>

      {error && (
        <p ref={summary} role="alert" tabIndex={-1}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={disabled}>
          Apply filters
        </Button>

        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            const cleared = pipelineQuerySchema.parse({ archived: query.archived });
            setDraft(cleared);
            setError('');
            onApply(cleared);
          }}
        >
          Clear lead filters
        </Button>
      </div>
    </form>
  );
}
