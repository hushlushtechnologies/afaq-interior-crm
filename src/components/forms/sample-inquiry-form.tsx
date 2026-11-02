'use client';

import { useRef, useState, type FormEvent } from 'react';
import { CheckboxField } from '@/components/forms/checkbox-field';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { RadioGroupField } from '@/components/forms/radio-group-field';
import { SwitchField } from '@/components/forms/switch-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  SAMPLE_CONTACT_METHODS,
  SAMPLE_FIELD_IDS,
  SAMPLE_INQUIRY_DEFAULTS,
  SAMPLE_PROPERTY_TYPES,
  validateSampleInquiry,
  type SampleInquiryErrors,
  type SampleInquiryValues,
} from '@/lib/forms/sample-inquiry';
import { cn, focusRing } from '@/lib/utils';

export function SampleInquiryForm() {
  const [values, setValues] = useState<SampleInquiryValues>({
    ...SAMPLE_INQUIRY_DEFAULTS,
  });

  const [errors, setErrors] = useState<SampleInquiryErrors>({});
  const [validated, setValidated] = useState<SampleInquiryValues | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const summaryErrors = Object.entries(errors).map(([field, message]) => ({
    fieldId: SAMPLE_FIELD_IDS[field as keyof SampleInquiryValues],
    message: message ?? '',
  }));

  function updateField<Key extends keyof SampleInquiryValues>(
    field: Key,
    value: SampleInquiryValues[Key],
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });

    setValidated(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateSampleInquiry(values);
    setErrors(nextErrors);
    setValidated(null);

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
      });

      return;
    }

    setValidated({
      ...values,
      clientName: values.clientName.trim(),
      email: values.email.trim(),
      budget: values.budget.trim(),
    });

    requestAnimationFrame(() => {
      resultRef.current?.focus();
    });
  }

  function resetExample() {
    setValues({ ...SAMPLE_INQUIRY_DEFAULTS });
    setErrors({});
    setValidated(null);

    document.getElementById(SAMPLE_FIELD_IDS.clientName)?.focus();
  }

  const selectedProperty = validated
    ? SAMPLE_PROPERTY_TYPES.find((option) => option.value === validated.propertyType)
    : undefined;

  const selectedContact = validated
    ? SAMPLE_CONTACT_METHODS.find((option) => option.value === validated.contactMethod)
    : undefined;

  return (
    <form aria-label="Sample inquiry form" noValidate onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm leading-6 text-muted-foreground">
        Fields marked with an asterisk (*) are required. This example validates locally and does not
        create a lead.
      </p>

      <FormErrorSummary ref={errorSummaryRef} errors={summaryErrors} />

      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <FormField
          id={SAMPLE_FIELD_IDS.clientName}
          label="Sample client name"
          required
          error={errors.clientName}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              name="clientName"
              value={values.clientName}
              onChange={(event) => updateField('clientName', event.target.value)}
              autoComplete="off"
              maxLength={80}
              placeholder="Example Client"
            />
          )}
        </FormField>

        <FormField
          id={SAMPLE_FIELD_IDS.email}
          label="Sample email"
          description="Use a fictional address such as sample@example.invalid."
          required
          error={errors.email}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              name="email"
              type="email"
              value={values.email}
              onChange={(event) => updateField('email', event.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={254}
              placeholder="sample@example.invalid"
            />
          )}
        </FormField>

        <FormField
          id={SAMPLE_FIELD_IDS.propertyType}
          label="Property type"
          required
          error={errors.propertyType}
        >
          {(fieldProps) => (
            <NativeSelect
              {...fieldProps}
              name="propertyType"
              value={values.propertyType}
              onChange={(event) => updateField('propertyType', event.target.value)}
            >
              <option value="">Choose property type</option>

              {SAMPLE_PROPERTY_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField
          id={SAMPLE_FIELD_IDS.budget}
          label="Indicative budget"
          description="Optional sample amount in AED, up to two decimal places."
          error={errors.budget}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              name="budget"
              type="text"
              inputMode="decimal"
              value={values.budget}
              onChange={(event) => updateField('budget', event.target.value)}
              autoComplete="off"
              maxLength={15}
              placeholder="120000.00"
            />
          )}
        </FormField>
      </div>

      <RadioGroupField
        id={SAMPLE_FIELD_IDS.contactMethod}
        name="contactMethod"
        label="Preferred contact method"
        description="Selection only; this example does not contact anyone."
        required
        value={values.contactMethod}
        options={SAMPLE_CONTACT_METHODS}
        error={errors.contactMethod}
        onValueChange={(value) => updateField('contactMethod', value)}
      />

      <div className="grid min-w-0 gap-5 border-t border-border pt-5 md:grid-cols-2">
        <CheckboxField
          id={SAMPLE_FIELD_IDS.includeSiteVisit}
          name="includeSiteVisit"
          label="Include a sample site visit"
          description="Adds this preference to the local validation result."
          checked={values.includeSiteVisit}
          onChange={(event) => updateField('includeSiteVisit', event.target.checked)}
        />

        <SwitchField
          id={SAMPLE_FIELD_IDS.followUpReminder}
          name="followUpReminder"
          label="Show a follow-up reminder"
          description="Preview setting only; no reminder will be scheduled."
          checked={values.followUpReminder}
          onCheckedChange={(checked) => updateField('followUpReminder', checked)}
        />
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border pt-5">
        <Button type="submit">Validate sample</Button>

        <Button type="button" variant="outline" onClick={resetExample}>
          Reset example
        </Button>
      </div>

      {validated ? (
        <div
          ref={resultRef}
          role="status"
          tabIndex={-1}
          aria-labelledby="sample-validation-result-heading"
          className={cn(
            'min-w-0 rounded-control border border-success bg-success-soft p-5',
            focusRing,
          )}
        >
          <h3 id="sample-validation-result-heading" className="font-semibold text-success">
            Sample validated locally
          </h3>

          <p className="mt-2 text-sm leading-6 text-foreground">
            Nothing was saved or sent. Editing a field clears this result.
          </p>

          <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Sample client</dt>
              <dd className="mt-1 break-words text-sm font-medium">{validated.clientName}</dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Sample email</dt>
              <dd className="mt-1 break-all text-sm font-medium">{validated.email}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Property</dt>
              <dd className="mt-1 text-sm font-medium">{selectedProperty?.label}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Contact preference</dt>
              <dd className="mt-1 text-sm font-medium">{selectedContact?.label}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Indicative budget</dt>
              <dd className="mt-1 text-sm font-medium">
                {validated.budget
                  ? `AED ${Number(validated.budget).toLocaleString('en-GB', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : 'Not supplied'}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Site visit</dt>
              <dd className="mt-1 text-sm font-medium">
                {validated.includeSiteVisit ? 'Included in sample' : 'Not included'}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Reminder preference</dt>
              <dd className="mt-1 text-sm font-medium">
                {validated.followUpReminder ? 'On' : 'Off'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </form>
  );
}
