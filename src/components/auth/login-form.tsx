'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { signInAction } from '@/features/auth/actions';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';
import { INITIAL_SIGN_IN_STATE, type SignInActionState } from '@/features/auth/types';
import { focusRing } from '@/lib/utils';

export function LoginForm() {
  const [state, dispatch, pending] = useActionState<SignInActionState, SignInValues>(
    signInAction,
    INITIAL_SIGN_IN_STATE,
  );

  const summaryRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    shouldFocusError: false,
  });

  const emailError = errors.email?.message ?? state.fieldErrors.email;

  const passwordError = errors.password?.message ?? state.fieldErrors.password;

  const summaryErrors = [
    {
      fieldId: 'employee-email',
      message: emailError,
    },
    {
      fieldId: 'employee-password',
      message: passwordError,
    },
  ].filter(
    (error): error is FormSummaryError =>
      typeof error.message === 'string' && error.message.length > 0,
  );

  useEffect(() => {
    if (state.message) {
      failureRef.current?.focus();
    } else if (state.status === 'invalid') {
      summaryRef.current?.focus();
    }
  }, [state]);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const submit = handleSubmit(
      (values) => {
        startTransition(() => {
          dispatch(values);
        });
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
      aria-label="Employee sign in"
      noValidate
      onSubmit={handleFormSubmit}
      className="space-y-5"
    >
      <FormErrorSummary ref={summaryRef} errors={summaryErrors} />

      {state.message ? (
        <InlineNotice
          ref={failureRef}
          role="alert"
          tabIndex={-1}
          title="Sign-in unsuccessful"
          tone="destructive"
          className={focusRing}
        >
          <p>{state.message}</p>
        </InlineNotice>
      ) : null}

      <FormField
        id="employee-email"
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
            autoComplete="username"
            maxLength={254}
            spellCheck={false}
          />
        )}
      </FormField>

      <FormField
        id="employee-password"
        label="Password"
        required
        disabled={pending}
        error={passwordError}
      >
        {(fieldProps) => (
          <PasswordInput
            {...fieldProps}
            {...register('password')}
            autoComplete="current-password"
            maxLength={1024}
          />
        )}
      </FormField>

      <Button type="submit" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
