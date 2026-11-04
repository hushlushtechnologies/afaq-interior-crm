import { Suspense } from 'react';
import { connection } from 'next/server';
import { AuthPanel } from '@/components/auth/auth-panel';
import { InvitationAcceptanceForm } from '@/components/employees/invitation-acceptance-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const instant = false;

export const metadata = {
  title: 'Accept employee invitation | Afaq Al Manzel',
};

async function AcceptanceContent() {
  await connection();

  let status: string | null = null;

  try {
    const client = await createSupabaseServerClient();
    const own = await client.rpc('crm_get_my_employee_invitation');

    if (!own.error) status = own.data;
  } catch {
    // The link can still be verified without an existing session.
  }

  return (
    <InvitationAcceptanceForm ready={status === 'delivered'} accepted={status === 'accepted'} />
  );
}

export default function AcceptInvitationPage() {
  return (
    <AuthPanel
      title="Accept employee invitation"
      description="Complete your local employee invitation."
    >
      <Suspense fallback={<p>Checking invitation session…</p>}>
        <AcceptanceContent />
      </Suspense>
    </AuthPanel>
  );
}