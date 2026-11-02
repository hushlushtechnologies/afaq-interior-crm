import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { RecoveryRequestForm } from '@/components/auth/recovery-request-form';
import { focusRing } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Password recovery | Afaq Al Manzel',
};

export default function ForgotPasswordPage() {
  return (
    <AuthPanel
      title="Password recovery"
      description="Request a reset link using your employee email."
    >
      <RecoveryRequestForm />

      <Link
        href="/login"
        className={`mt-5 inline-flex min-h-11 items-center rounded-sm py-2 text-sm font-medium underline underline-offset-4 ${focusRing}`}
      >
        Return to sign-in
      </Link>
    </AuthPanel>
  );
}
