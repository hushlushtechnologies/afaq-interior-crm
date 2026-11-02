'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { AccountToolbar } from '@/components/auth/account-toolbar';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { PasswordInput } from '@/components/ui/password-input';
import { updatePasswordAction } from '@/features/auth/recovery-actions';
import { passwordUpdateSchema, type PasswordUpdateValues } from '@/features/auth/recovery-schemas';
import {
  INITIAL_PASSWORD_UPDATE_STATE,
  type PasswordUpdateState,
} from '@/features/auth/recovery-types';
import { focusRing } from '@/lib/utils';

export function PasswordUpdateForm({ email }: { email: string }) {
  const [state, dispatch, pending] = useActionState<PasswordUpdateState, PasswordUpdateValues>(
    updatePasswordAction,
    INITIAL_PASSWORD_UPDATE_STATE,
  );

  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordUpdateValues>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    shouldFocusError: false,
  });

  const passwordError = errors.password?.message ?? state.fieldErrors.password;

  const confirmationError = errors.confirmPassword?.message ?? state.fieldErrors.confirmPassword;

  const summaryErrors = [
    {
      fieldId: 'new-password',
      message: passwordError,
    },
    {
      fieldId: 'confirm-new-password',
      message: confirmationError,
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

  if (state.status === 'updated') {
    return (
      <div className="space-y-5">
        <InlineNotice
          ref={noticeRef}
          role="status"
          tabIndex={-1}
          title="Password updated"
          tone="success"
          className={focusRing}
        >
          <p>{state.message}</p>
        </InlineNotice>

        <AccountToolbar email={email} />
      </div>
    );
  }

  return (
    <form
      aria-label="Set a new password"
      noValidate
      onSubmit={handleFormSubmit}
      className="space-y-5"
    >
      <p className="break-all text-sm text-muted-foreground">Account: {email}</p>

      <FormErrorSummary ref={summaryRef} errors={summaryErrors} />

      {state.message ? (
        <InlineNotice
          ref={noticeRef}
          role="alert"
          tabIndex={-1}
          title="Password could not be updated"
          tone="warning"
          className={focusRing}
        >
          <p>{state.message}</p>
        </InlineNotice>
      ) : null}

      <FormField
        id="new-password"
        label="New password"
        description="Use at least 12 characters."
        required
        disabled={pending}
        error={passwordError}
      >
        {(fieldProps) => (
          <PasswordInput
            {...fieldProps}
            {...register('password')}
            autoComplete="new-password"
            maxLength={72}
          />
        )}
      </FormField>

      <FormField
        id="confirm-new-password"
        label="Confirm new password"
        required
        disabled={pending}
        error={confirmationError}
      >
        {(fieldProps) => (
          <PasswordInput
            {...fieldProps}
            {...register('confirmPassword')}
            autoComplete="new-password"
            maxLength={72}
          />
        )}
      </FormField>

      <Button type="submit" loading={pending} className="w-full">
        Update password
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        After completion, you will return to sign-in.
      </p>
    </form>
  );
}
