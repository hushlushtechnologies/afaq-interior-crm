'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  canOpenWorkspacePath,
  getVisibleWorkspaceModules,
  getVisibleWorkspaceSearchLinks,
} from '@/features/access/workspace-access';
import type { AccessSnapshot } from '@/features/access/types';
import type { WorkspaceModule, WorkspaceSearchLink } from '@/types/workspace';

type AccessContextValue = {
  snapshot: AccessSnapshot;
  modules: WorkspaceModule[];
  searchLinks: WorkspaceSearchLink[];
  canOpenPath: (pathname: string) => boolean;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({
  snapshot,
  children,
}: {
  snapshot: AccessSnapshot;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      snapshot,
      modules: getVisibleWorkspaceModules(snapshot),
      searchLinks: getVisibleWorkspaceSearchLinks(snapshot),
      canOpenPath: (pathname: string) => canOpenWorkspacePath(snapshot, pathname),
    }),
    [snapshot],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const context = useContext(AccessContext);

  if (!context) {
    throw new Error('useAccess must be used inside AccessProvider.');
  }

  return context;
}
