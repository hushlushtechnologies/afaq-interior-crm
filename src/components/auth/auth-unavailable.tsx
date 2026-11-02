import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';

export function AuthUnavailable() {
  return (
    <AuthPanel
      title="Sign-in temporarily unavailable"
      description="We could not verify your account right now."
    >
      <div className="space-y-5">
        <InlineNotice title="Please try again" tone="warning">
          <p>
            The authentication service could not be reached. Your workspace will open after
            verification succeeds.
          </p>
        </InlineNotice>

        <Link
          href="/login"
          prefetch={false}
          className={buttonClassName({
            variant: 'outline',
          })}
        >
          Try again
        </Link>
      </div>
    </AuthPanel>
  );
}
