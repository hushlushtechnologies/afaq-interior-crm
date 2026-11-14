'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/forms/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { DetailSection } from '@/components/layout/detail-section';
import { Button, buttonClassName } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { submitQuotationDraft } from '@/features/quotations/actions';
import type { QuotationRecord } from '@/features/quotations/contracts';
import { calculateQuotation } from '@/features/quotations/pricing';
import { quotationMoney, type QuotationContext } from '@/features/quotations/query-contracts';
import {
  PRICING_POLICY_ID,
  quotationDraftSchema,
  type Discount,
  type QuotationDraft,
  type PricingInput,
} from '@/features/quotations/schemas';

type Item = Omit<PricingInput['items'][number], 'tax'> & {
  tax: PricingInput['items'][number]['tax'] | null;
};
type Editor = Omit<QuotationDraft, 'pricing'> & {
  pricing: Omit<PricingInput, 'items'> & { items: Item[] };
};

function Field({
  label, value, onChange, type = 'text', multiline = false, maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <FormField label={label}>
      {(props) => multiline
        ? <Textarea {...props} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
        : <Input {...props} type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}
    </FormField>
  );
}

function DiscountControl({
  label, value, onChange,
}: {
  label: string;
  value: Discount;
  onChange: (value: Discount) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label={`${label} mode`}>
        {(props) => (
          <NativeSelect {...props} value={value.mode} onChange={(event) => onChange(
            event.target.value === 'fixed'
              ? { mode: 'fixed', amount: '' }
              : event.target.value === 'percent'
                ? { mode: 'percent', rate: '' }
                : { mode: 'none' },
          )}>
            <option value="none">No discount</option>
            <option value="fixed">Fixed AED</option>
            <option value="percent">Percentage</option>
          </NativeSelect>
        )}
      </FormField>
      {value.mode !== 'none' && (
        <Field
          label={`${label} ${value.mode === 'fixed' ? '(AED)' : '(%)'}`}
          value={value.mode === 'fixed' ? value.amount : value.rate}
          onChange={(amount) => onChange(
            value.mode === 'fixed' ? { mode: 'fixed', amount } : { mode: 'percent', rate: amount },
          )}
        />
      )}
    </div>
  );
}

export function QuotationBuilder({
  context, record, today,
}: {
  context: QuotationContext;
  record: QuotationRecord | null;
  today: string;
}) {
  const router = useRouter();
  const writable = record ? context.canEdit : context.canCreate;
  const [draft, setDraft] = useState<Editor>(() => ({
    ...(record?.document ?? {
      title: '',
      quotationDate: today,
      validUntil: null,
      companyVatNumber: null,
      clientNotes: null,
      internalNotes: null,
      terms: null,
      paymentTerms: null,
      sections: [],
      pricing: {
        policyId: PRICING_POLICY_ID,
        currency: 'AED',
        items: [],
        overallDiscount: { mode: 'none' },
      },
    }),
    requestId: '',
    quotationId: record?.id ?? null,
    expectedVersion: record?.version ?? null,
    leadId: context.leadId,
  }));

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [dirty, setDirty] = useState(false);
  const gate = useRef(false);
  const pending = useRef<QuotationDraft | null>(null);
  const changed = useRef(false);
  const frozen = busy || uncertain || !writable;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changed.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  function update(change: (value: Editor) => Editor) {
    if (frozen || gate.current) return;
    setDraft(change);
    setDirty(true);
    changed.current = true;
    setMessage('');
  }

  function patchItem(index: number, patch: Partial<Item>) {
    update((value) => ({
      ...value,
      pricing: {
        ...value.pricing,
        items: value.pricing.items.map((item, i) => i === index ? { ...item, ...patch } : item),
      },
    }));
  }

  function moveItem(index: number, direction: number) {
    update((value) => {
      const items = [...value.pricing.items];
      [items[index], items[index + direction]] = [items[index + direction], items[index]];
      return { ...value, pricing: { ...value.pricing, items } };
    });
  }

  let calculation: ReturnType<typeof calculateQuotation> | null = null;
  try {
    calculation = calculateQuotation(draft.pricing);
  } catch {
    /* Incomplete inputs have no calculated preview. */
  }

  async function save() {
    if (gate.current || !writable) return;

    if (!pending.current) {
      const parsed = quotationDraftSchema.safeParse({ ...draft, requestId: crypto.randomUUID() });
      if (!parsed.success) {
        setMessage(`Check ${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message}`);
        return;
      }
      // Leave room for the Server Action envelope below Next.js's request limit.
      if (new TextEncoder().encode(JSON.stringify(parsed.data)).length > 400000) {
        setMessage('This draft is too large to save. Shorten notes or item descriptions.');
        return;
      }
      try {
        calculateQuotation(parsed.data.pricing);
      } catch {
        setMessage('Check quantities, prices, discounts and tax rates before saving.');
        return;
      }
      pending.current = parsed.data;
    }

    gate.current = true;
    setBusy(true);
    setMessage('Saving draft…');
    let navigating = false;

    try {
      const result = await submitQuotationDraft(pending.current);
      if (result.status === 'ok') {
        changed.current = false;
        setDirty(false);
        setMessage('Saved. Loading the current draft…');
        router.replace(`/quotations/${result.data.id}`);
        router.refresh();
        navigating = true;
        return;
      }
      setMessage(result.message);
      if (result.retryable || uncertain) setUncertain(true);
      else pending.current = null;
    } catch {
      setUncertain(true);
      setMessage('Save outcome is unknown. Keep this page open and retry the unchanged save.');
    } finally {
      if (!navigating) {
        gate.current = false;
        setBusy(false);
      }
    }
  }

  const textFields = [
    'companyVatNumber', 'clientNotes', 'internalNotes', 'terms', 'paymentTerms',
  ] as const;
  const labels = {
    companyVatNumber: 'Company VAT registration number',
    clientNotes: 'Client-facing notes',
    internalNotes: 'Internal notes',
    terms: 'Terms and conditions',
    paymentTerms: 'Payment terms',
  };

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title={record?.number ?? 'Create quotation'}
        eyebrow="Quotations"
        description={`${context.customer.customerName} · Lead #${context.customer.leadReference}`}
      />
      <nav aria-label="Quotation navigation" className="flex flex-wrap gap-3">
        <Link className={buttonClassName({ variant: 'outline' })} href="/quotations" onClick={(event) => {
          if (busy || uncertain || (changed.current && !window.confirm('Leave without saving your changes?'))) event.preventDefault();
        }}>
          All quotations
        </Link>
        {context.canReadLead && (
          <Link className={buttonClassName({ variant: 'outline' })} href={`/leads/details/${context.leadId}`} onClick={(event) => {
            if (busy || uncertain || (changed.current && !window.confirm('Leave without saving your changes?'))) event.preventDefault();
          }}>
            Lead details
          </Link>
        )}
      </nav>

      <p className="text-sm text-muted-foreground">
        Draft quotation. It has not been approved or sent.
        {record ? ` Revision ${record.revision} · Saved draft version ${record.version}.` : ''}
      </p>
      {!writable && (
        <p role="status" className="rounded-control bg-muted p-4">
          Read-only quotation. Your current access or the lead status prevents editing.
        </p>
      )}

      <DetailSection id="quote-customer" title="Customer and project">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {Object.entries({
            Customer: context.customer.customerName,
            Email: context.customer.email,
            Phone: context.customer.phone,
            'Property type': context.customer.propertyType,
            Location: context.customer.location,
            Owner: context.ownerName ?? 'Unassigned',
          }).map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value ?? 'Not recorded'}</dd>
            </div>
          ))}
        </dl>
        {context.requirements && (
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">Collected requirements</summary>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm">{context.requirements}</p>
          </details>
        )}
      </DetailSection>

      <form onSubmit={(event) => { event.preventDefault(); void save(); }} noValidate className="space-y-6">
        <fieldset disabled={frozen} className="min-w-0 space-y-6">
          <legend className="sr-only">Quotation draft fields</legend>

          <DetailSection id="quote-header" title="Quotation information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quotation title" value={draft.title} maxLength={160} onChange={(title) => update((value) => ({ ...value, title }))} />
              <FormField label="Currency">
                {(props) => <Input {...props} value="AED" readOnly />}
              </FormField>
              <Field label="Quotation date" type="date" value={draft.quotationDate} onChange={(quotationDate) => update((value) => ({ ...value, quotationDate }))} />
              <Field label="Valid until (optional)" type="date" value={draft.validUntil ?? ''} onChange={(validUntil) => update((value) => ({ ...value, validUntil: validUntil || null }))} />
            </div>
          </DetailSection>

          <DetailSection id="quote-sections" title="Room and work sections" description="Use your own section names; linking a collected room is optional.">
            {context.roomsTruncated && (
              <p className="mb-3 text-sm">Showing the first 200 active rooms. Custom section names are also available.</p>
            )}
            <div className="space-y-4">
              {draft.sections.map((section, index) => (
                <fieldset key={section.id} className="space-y-3 rounded-control border border-border p-4">
                  <legend className="px-1 text-sm font-semibold">Section {index + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Section name" value={section.name} maxLength={160} onChange={(name) => update((value) => ({
                      ...value,
                      sections: value.sections.map((s) => s.id === section.id ? { ...s, name } : s),
                    }))} />
                    <FormField label="Linked room">
                      {(props) => (
                        <NativeSelect {...props} value={section.roomId ?? ''} onChange={(event) => {
                          const roomId = event.target.value || null;
                          update((value) => ({
                            ...value,
                            sections: value.sections.map((s) => s.id === section.id
                              ? { ...s, roomId, name: s.name || context.rooms.find((room) => room.id === roomId)?.name || '' }
                              : s),
                          }));
                        }}>
                          <option value="">No room link</option>
                          {section.roomId && !context.rooms.some((room) => room.id === section.roomId) && (
                            <option value={section.roomId}>Previously linked room — remove unavailable link</option>
                          )}
                          {context.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                        </NativeSelect>
                      )}
                    </FormField>
                  </div>
                  <Button variant="outline" onClick={() => update((value) => ({
                    ...value,
                    sections: value.sections.filter((s) => s.id !== section.id),
                    pricing: {
                      ...value.pricing,
                      items: value.pricing.items.map((item) => item.sectionId === section.id ? { ...item, sectionId: null } : item),
                    },
                  }))}>
                    Remove section {index + 1}
                  </Button>
                </fieldset>
              ))}
            </div>
            <Button className="mt-4" variant="outline" disabled={frozen || draft.sections.length >= 50} onClick={() => update((value) => ({
              ...value,
              sections: [...value.sections, { id: crypto.randomUUID(), name: '', roomId: null }],
            }))}>
              Add section
            </Button>
          </DetailSection>

          <DetailSection id="quote-items" title="Quotation items" description="Unit prices exclude VAT. Discounts apply before VAT. Select the applicable tax treatment for each item.">
            {draft.pricing.items.length === 0 && (
              <p className="text-sm text-muted-foreground">No items yet. You may save an empty draft.</p>
            )}
            <div className="space-y-5">
              {draft.pricing.items.map((item, index) => (
                <fieldset key={item.id} className="min-w-0 space-y-4 rounded-control border border-border p-4">
                  <legend className="px-1 font-semibold">Item {index + 1}</legend>
                  <Field label="Description" value={item.description} maxLength={2000} multiline onChange={(description) => patchItem(index, { description })} />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FormField label="Section">
                      {(props) => (
                        <NativeSelect {...props} value={item.sectionId ?? ''} onChange={(event) => patchItem(index, { sectionId: event.target.value || null })}>
                          <option value="">Ungrouped</option>
                          {draft.sections.map((section, i) => (
                            <option key={section.id} value={section.id}>{section.name || `Section ${i + 1}`}</option>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                    <Field label="Quantity" value={item.quantity} onChange={(quantity) => patchItem(index, { quantity })} />
                    <Field label="Unit" value={item.unit} maxLength={40} onChange={(unit) => patchItem(index, { unit })} />
                    <Field label="Unit price (AED)" value={item.unitPrice} onChange={(unitPrice) => patchItem(index, { unitPrice })} />
                  </div>
                  <DiscountControl label="Line discount" value={item.discount} onChange={(discount) => patchItem(index, { discount })} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Tax treatment">
                      {(props) => (
                        <NativeSelect {...props} value={item.tax?.treatment ?? ''} onChange={(event) => patchItem(index, {
                          tax: event.target.value === 'taxable'
                            ? { treatment: 'taxable', rate: '' }
                            : event.target.value === 'zero_rated'
                              ? { treatment: 'zero_rated' }
                              : event.target.value === 'exempt'
                                ? { treatment: 'exempt' }
                                : null,
                        })}>
                          <option value="">Select tax treatment</option>
                          <option value="taxable">Taxable — enter rate</option>
                          <option value="zero_rated">Zero-rated</option>
                          <option value="exempt">Exempt</option>
                        </NativeSelect>
                      )}
                    </FormField>
                    {item.tax?.treatment === 'taxable' && (
                      <Field label="VAT rate (%)" value={item.tax.rate} onChange={(rate) => patchItem(index, { tax: { treatment: 'taxable', rate } })} />
                    )}
                  </div>
                  {calculation && (
                    <p className="text-sm font-semibold">Line total: {quotationMoney(calculation.lines[index].total)}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={frozen || index === 0} onClick={() => moveItem(index, -1)}>
                      Move item {index + 1} up
                    </Button>
                    <Button variant="outline" disabled={frozen || index === draft.pricing.items.length - 1} onClick={() => moveItem(index, 1)}>
                      Move item {index + 1} down
                    </Button>
                    <Button variant="outline" onClick={() => update((value) => ({
                      ...value,
                      pricing: { ...value.pricing, items: value.pricing.items.filter((_, i) => i !== index) },
                    }))}>
                      Remove item {index + 1}
                    </Button>
                  </div>
                </fieldset>
              ))}
            </div>
            <Button className="mt-4" variant="outline" disabled={frozen || draft.pricing.items.length >= 200} onClick={() => update((value) => ({
              ...value,
              pricing: {
                ...value.pricing,
                items: [...value.pricing.items, {
                  id: crypto.randomUUID(),
                  sectionId: null,
                  description: '',
                  quantity: '1',
                  unit: '',
                  unitPrice: '0',
                  discount: { mode: 'none' },
                  tax: null,
                }],
              },
            }))}>
              Add item
            </Button>
          </DetailSection>

          <DetailSection id="quote-commercial" title="Discount and terms">
            <DiscountControl label="Overall discount" value={draft.pricing.overallDiscount} onChange={(overallDiscount) => update((value) => ({
              ...value, pricing: { ...value.pricing, overallDiscount },
            }))} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {textFields.map((key) => (
                <Field key={key} label={labels[key]} value={draft[key] ?? ''} multiline={key !== 'companyVatNumber'} maxLength={key === 'companyVatNumber' ? 32 : key === 'terms' ? 8000 : 4000} onChange={(text) => update((value) => ({
                  ...value, [key]: text || null,
                }))} />
              ))}
            </div>
          </DetailSection>
        </fieldset>

        <DetailSection id="quote-totals" title="Quotation totals">
          {calculation ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2" aria-live="polite">
              {Object.entries({
                Subtotal: calculation.totals.subtotal,
                'Line discounts': calculation.totals.lineDiscount,
                'Overall discount': calculation.totals.overallDiscount,
                'Net amount': calculation.totals.net,
                VAT: calculation.totals.tax,
                'Grand total': calculation.totals.grandTotal,
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{quotationMoney(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p role="status">Complete valid quantities, prices, discounts and tax treatments to calculate totals.</p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {dirty ? 'Unsaved changes.' : 'No unsaved changes.'} Totals are checked again when saving.
          </p>
          {message && <p role="alert" className="mt-3 break-words text-sm">{message}</p>}
          {uncertain && (
            <p className="mt-3 text-sm">Keep this page open. Editing is paused until the original save is confirmed.</p>
          )}
          {writable && (
            <Button type="submit" className="mt-4" loading={busy}>
              {uncertain ? 'Retry unchanged save' : 'Save draft'}
            </Button>
          )}
        </DetailSection>
      </form>
    </div>
  );
}