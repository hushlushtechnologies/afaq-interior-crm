'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxField } from '@/components/forms/checkbox-field';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from '@/features/access/catalog';
import {
  changeUserRoleAction,
  lookupRoleAccountAction,
} from '@/features/access/role-admin-actions';
import {
  roleLookupSchema,
  type RoleAccount,
  type RoleLookupValues,
} from '@/features/access/role-admin-schemas';
import {
  INITIAL_ROLE_LOOKUP_STATE,
  type RoleLookupState,
} from '@/features/access/role-admin-types';
import { focusRing } from '@/lib/utils';

type PendingRoleChange = {
  roleKey: RoleKey;
  operation: 'assign' | 'revoke';
};

function RoleAssignmentEditor({ account: initialAccount }: { account: RoleAccount }) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount);
  const [pendingChange, setPendingChange] = useState<PendingRoleChange | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changeTriggerRef = useRef<HTMLInputElement | null>(null);

  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedback) {
      feedbackRef.current?.focus();
    }
  }, [feedback]);

  function confirmChange() {
    if (!pendingChange) {
      return;
    }

    const input = {
      email: account.email,
      roleKey: pendingChange.roleKey,
      operation: pendingChange.operation,
    };

    startTransition(async () => {
      try {
        const result = await changeUserRoleAction(input);

        if (result.status === 'unauthenticated') {
          setPendingChange(null);
          router.replace('/login');
          router.refresh();
          return;
        }

        if (result.status === 'denied') {
          setPendingChange(null);
          router.refresh();
          return;
        }

        if (result.status === 'changed' && result.account) {
          setAccount(result.account);
          setFeedback(result.message);
          setChangeError(null);
          setPendingChange(null);
          router.refresh();
          return;
        }

        setChangeError(result.message);
      } catch {
        setChangeError('The role request could not be completed. Please try again.');
      }
    });
  }

  const selectedRoleLabel = pendingChange ? ROLE_LABELS[pendingChange.roleKey] : 'role';

  const assigning = pendingChange?.operation === 'assign';

  return (
    <section
      aria-labelledby="account-role-heading"
      className="mt-6 space-y-5 border-t border-border pt-6"
    >
      <div>
        <h3 id="account-role-heading" className="font-semibold text-foreground">
          Account roles
        </h3>

        <p className="mt-2 break-all text-sm text-muted-foreground">{account.email}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {account.roles.length ? (
            account.roles.map((role) => (
              <Badge key={role} tone="info">
                {ROLE_LABELS[role]}
              </Badge>
            ))
          ) : (
            <Badge tone="warning">No roles assigned</Badge>
          )}
        </div>
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        Select a role to review and confirm the change. Email verification is required before
        workspace access.
      </p>

      {feedback ? (
        <InlineNotice
          ref={feedbackRef}
          role="status"
          tabIndex={-1}
          title="Roles updated"
          tone="success"
          className={focusRing}
        >
          <p>{feedback}</p>
        </InlineNotice>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {ROLE_KEYS.map((role) => (
          <CheckboxField
            key={role}
            label={ROLE_LABELS[role]}
            checked={account.roles.includes(role)}
            disabled={pending}
            onChange={(event) => {
              changeTriggerRef.current = event.currentTarget;

              setChangeError(null);
              setFeedback(null);

              setPendingChange({
                roleKey: role,
                operation: event.currentTarget.checked ? 'assign' : 'revoke',
              });
            }}
          />
        ))}
      </div>

      <p className="text-xs leading-6 text-muted-foreground">
        At least one confirmed, unblocked Super Admin must remain.
      </p>

      <ConfirmationDialog
        open={pendingChange !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setPendingChange(null);
            setChangeError(null);
          }
        }}
        title={
          pendingChange
            ? `${assigning ? 'Assign' : 'Remove'} ${selectedRoleLabel}?`
            : 'Update role?'
        }
        description={
          assigning
            ? `Assign this role to ${account.email}? This changes the workspaces and actions available to the account.`
            : `Remove this role from ${account.email}? Access supplied by this role will be removed.`
        }
        confirmLabel={assigning ? 'Assign role' : 'Remove role'}
        tone={assigning ? 'neutral' : 'destructive'}
        pending={pending}
        error={changeError ?? undefined}
        returnFocusRef={changeTriggerRef}
        onConfirm={confirmChange}
      />
    </section>
  );
}

export function RoleManagementWorkspace() {
  const router = useRouter();

  const [state, setState] = useState<RoleLookupState>(INITIAL_ROLE_LOOKUP_STATE);

  const [pending, startTransition] = useTransition();

  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleLookupValues>({
    resolver: zodResolver(roleLookupSchema),
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
        startTransition(async () => {
          try {
            const result = await lookupRoleAccountAction(values);

            if (result.status === 'unauthenticated') {
              router.replace('/login');
              router.refresh();
              return;
            }

            setState(result);

            if (result.status === 'denied') {
              router.refresh();
            }
          } catch {
            setState({
              status: 'error',
              message: 'The account lookup could not be completed. Please try again.',
              account: null,
            });
          }
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
    <div className="space-y-6">
      <PageHeader title="Role access" description="Assign employee roles to existing accounts." />

      <DetailSection
        id="role-account-lookup"
        title="Find an existing account"
        description="Only Super Admin can change employee roles."
      >
        <form
          aria-label="Find role account"
          noValidate
          onSubmit={handleFormSubmit}
          className="max-w-xl space-y-5"
        >
          <FormErrorSummary
            ref={summaryRef}
            errors={
              emailError
                ? [
                    {
                      fieldId: 'role-account-email',
                      message: emailError,
                    },
                  ]
                : []
            }
          />

          {state.message ? (
            <InlineNotice
              ref={noticeRef}
              role={state.status === 'not-found' ? 'status' : 'alert'}
              tabIndex={-1}
              title={state.status === 'not-found' ? 'Account not found' : 'Lookup unavailable'}
              tone={state.status === 'not-found' ? 'info' : 'warning'}
              className={focusRing}
            >
              <p>{state.message}</p>
            </InlineNotice>
          ) : null}

          <FormField
            id="role-account-email"
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
                maxLength={254}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </FormField>

          <Button type="submit" loading={pending}>
            Find account
          </Button>
        </form>

        {state.account ? (
          <RoleAssignmentEditor
            key={[state.account.userId, state.account.email, ...state.account.roles].join(':')}
            account={state.account}
          />
        ) : null}
      </DetailSection>
    </div>
  );
}
