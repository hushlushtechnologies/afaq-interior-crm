export function fieldDescriptionIds(
  id: string,
  description?: string,
  error?: string,
  additionalIds?: string,
): string | undefined {
  const ids = [
    additionalIds,
    description ? `${id}-description` : undefined,
    error ? `${id}-error` : undefined,
  ].filter(Boolean);

  return ids.length ? ids.join(' ') : undefined;
}
