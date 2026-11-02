'use client';

import type { RefObject } from 'react';
import { LocalImagePreview } from '@/components/files/local-image-preview';
import { Dialog } from '@/components/ui/dialog';
import { InlineNotice } from '@/components/ui/inline-notice';
import { formatFileSize, type SelectedBrowserFile } from '@/lib/forms/file-selection';

type FilePreviewDialogProps = {
  entry: SelectedBrowserFile | undefined;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

export function FilePreviewDialog({ entry, onClose, returnFocusRef }: FilePreviewDialogProps) {
  return (
    <Dialog
      open={Boolean(entry)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Selected file preview"
      description="This preview uses a file from your device. Nothing has been uploaded."
      returnFocusRef={returnFocusRef}
    >
      {entry ? (
        <div className="min-w-0 space-y-5">
          <p className="break-all text-sm font-semibold text-foreground">{entry.file.name}</p>

          {entry.previewUrl ? (
            <LocalImagePreview key={entry.id} url={entry.previewUrl} fileName={entry.file.name} />
          ) : (
            <InlineNotice title="File information" tone="info">
              <p>
                This file is selected locally. Its document content is not rendered in this preview.
              </p>
            </InlineNotice>
          )}

          <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Browser-reported type</dt>

              <dd className="mt-1 break-all text-sm font-medium">
                {entry.file.type || 'Not supplied'}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">File size</dt>

              <dd className="mt-1 text-sm font-medium">{formatFileSize(entry.file.size)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </Dialog>
  );
}
