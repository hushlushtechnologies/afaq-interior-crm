import { captureAdmin } from '@/features/lead-capture/admin-actions';
import { getMyAccessState } from '@/features/access/server';
import { hasRequiredScope } from '@/features/access/permissions';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { CaptureWorkspace } from '@/components/leads/capture-workspace';
export const instant = false;
export default async function CapturePage() {
  const access = await getMyAccessState();
  if (access.status === 'unavailable') return <AccessUnavailable />;
  if (
    !access.snapshot.roles.includes('super_admin') ||
    !hasRequiredScope(access.snapshot, 'integrations.manage', 'company')
  )
    return <WorkspaceAccessDenied snapshot={access.snapshot} workspaceTitle="Local lead capture" />;
  const result = await captureAdmin('review', 0);
  return (
    <CaptureWorkspace
      initial={result.status === 'ok' ? result.data : null}
      initialMessage={result.status === 'error' ? result.message : ''}
    />
  );
}