import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthPanel } from '@/components/auth/auth-panel';
import { AuthUnavailable } from '@/components/auth/auth-unavailable';
import { PasswordUpdateForm } from '@/components/auth/password-update-form';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthState } from '@/features/auth/session';
import { focusRing } from '@/lib/utils';

export const instant = false;

export const metadata: Metadata = {
  title: 'Set a new password | Afaq Al Manzel',
};

async function PasswordUpdateContent() {
  await connection();

  const state = await getAuthState();

  if (state.status === 'unavailable') {
    return <AuthUnavailable />;
  }

  if (state.status === 'anonymous') {
    return (
      <AuthPanel
        title="Reset link required"
        description="Open a valid recovery link before choosing a new password."
      >
        <Link
          href="/forgot-password"
          className={`inline-flex min-h-11 items-center rounded-sm py-2 text-sm font-medium underline underline-offset-4 ${focusRing}`}
        >
          Request a new reset link
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel title="Set a new password" description="Choose a new password for your account.">
      <PasswordUpdateForm email={state.user.email} />
    </AuthPanel>
  );
}

export default function PasswordUpdatePage() {
  return (
    <Suspense
      fallback={
        <AuthPanel
          title="Checking your account"
          description="Please wait while we verify your session."
        >
          <Skeleton className="h-40 w-full" />
        </AuthPanel>
      }
    >
      <PasswordUpdateContent />
    </Suspense>
  );
}
