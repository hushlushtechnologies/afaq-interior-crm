'use client';

import { FileText, Upload, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { FilePreviewDialog } from '@/components/files/file-preview-dialog';
import { LocalImagePreview } from '@/components/files/local-image-preview';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { InlineNotice } from '@/components/ui/inline-notice';
import {
  browserFileKey,
  canPreviewBrowserImage,
  DEFAULT_FILE_TYPES,
  formatFileSize,
  validateBrowserFile,
  type FileTypeRule,
  type SelectedBrowserFile,
} from '@/lib/forms/file-selection';
import { cn } from '@/lib/utils';

type FilePickerProps = {
  id?: string;
  label: string;
  description?: string;
  maxFiles?: number;
  maxFileBytes?: number;
  allowedTypes?: readonly FileTypeRule[];
  disabled?: boolean;
  onFilesChange?: (files: File[]) => void;
};

export function FilePicker({
  id,
  label,
  description,
  maxFiles = 5,
  maxFileBytes = 10 * 1024 * 1024,
  allowedTypes = DEFAULT_FILE_TYPES,
  disabled = false,
  onFilesChange,
}: FilePickerProps) {
  const generatedId = useId();
  const fieldId = id ?? `files-${generatedId}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const previewReturnRef = useRef<HTMLButtonElement | null>(null);

  const selectionRef = useRef<SelectedBrowserFile[]>([]);
  const objectUrls = useRef(new Set<string>());

  const [entries, setEntries] = useState<SelectedBrowserFile[]>([]);

  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    const trackedUrls = objectUrls.current;

    return () => {
      for (const url of trackedUrls) {
        URL.revokeObjectURL(url);
      }

      trackedUrls.clear();
    };
  }, []);

  function publishSelection(next: SelectedBrowserFile[]) {
    selectionRef.current = next;
    setEntries(next);
    onFilesChange?.(next.map((entry) => entry.file));
  }

  function releasePreview(entry: SelectedBrowserFile) {
    if (!entry.previewUrl) {
      return;
    }

    URL.revokeObjectURL(entry.previewUrl);
    objectUrls.current.delete(entry.previewUrl);
  }

  function addFiles(candidates: File[]) {
    if (disabled || !candidates.length) {
      return;
    }

    const next = [...selectionRef.current];
    const keys = new Set(next.map((entry) => browserFileKey(entry.file)));

    const nextErrors: string[] = [];
    let addedCount = 0;

    for (const file of candidates) {
      const validationError = validateBrowserFile(file, {
        maxFileBytes,
        allowedTypes,
      });

      if (validationError) {
        nextErrors.push(validationError);
        continue;
      }

      const key = browserFileKey(file);

      if (keys.has(key)) {
        nextErrors.push(`${file.name} is already selected.`);
        continue;
      }

      if (next.length >= maxFiles) {
        nextErrors.push(`Only ${maxFiles} files can be selected.`);
        continue;
      }

      let previewUrl: string | undefined;

      if (canPreviewBrowserImage(file)) {
        previewUrl = URL.createObjectURL(file);
        objectUrls.current.add(previewUrl);
      }

      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
      });

      keys.add(key);
      addedCount += 1;
    }

    setErrors([...new Set(nextErrors)]);

    if (addedCount) {
      publishSelection(next);

      setMessage(
        `${addedCount} file${addedCount === 1 ? '' : 's'} selected locally. Nothing has been uploaded.`,
      );
    } else {
      setMessage(null);
    }
  }

  function removeFile(idToRemove: string) {
    if (disabled) {
      return;
    }

    const entry = selectionRef.current.find((item) => item.id === idToRemove);

    if (!entry) {
      return;
    }

    releasePreview(entry);

    publishSelection(selectionRef.current.filter((item) => item.id !== idToRemove));

    if (previewId === idToRemove) {
      setPreviewId(null);
    }

    setErrors([]);
    setMessage(`${entry.file.name} removed from the local selection.`);
    inputRef.current?.focus();
  }

  function clearFiles() {
    if (disabled) {
      return;
    }

    for (const entry of selectionRef.current) {
      releasePreview(entry);
    }

    publishSelection([]);
    setPreviewId(null);
    setErrors([]);
    setMessage('File selection cleared. Nothing has been uploaded.');

    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!disabled) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  const previewEntry = entries.find((entry) => entry.id === previewId);

  const totalBytes = entries.reduce((total, entry) => total + entry.file.size, 0);

  const acceptedLabels = allowedTypes.map((rule) => rule.label).join(', ');

  const accept = allowedTypes.flatMap((rule) => [rule.mimeType, ...rule.extensions]).join(',');

  const describedBy = [`${fieldId}-description`, errors.length ? `${fieldId}-error` : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="group" aria-labelledby={`${fieldId}-label`} className="min-w-0 space-y-4">
      <div className="space-y-2">
        <p id={`${fieldId}-label`} className="text-sm font-medium text-foreground">
          {label}
        </p>

        <p id={`${fieldId}-description`} className="text-sm leading-6 text-muted-foreground">
          {description ? `${description} ` : ''}
          Accepted files: {acceptedLabels}. Maximum {maxFiles} files, {formatFileSize(maxFileBytes)}{' '}
          each.
        </p>
      </div>

      <div
        data-testid="file-dropzone"
        onDragEnter={(event) => {
          event.preventDefault();

          if (!disabled && event.dataTransfer.types.includes('Files')) {
            setDragActive(true);
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={(event) => {
          const nextTarget = event.relatedTarget;

          if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
            return;
          }

          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);

          if (!disabled) {
            addFiles(Array.from(event.dataTransfer.files));
          }
        }}
      >
        <input
          ref={inputRef}
          id={fieldId}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          aria-labelledby={`${fieldId}-label`}
          aria-describedby={describedBy}
          aria-invalid={errors.length ? true : undefined}
          onChange={(event) => {
            addFiles(Array.from(event.currentTarget.files ?? []));

            event.currentTarget.value = '';
          }}
          className="peer sr-only"
        />

        <label
          htmlFor={fieldId}
          className={cn(
            'flex min-h-36 flex-col items-center justify-center gap-3 rounded-control border-2 border-dashed p-5 text-center transition-colors',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring',
            'motion-reduce:transition-none',
            dragActive ? 'border-accent bg-accent-soft' : 'border-input bg-background',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted',
          )}
        >
          <Icon icon={Upload} size="lg" className="text-muted-foreground" />

          <span className="text-sm font-semibold text-foreground">
            Choose files or drop them here
          </span>

          <span className="text-xs leading-5 text-muted-foreground">
            Local selection only · no upload
          </span>
        </label>
      </div>

      {errors.length ? (
        <InlineNotice
          id={`${fieldId}-error`}
          role="alert"
          title="Some files were not selected"
          tone="destructive"
        >
          <ul className="list-disc space-y-1 pl-5">
            {errors.slice(0, 5).map((error) => (
              <li key={error} className="break-all">
                {error}
              </li>
            ))}
          </ul>

          {errors.length > 5 ? (
            <p className="mt-2">{errors.length - 5} additional selection errors.</p>
          ) : null}
        </InlineNotice>
      ) : null}

      {message ? (
        <p role="status" className="break-words text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p data-testid="selected-file-count" className="text-sm font-semibold text-foreground">
            {entries.length} of {maxFiles} files selected
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Total selected size: {formatFileSize(totalBytes)}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !entries.length}
          onClick={clearFiles}
        >
          Clear selected files
        </Button>
      </div>

      {entries.length ? (
        <ul aria-label="Selected files" className="grid min-w-0 gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="min-w-0 rounded-control border border-border bg-background p-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                {entry.previewUrl ? (
                  <LocalImagePreview url={entry.previewUrl} fileName={entry.file.name} compact />
                ) : (
                  <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-control border border-border bg-muted">
                    <Icon icon={FileText} className="text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-semibold text-foreground">
                    {entry.file.name}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatFileSize(entry.file.size)}
                  </p>

                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {entry.file.type || 'Type not supplied'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Preview ${entry.file.name}`}
                  onClick={(event) => {
                    previewReturnRef.current = event.currentTarget;

                    setPreviewId(entry.id);
                  }}
                >
                  Preview
                </Button>

                <IconButton
                  type="button"
                  label={`Remove ${entry.file.name}`}
                  icon={X}
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => removeFile(entry.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No files selected"
          description="Choose a file above or drop files into the selection area."
        />
      )}

      <FilePreviewDialog
        entry={previewEntry}
        onClose={() => setPreviewId(null)}
        returnFocusRef={previewReturnRef}
      />
    </div>
  );
}
