'use client';

import Link from 'next/link';
import { InvitationRecoveryLookup } from '@/components/employees/invitation-recovery-lookup';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { LocalInvitationDelivery } from '@/components/employees/local-invitation-delivery';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { requestEmployeeInvitationAction } from '@/features/employee/invitation-actions';
import type {
  InvitationActionState,
  InvitationRequest,
} from '@/features/employee/invitation-request';
import {
  employeeInvitationSchema,
  type EmployeeInvitationValues,
} from '@/features/employee/invitation-schemas';
import { focusRing } from '@/lib/utils';

export function EmployeeInvitationWorkspace() {
  const [attempt, setAttempt] = useState<InvitationRequest | null>(null);
  const [feedback, setFeedback] = useState<InvitationActionState | null>(null);
  const [pending, setPending] = useState(false);
  const requestRef = useRef<InvitationRequest | null>(null);
  const inFlight = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState<EmployeeInvitationValues>({
    displayName: '',
    workEmail: '',
  });

  const [errors, setErrors] = useState<{ displayName?: string; workEmail?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const summaryErrors = [
    { fieldId: 'invitation-name', message: errors.displayName },
    { fieldId: 'invitation-email', message: errors.workEmail },
  ].filter((error): error is FormSummaryError => typeof error.message === 'string');

  useEffect(() => {
    if (feedback) noticeRef.current?.focus();
  }, [feedback]);

  async function sendRequest(request: InvitationRequest) {
    if (inFlight.current) return;

    inFlight.current = true;
    setPending(true);
    setFeedback(null);

    try {
      setFeedback(await requestEmployeeInvitationAction(request));
    } catch {
      setFeedback({
        status: 'error',
        message:
          'The result could not be confirmed. Retry this request without changing its details.',
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    if (requestRef.current) {
      if (feedback?.status === 'error') void sendRequest(requestRef.current);
      return;
    }

    const parsed = employeeInvitationSchema.safeParse(values);

    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ displayName: fields.displayName?.[0], workEmail: fields.workEmail?.[0] });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setErrors({});

    try {
      const request = { ...parsed.data, requestId: crypto.randomUUID() };
      requestRef.current = request;
      setAttempt(request);
      void sendRequest(request);
    } catch {
      setFeedback({
        status: 'error',
        message: 'The request could not be prepared. Please try again.',
      });
    }
  }

  function startAnotherRequest() {
    if (inFlight.current) return;

    requestRef.current = null;
    setAttempt(null);
    setFeedback(null);
    setValues({ displayName: '', workEmail: '' });
    setErrors({});
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  const canStartAnother =
    feedback?.status === 'ok' || feedback?.status === 'invalid' || feedback?.status === 'conflict';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee invitations"
        description="Record an invitation request for a new employee."
      />

      <InlineNotice title="Invitations are delivered separately" tone="info">
        <p>
          Recording a request does not send an email, create a sign-in account, or assign roles.
        </p>
      </InlineNotice>

      <form
        aria-label="Request employee invitation"
        noValidate
        onSubmit={submit}
        className="max-w-xl space-y-5"
      >
        <FormErrorSummary ref={summaryRef} errors={summaryErrors} />

        {feedback ? (
          <InlineNotice
            ref={noticeRef}
            role={feedback.status === 'ok' ? 'status' : 'alert'}
            tabIndex={-1}
            title={feedback.status === 'ok' ? 'Request result' : 'Request not confirmed'}
            tone={feedback.status === 'ok' ? 'info' : 'warning'}
            className={focusRing}
          >
            <p>{feedback.message}</p>

            {feedback.status === 'unauthenticated' ? (
              <Link href="/login" className="underline">
                Sign in again
              </Link>
            ) : null}
          </InlineNotice>
        ) : null}

        <FormField id="invitation-name" label="Employee name" required error={errors.displayName}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              ref={nameRef}
              name="displayName"
              value={values.displayName}
              onChange={(event) => {
                const displayName = event.target.value;
                setValues((current) => ({ ...current, displayName }));
              }}
              autoComplete="off"
              maxLength={120}
              readOnly={attempt !== null || pending}
            />
          )}
        </FormField>

        <FormField id="invitation-email" label="Work email" required error={errors.workEmail}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              name="workEmail"
              value={values.workEmail}
              onChange={(event) => {
                const workEmail = event.target.value;
                setValues((current) => ({ ...current, workEmail }));
              }}
              type="email"
              autoComplete="off"
              maxLength={254}
              spellCheck={false}
              readOnly={attempt !== null || pending}
            />
          )}
        </FormField>

        {attempt && feedback?.status === 'error' ? (
          <p className="text-sm text-muted-foreground">
            Retry uses the same name and email. Keep this page open until the result is confirmed.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!attempt || pending || feedback?.status === 'error' ? (
            <Button type="submit" loading={pending}>
              {pending
                ? 'Recording request'
                : attempt
                  ? 'Retry request'
                  : 'Record invitation request'}
            </Button>
          ) : null}

          {canStartAnother ? (
            <Button variant="outline" onClick={startAnotherRequest}>
              Start another request
            </Button>
          ) : null}
        </div>
      </form>

      {feedback?.status === 'ok' && feedback.result.invitationId ? (
        <LocalInvitationDelivery
          key={feedback.result.invitationId}
          invitationId={feedback.result.invitationId}
          onCheck={() =>
            setFeedback((current) =>
              current?.status === 'ok'
                ? {
                    ...current,
                    message: 'Invitation request recorded. Check the local delivery result below.',
                  }
                : current,
            )
          }
        />
      ) : null}

      <InvitationRecoveryLookup />
    </div>
  );
}
