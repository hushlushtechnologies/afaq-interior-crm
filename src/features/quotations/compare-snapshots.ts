import { formatUnsignedDecimal, parseUnsignedDecimal } from './decimal';
import type { QuotationSnapshot } from './history-contracts';

export function compareQuotationSnapshots(before: QuotationSnapshot, after: QuotationSnapshot) {
  if (before.quotationId !== after.quotationId)
    throw new Error('Compare saves from the same quotation.');

  const fields = [
    'title',
    'quotationDate',
    'validUntil',
    'companyVatNumber',
    'clientNotes',
    'internalNotes',
    'terms',
    'paymentTerms',
    'sections',
  ] as const;

  const changes: Array<{ field: string; before: string; after: string }> = fields
    .filter(
      (field) => JSON.stringify(before.document[field]) !== JSON.stringify(after.document[field]),
    )
    .map((field) => ({
      field,
      before: JSON.stringify(before.document[field]),
      after: JSON.stringify(after.document[field]),
    }));

  if (
    JSON.stringify(before.document.pricing.overallDiscount) !==
    JSON.stringify(after.document.pricing.overallDiscount)
  )
    changes.push({
      field: 'overallDiscount',
      before: JSON.stringify(before.document.pricing.overallDiscount),
      after: JSON.stringify(after.document.pricing.overallDiscount),
    });

  const oldItems = new Map(
    before.document.pricing.items.map((item, index) => [item.id, { item, index }]),
  );

  const newItems = new Map(
    after.document.pricing.items.map((item, index) => [item.id, { item, index }]),
  );

  const ids = [...new Set([...oldItems.keys(), ...newItems.keys()])];

  const items = ids.flatMap((id) => {
    const old = oldItems.get(id);
    const next = newItems.get(id);

    const action = !old
      ? 'Added'
      : !next
        ? 'Removed'
        : JSON.stringify(old.item) !== JSON.stringify(next.item)
          ? old.index !== next.index
            ? 'Changed and reordered'
            : 'Changed'
          : old.index !== next.index
            ? 'Reordered'
            : null;

    return action
      ? [
          {
            id,
            description: next?.item.description ?? old!.item.description,
            action,
            before: old ? JSON.stringify(old.item) : 'Not present',
            after: next ? JSON.stringify(next.item) : 'Not present',
          },
        ]
      : [];
  });

  const keys = ['subtotal', 'lineDiscount', 'overallDiscount', 'net', 'tax', 'grandTotal'] as const;

  const totals = keys.map((field) => {
    const previous = before.calculation.totals[field],
      current = after.calculation.totals[field];

    const delta = parseUnsignedDecimal(current, 2) - parseUnsignedDecimal(previous, 2);

    return {
      field,
      before: previous,
      after: current,
      delta:
        delta === BigInt(0)
          ? '0.00'
          : `${delta < BigInt(0) ? '-' : '+'}${formatUnsignedDecimal(delta < BigInt(0) ? -delta : delta, 2)}`,
    };
  });

  return { changes, items, totals };
}