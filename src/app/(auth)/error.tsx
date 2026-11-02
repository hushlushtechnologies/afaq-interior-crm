'use client';

import { AuthPanel } from '@/components/auth/auth-panel';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AuthPanel title="Unable to complete the request" description="Please try again.">
      <div className="space-y-5">
        <InlineNotice title="The request could not be completed" tone="warning">
          <p>Check your connection and try again.</p>
        </InlineNotice>

        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </AuthPanel>
  );
}
