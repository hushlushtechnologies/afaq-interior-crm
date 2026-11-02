'use client';

import { useRef, useState, type FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { DetailSection } from '@/components/layout/detail-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export function OverlayLibraryPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [sampleLabel, setSampleLabel] = useState('Warm beige concept');
  const [draftLabel, setDraftLabel] = useState(sampleLabel);
  const [labelError, setLabelError] = useState<string | undefined>();

  const [drawerNote, setDrawerNote] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [feedback, setFeedback] = useState<string | null>(null);

  const labelInputRef = useRef<HTMLInputElement>(null);
  const drawerNoteRef = useRef<HTMLTextAreaElement>(null);

  function handleDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraftLabel(sampleLabel);
      setLabelError(undefined);
    }

    setDialogOpen(nextOpen);
  }

  function handleLabelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextLabel = draftLabel.trim();

    if (nextLabel.length < 2 || nextLabel.length > 60) {
      setLabelError('Enter a sample label between 2 and 60 characters.');
      labelInputRef.current?.focus();
      return;
    }

    setSampleLabel(nextLabel);
    setDialogOpen(false);

    setFeedback('Sample label updated on this page. Nothing was saved to a server.');
  }

  const tabItems: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Sample record overview</h3>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Fictional owner</dt>
              <dd className="mt-1 text-sm font-medium">Aisha Karim</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Sample source</dt>
              <dd className="mt-1 text-sm font-medium">Referral</dd>
            </div>
          </dl>
        </div>
      ),
    },
    {
      id: 'activity',
      label: 'Activity',
      content: (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Sample activity</h3>

          <ol className="space-y-3 text-sm text-foreground">
            <li className="border-l-2 border-border pl-3">Fictional inquiry received.</li>

            <li className="border-l-2 border-border pl-3">Sample requirements discussed.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'files',
      label: 'Files',
      disabled: true,
      content: (
        <p className="text-sm text-muted-foreground">
          File-selection examples will be added in Part 3.
        </p>
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      content: (
        <FormField
          id="tabbed-preview-note"
          label="Tabbed sample note"
          description="Switch tabs and return. The value stays until you leave or refresh this page."
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              rows={4}
              maxLength={1000}
              placeholder="Write a fictional note..."
            />
          )}
        </FormField>
      ),
    },
  ];

  return (
    <>
      <DetailSection
        id="dialog-examples"
        title="Dialogs and confirmations"
        description="Try keyboard navigation, Escape, cancellation, and focus restoration."
      >
        <div className="flex flex-wrap gap-3">
          <Dialog
            open={dialogOpen}
            onOpenChange={handleDialogOpenChange}
            title="Edit sample label"
            description="Apply a local change to this preview. No project or lead will be updated."
            initialFocusRef={labelInputRef}
            trigger={
              <Button type="button" variant="outline">
                Edit sample label
              </Button>
            }
            footer={
              <>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>

                <Button type="submit" form="sample-label-form">
                  Apply locally
                </Button>
              </>
            }
          >
            <form id="sample-label-form" noValidate onSubmit={handleLabelSubmit}>
              <FormField
                id="sample-label-input"
                label="Sample label"
                description="Use between 2 and 60 characters."
                required
                error={labelError}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    ref={labelInputRef}
                    value={draftLabel}
                    maxLength={60}
                    autoComplete="off"
                    onChange={(event) => {
                      setDraftLabel(event.target.value);
                      setLabelError(undefined);
                    }}
                  />
                )}
              </FormField>
            </form>
          </Dialog>

          <ConfirmationDialog
            open={confirmationOpen}
            onOpenChange={setConfirmationOpen}
            title="Preview removal?"
            description="Try a destructive confirmation prompt. Confirming shows a local message and does not delete a record."
            tone="destructive"
            confirmLabel="Confirm preview removal"
            trigger={
              <Button type="button" variant="destructive">
                Preview removal
              </Button>
            }
            onConfirm={() => {
              setConfirmationOpen(false);
              setFeedback('Removal preview confirmed. No record was deleted.');
            }}
          />
        </div>

        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Current sample label:{' '}
          <strong className="break-words font-semibold text-foreground">{sampleLabel}</strong>
        </p>

        {feedback ? (
          <div className="mt-5 rounded-control border border-border bg-info-soft p-4">
            <p role="status" className="text-sm leading-6 text-info">
              {feedback}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setFeedback(null)}
            >
              Dismiss preview message
            </Button>
          </div>
        ) : null}
      </DetailSection>

      <DetailSection
        id="drawer-example"
        title="Context drawer"
        description="A reusable side panel for supporting information and short forms."
      >
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title="Sample lead context"
          description="Fictional information and a note kept only on this page."
          initialFocusRef={drawerNoteRef}
          trigger={
            <Button type="button" variant="outline">
              Open sample drawer
            </Button>
          }
          footer={
            <Button type="button" onClick={() => setDrawerOpen(false)}>
              Done
            </Button>
          }
        >
          <div className="space-y-6">
            <div className="rounded-control border border-border bg-background p-4">
              <Badge tone="outline">Fictional record</Badge>

              <h3 className="mt-3 font-semibold text-foreground">Sample villa inquiry</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Warm neutral finishes, improved storage, and a consistent room-to-room style.
              </p>
            </div>

            <FormField
              id="drawer-preview-note"
              label="Drawer sample note"
              description="Closing and reopening preserves this local draft. Refreshing clears it."
            >
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  ref={drawerNoteRef}
                  rows={6}
                  maxLength={1000}
                  value={drawerNote}
                  onChange={(event) => setDrawerNote(event.target.value)}
                  placeholder="Write a fictional note..."
                />
              )}
            </FormField>
          </div>
        </Drawer>
      </DetailSection>

      <DetailSection
        id="tabs-example"
        title="Record tabs"
        description="Use Left and Right arrows, Home, or End. The disabled Files tab is skipped."
      >
        <Tabs
          label="Record preview sections"
          items={tabItems}
          value={selectedTab}
          onValueChange={setSelectedTab}
        />
      </DetailSection>
    </>
  );
}
