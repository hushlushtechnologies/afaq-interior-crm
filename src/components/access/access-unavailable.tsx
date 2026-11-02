'use client';

import { useRouter } from 'next/navigation';
import { AccountToolbar } from '@/components/auth/account-toolbar';
import { AuthPanel } from '@/components/auth/auth-panel';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';

export function AccessUnavailable({ email }: { email?: string }) {
  const router = useRouter();

  return (
    <AuthPanel
      title="Workspace temporarily unavailable"
      description="We could not verify your workspace access."
    >
      <div className="space-y-5">
        <InlineNotice title="Please try again" tone="warning">
          <p>Your workspace will open after access verification succeeds.</p>
        </InlineNotice>

        <Button type="button" variant="outline" onClick={() => router.refresh()}>
          Try again
        </Button>

        {email ? <AccountToolbar email={email} /> : null}
      </div>
    </AuthPanel>
  );
}
