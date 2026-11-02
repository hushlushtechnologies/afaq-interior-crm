'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { requestRecoveryAction } from '@/features/auth/recovery-actions';
import {
  recoveryRequestSchema,
  type RecoveryRequestValues,
} from '@/features/auth/recovery-schemas';
import {
  INITIAL_RECOVERY_REQUEST_STATE,
  type RecoveryRequestState,
} from '@/features/auth/recovery-types';
import { focusRing } from '@/lib/utils';

export function RecoveryRequestForm() {
  const [state, dispatch, pending] = useActionState<RecoveryRequestState, RecoveryRequestValues>(
    requestRecoveryAction,
    INITIAL_RECOVERY_REQUEST_STATE,
  );

  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryRequestValues>({
    resolver: zodResolver(recoveryRequestSchema),
    defaultValues: {
      email: '',
    },
    shouldFocusError: false,
  });

  const emailError = errors.email?.message ?? state.fieldError;

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
      aria-label="Request password recovery"
      noValidate
      onSubmit={handleFormSubmit}
      className="space-y-5"
    >
      <FormErrorSummary
        ref={summaryRef}
        errors={
          emailError
            ? [
                {
                  fieldId: 'recovery-email',
                  message: emailError,
                },
              ]
            : []
        }
      />

      {state.message ? (
        <InlineNotice
          ref={noticeRef}
          role={state.status === 'submitted' ? 'status' : 'alert'}
          tabIndex={-1}
          title={state.status === 'submitted' ? 'Request received' : 'Request unavailable'}
          tone={state.status === 'submitted' ? 'info' : 'warning'}
          className={focusRing}
        >
          <p>{state.message}</p>
        </InlineNotice>
      ) : null}

      <FormField
        id="recovery-email"
        label="Employee email"
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

      <Button type="submit" loading={pending} className="w-full">
        Request reset link
      </Button>
    </form>
  );
}
