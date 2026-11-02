import {
  MODULE_VIEW_PERMISSIONS,
  type AccessScope,
  type PermissionKey,
} from '@/features/access/catalog';
import { hasCapability, hasRequiredScope } from '@/features/access/permissions';
import type { AccessSnapshot } from '@/features/access/types';
import {
  getWorkspacePage,
  getWorkspacePageFromPath,
  getWorkspaceSearchLinks,
  WORKSPACE_MODULES,
} from '@/lib/workspace/navigation';
import type { WorkspaceModule, WorkspacePage } from '@/types/workspace';

type WorkspaceRequirement = {
  permission: PermissionKey;
  scope?: AccessScope;
};

export function getWorkspaceRequirement(page: WorkspacePage): WorkspaceRequirement {
  if (page.module.id === 'settings' && page.section.slug === 'access') {
    return {
      permission: 'access.roles.manage',
      scope: 'company',
    };
  }

  return {
    permission: MODULE_VIEW_PERMISSIONS[page.module.id],
  };
}

export function canOpenWorkspacePage(snapshot: AccessSnapshot, page: WorkspacePage): boolean {
  const requirement = getWorkspaceRequirement(page);

  return requirement.scope
    ? hasRequiredScope(snapshot, requirement.permission, requirement.scope)
    : hasCapability(snapshot, requirement.permission);
}

export function canOpenWorkspacePath(snapshot: AccessSnapshot, pathname: string): boolean {
  const page = getWorkspacePageFromPath(pathname);

  return Boolean(page && canOpenWorkspacePage(snapshot, page));
}

export function getVisibleWorkspaceModules(snapshot: AccessSnapshot): WorkspaceModule[] {
  return WORKSPACE_MODULES.filter((workspaceModule) =>
    hasCapability(snapshot, MODULE_VIEW_PERMISSIONS[workspaceModule.id]),
  ).map((workspaceModule) => ({
    ...workspaceModule,
    sections: workspaceModule.sections.filter((section) => {
      const segments = section.slug ? [workspaceModule.id, section.slug] : [workspaceModule.id];

      const page = getWorkspacePage(segments);

      return Boolean(page && canOpenWorkspacePage(snapshot, page));
    }),
  }));
}

export function getVisibleWorkspaceSearchLinks(snapshot: AccessSnapshot) {
  return getWorkspaceSearchLinks().filter((link) => canOpenWorkspacePath(snapshot, link.href));
}

/**
 * The existing record demos include editable company-wide samples.
 * Only the full demo capability set receives that fictional dataset.
 *
 * Real assigned records require their own database relationships.
 */
export function canUseRecordDemo(snapshot: AccessSnapshot): boolean {
  return (
    hasRequiredScope(snapshot, 'leads.view', 'company') &&
    hasRequiredScope(snapshot, 'leads.update', 'company') &&
    hasRequiredScope(snapshot, 'leads.assign', 'company') &&
    hasRequiredScope(snapshot, 'projects.financials.view', 'company')
  );
}
