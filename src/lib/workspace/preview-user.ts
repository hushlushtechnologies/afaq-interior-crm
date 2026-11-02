import 'server-only';

import type { WorkspacePreviewUser } from '@/types/workspace';

export function getWorkspacePreviewUser(): WorkspacePreviewUser | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return {
    name: 'Demo employee',
    email: 'demo@example.invalid',
    label: 'Development-only preview',
    mode: 'development',
  };
}
