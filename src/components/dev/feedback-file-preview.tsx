'use client';

import { useRef, useState } from 'react';
import { FilePicker } from '@/components/files/file-picker';
import { DetailSection } from '@/components/layout/detail-section';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { useToast } from '@/components/ui/toast-provider';

export function FeedbackFilePreview() {
  const { notify, clear, count } = useToast();

  const informationButtonRef = useRef<HTMLButtonElement>(null);

  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <>
      <DetailSection
        id="notification-examples"
        title="Notifications"
        description="Examples remain visible until dismissed. Up to three are shown at a time."
      >
        <InlineNotice title="Local feedback" tone="info">
          <p>These buttons demonstrate notification styles without changing CRM records.</p>
        </InlineNotice>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            ref={informationButtonRef}
            type="button"
            variant="outline"
            onClick={() =>
              notify({
                title: 'Preview information',
                description: 'This notification stays visible until you dismiss it.',
                tone: 'info',
              })
            }
          >
            Show information
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              notify({
                title: 'Local preview complete',
                description: 'This notification was created locally. No CRM record was changed.',
                tone: 'success',
              })
            }
          >
            Show success
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              notify({
                title: 'Review sample information',
                description: 'An example warning for this component preview.',
                tone: 'warning',
              })
            }
          >
            Show warning
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={count === 0}
            onClick={() => {
              clear();
              informationButtonRef.current?.focus();
            }}
          >
            Dismiss all notifications
          </Button>
        </div>
      </DetailSection>

      <DetailSection
        id="file-selection-example"
        title="File selection and preview"
        description="Select fictional reference images or documents from your device."
      >
        <FilePicker
          id="reference-files"
          label="Reference files"
          description="Files stay in this page until cleared or refreshed."
          maxFiles={3}
          maxFileBytes={2 * 1024 * 1024}
          onFilesChange={(files) => setSelectedCount(files.length)}
        />

        <div className="mt-5 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={selectedCount === 0}
            onClick={() =>
              notify({
                title: 'Files selected locally',
                description: `${selectedCount} file${
                  selectedCount === 1 ? '' : 's'
                } selected. Nothing has been uploaded.`,
                tone: 'info',
              })
            }
          >
            Show selection notice
          </Button>
        </div>
      </DetailSection>
    </>
  );
}
