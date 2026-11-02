export type FileTypeRule = {
  label: string;
  mimeType: string;
  extensions: readonly string[];
};

export type SelectedBrowserFile = {
  id: string;
  file: File;
  previewUrl?: string;
};

export const DEFAULT_FILE_TYPES: readonly FileTypeRule[] = [
  {
    label: 'PNG',
    mimeType: 'image/png',
    extensions: ['.png'],
  },
  {
    label: 'JPEG',
    mimeType: 'image/jpeg',
    extensions: ['.jpg', '.jpeg'],
  },
  {
    label: 'WebP',
    mimeType: 'image/webp',
    extensions: ['.webp'],
  },
  {
    label: 'PDF',
    mimeType: 'application/pdf',
    extensions: ['.pdf'],
  },
];

const IMAGE_PREVIEW_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const formatter = new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 1,
  });

  if (bytes < 1024 * 1024) {
    return `${formatter.format(bytes / 1024)} KiB`;
  }

  return `${formatter.format(bytes / (1024 * 1024))} MiB`;
}

export function browserFileKey(file: File): string {
  return JSON.stringify([file.name, file.size, file.lastModified, file.type]);
}

export function canPreviewBrowserImage(file: File): boolean {
  return IMAGE_PREVIEW_TYPES.includes(file.type.toLowerCase());
}

export function validateBrowserFile(
  file: File,
  {
    maxFileBytes,
    allowedTypes,
  }: {
    maxFileBytes: number;
    allowedTypes: readonly FileTypeRule[];
  },
): string | null {
  if (file.size === 0) {
    return `${file.name} is empty. Choose a file with content.`;
  }

  if (file.size > maxFileBytes) {
    return `${file.name} exceeds the ${formatFileSize(maxFileBytes)} limit.`;
  }

  const dotIndex = file.name.lastIndexOf('.');
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';

  const mimeType = file.type.toLowerCase();

  const matchedRule = allowedTypes.find(
    (rule) =>
      rule.extensions.some((item) => item.toLowerCase() === extension) &&
      (!mimeType || rule.mimeType.toLowerCase() === mimeType),
  );

  if (!matchedRule) {
    return `${file.name}: the file type or extension is not accepted.`;
  }

  return null;
}
