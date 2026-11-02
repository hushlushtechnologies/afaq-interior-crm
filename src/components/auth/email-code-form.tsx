'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { verifyEmailCodeAction } from '@/features/auth/verification-actions';
import { emailCodeSchema, type EmailCodeValues } from '@/features/auth/verification-schemas';
import { INITIAL_EMAIL_CODE_STATE, type EmailCodeState } from '@/features/auth/verification-types';
import { focusRing } from '@/lib/utils';

export function EmailCodeForm() {
  const [state, dispatch, pending] = useActionState<EmailCodeState, EmailCodeValues>(
    verifyEmailCodeAction,
    INITIAL_EMAIL_CODE_STATE,
  );

  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailCodeValues>({
    resolver: zodResolver(emailCodeSchema),
    defaultValues: {
      email: '',
      token: '',
    },
    shouldFocusError: false,
  });

  const emailError = errors.email?.message ?? state.fieldErrors.email;

  const tokenError = errors.token?.message ?? state.fieldErrors.token;

  const summaryErrors = [
    {
      fieldId: 'code-email',
      message: emailError,
    },
    {
      fieldId: 'verification-code',
      message: tokenError,
    },
  ].filter(
    (error): error is FormSummaryError =>
      typeof error.message === 'string' && error.message.length > 0,
  );

  useEffect(() => {
    if (state.message) {
      noticeRef.current?.focus();
    } else if (state.status === 'invalid') {
      summaryRef.current?.focus();
    }
  }, [state]);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const submit = handleSubmit(
      (values) => {
        startTransition(() => dispatch(values));
      },
      () => {
        requestAnimationFrame(() => {
          summaryRef.current?.focus();
        });
      },
    );

    void submit(event);
  }

  return (
    <form
      aria-label="Verify email code"
      noValidate
      onSubmit={handleFormSubmit}
      className="space-y-5"
    >
      <FormErrorSummary ref={summaryRef} errors={summaryErrors} />

      {state.message ? (
        <InlineNotice
          ref={noticeRef}
          role="alert"
          tabIndex={-1}
          title="Code could not be verified"
          tone="warning"
          className={focusRing}
        >
          <p>{state.message}</p>
        </InlineNotice>
      ) : null}

      <FormField
        id="code-email"
        label="Email for code"
        required
        disabled={pending}
        error={emailError}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('email')}
            type="email"
            autoComplete="email"
            maxLength={254}
            spellCheck={false}
          />
        )}
      </FormField>

      <FormField
        id="verification-code"
        label="Verification code"
        description="Enter the six-digit code from your latest verification email."
        required
        disabled={pending}
        error={tokenError}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('token')}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            spellCheck={false}
          />
        )}
      </FormField>

      <Button type="submit" loading={pending} className="w-full">
        Verify code
      </Button>
    </form>
  );
}
