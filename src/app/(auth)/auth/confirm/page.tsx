import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { EmailLinkConfirmForm } from '@/components/auth/email-link-confirm-form';
import { focusRing } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Confirm email link | Afaq Al Manzel',
};

export default function ConfirmEmailLinkPage() {
  return (
    <AuthPanel title="Continue from your email" description="Verify your email link to continue.">
      <EmailLinkConfirmForm />

      <div className="mt-5 flex flex-col items-start gap-2">
        <Link
          href="/verify-email"
          className={`inline-flex min-h-11 items-center rounded-sm py-2 text-sm font-medium underline underline-offset-4 ${focusRing}`}
        >
          Request a new verification email
        </Link>

        <Link
          href="/forgot-password"
          className={`inline-flex min-h-11 items-center rounded-sm py-2 text-sm font-medium underline underline-offset-4 ${focusRing}`}
        >
          Request a new reset link
        </Link>
      </div>
    </AuthPanel>
  );
}
