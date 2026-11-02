import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthPanel } from '@/components/auth/auth-panel';
import { AuthUnavailable } from '@/components/auth/auth-unavailable';
import { LoginForm } from '@/components/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthState } from '@/features/auth/session';
import { focusRing } from '@/lib/utils';

export const instant = false;

export const metadata: Metadata = {
  title: 'Employee sign in | Afaq Al Manzel',
};

async function LoginContent() {
  await connection();

  const state = await getAuthState();

  if (state.status === 'authenticated') {
    redirect('/dashboard');
  }

  if (state.status === 'unavailable') {
    return <AuthUnavailable />;
  }

  return (
    <AuthPanel title="Employee sign in" description="Use your employee email and password.">
      <LoginForm />

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
        <Link
          href="/forgot-password"
          className={`inline-flex min-h-11 items-center rounded-sm py-2 text-sm font-medium underline underline-offset-4 ${focusRing}`}
        >
          Forgot password?
        </Link>

        <Link
          href="/verify-email"
          className={`inline-flex min-h-11 items-center rounded-sm py-2 text-sm font-medium underline underline-offset-4 ${focusRing}`}
        >
          Verify email
        </Link>
      </div>
    </AuthPanel>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPanel title="Checking sign-in" description="Please wait while we check your session.">
          <Skeleton className="h-48 w-full" />
        </AuthPanel>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
