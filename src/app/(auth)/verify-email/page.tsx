import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { EmailCodeForm } from '@/components/auth/email-code-form';
import { VerificationRequestForm } from '@/components/auth/verification-request-form';
import { focusRing } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Verify email | Afaq Al Manzel',
};

export default function VerifyEmailPage() {
  return (
    <AuthPanel
      title="Verify your email"
      description="Use this page when your employee email needs verification."
    >
      <section aria-labelledby="verification-request-heading" className="space-y-4">
        <h2 id="verification-request-heading" className="font-semibold text-foreground">
          Request a verification email
        </h2>

        <VerificationRequestForm />
      </section>

      <section
        aria-labelledby="verification-code-heading"
        className="mt-7 space-y-4 border-t border-border pt-6"
      >
        <div>
          <h2 id="verification-code-heading" className="font-semibold text-foreground">
            Have a verification code?
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter the matching email address and code from your latest verification message.
          </p>
        </div>

        <EmailCodeForm />
      </section>

      <Link
        href="/login"
        className={`mt-5 inline-flex min-h-11 items-center rounded-sm py-2 text-sm font-medium underline underline-offset-4 ${focusRing}`}
      >
        Return to sign-in
      </Link>
    </AuthPanel>
  );
}
