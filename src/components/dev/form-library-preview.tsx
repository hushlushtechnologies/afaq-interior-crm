'use client';

import { useState } from 'react';
import { FeedbackFilePreview } from '@/components/dev/feedback-file-preview';
import { OverlayLibraryPreview } from '@/components/dev/overlay-library-preview';
import { CheckboxField } from '@/components/forms/checkbox-field';
import { FormField } from '@/components/forms/form-field';
import { SampleInquiryForm } from '@/components/forms/sample-inquiry-form';
import { SwitchField } from '@/components/forms/switch-field';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';

export function FormLibraryPreview() {
  const [password, setPassword] = useState('');

  return (
    <div className="space-y-6 py-8">
      <PageHeader
        title="Component library"
        description="Reusable beige forms, overlays, feedback, and local file previews."
        actions={<Badge tone="warning">Development preview</Badge>}
      />

      <InlinePreviewIntroduction />

      <DetailSection
        id="sample-inquiry"
        title="Sample inquiry form"
        description="Try required fields, errors, radio buttons, a checkbox, and a switch."
      >
        <SampleInquiryForm />
      </DetailSection>

      <DetailSection
        id="password-control"
        title="Password visibility"
        description="A separate control example; it is not part of the inquiry form."
      >
        <div className="max-w-xl">
          <FormField
            id="preview-password"
            label="Preview password"
            description="Use a sample value to try the visibility button."
          >
            {(fieldProps) => (
              <PasswordInput
                {...fieldProps}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                spellCheck={false}
              />
            )}
          </FormField>
        </div>
      </DetailSection>

      <DetailSection
        id="disabled-controls"
        title="Disabled controls"
        description="Examples of unavailable controls."
      >
        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <FormField id="disabled-input-example" label="Disabled input example" disabled>
            {(fieldProps) => <Input {...fieldProps} defaultValue="Unavailable example" />}
          </FormField>

          <CheckboxField
            id="disabled-checkbox-example"
            label="Disabled checkbox example"
            disabled
            defaultChecked
          />

          <SwitchField
            id="disabled-switch-example"
            label="Disabled switch example"
            checked={false}
            disabled
            onCheckedChange={() => undefined}
          />
        </div>
      </DetailSection>

      <OverlayLibraryPreview />
      <FeedbackFilePreview />
    </div>
  );
}

function InlinePreviewIntroduction() {
  return (
    <div className="rounded-control border border-border bg-muted p-4">
      <p className="text-sm leading-6 text-muted-foreground">
        This page is available only during development. Use fictional values while reviewing the
        controls.
      </p>
    </div>
  );
}
