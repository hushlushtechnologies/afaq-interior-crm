import type {
  WorkspaceModule,
  WorkspaceModuleId,
  WorkspacePage,
  WorkspaceSearchLink,
} from '@/types/workspace';

export const WORKSPACE_MODULES: readonly WorkspaceModule[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'An overview of work, follow-ups, and approvals.',
    sections: [
      { slug: '', title: 'Overview' },
      { slug: 'activity', title: 'Activity' },
      { slug: 'approvals', title: 'Approvals' },
    ],
  },
  {
    id: 'leads',
    title: 'Leads',
    description: 'Manage inquiries, opportunities, and sales follow-ups.',
    sections: [
      { slug: '', title: 'All leads' },
      { slug: 'pipeline', title: 'Sales pipeline' },
      { slug: 'follow-ups', title: 'Follow-ups' },
    ],
  },
  {
    id: 'quotations',
    title: 'Quotations',
    description: 'Prepare quotations and track their review process.',
    sections: [
      { slug: '', title: 'All quotations' },
      { slug: 'approvals', title: 'Approval queue' },
      { slug: 'templates', title: 'Document templates' },
    ],
  },
  {
    id: 'ai-studio',
    title: 'AI Studio',
    description: 'Explore assisted design concepts and generation history.',
    sections: [
      { slug: '', title: 'Studio overview' },
      { slug: 'generations', title: 'Generation history' },
      { slug: 'presets', title: 'Prompt presets' },
    ],
  },
  {
    id: 'clients',
    title: 'Clients',
    description: 'Organize client relationships, contacts, and documents.',
    sections: [
      { slug: '', title: 'Client directory' },
      { slug: 'contacts', title: 'Contacts' },
      { slug: 'documents', title: 'Client documents' },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    description: 'Coordinate project work, schedules, and internal handovers.',
    sections: [
      { slug: '', title: 'All projects' },
      { slug: 'schedule', title: 'Project schedule' },
      { slug: 'handover', title: 'Internal handover' },
    ],
  },
  {
    id: 'design',
    title: 'Design',
    description: 'Coordinate design tasks, revisions, and review requests.',
    sections: [
      { slug: '', title: 'Design overview' },
      { slug: 'tasks', title: 'Design tasks' },
      { slug: 'reviews', title: 'Design reviews' },
    ],
  },
  {
    id: 'site',
    title: 'Site',
    description: 'Track site coordination, daily reports, and inspections.',
    sections: [
      { slug: '', title: 'Site overview' },
      { slug: 'reports', title: 'Daily reports' },
      { slug: 'inspections', title: 'Inspections and snags' },
    ],
  },
  {
    id: 'procurement',
    title: 'Procurement',
    description: 'Coordinate purchasing requirements and purchase orders.',
    sections: [
      { slug: '', title: 'Overview' },
      { slug: 'requests', title: 'Purchase requests' },
      { slug: 'orders', title: 'Purchase orders' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'Review warehouse stock, movements, and transfers.',
    sections: [
      { slug: '', title: 'Stock overview' },
      { slug: 'movements', title: 'Stock movements' },
      { slug: 'transfers', title: 'Transfers' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Review financial information, customer invoices, and budgets.',
    sections: [
      { slug: '', title: 'Financial overview' },
      { slug: 'invoices', title: 'Customer invoices' },
      { slug: 'budgets', title: 'Project budgets' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Explore sales and project reporting workspaces.',
    sections: [
      { slug: '', title: 'Report directory' },
      { slug: 'sales', title: 'Sales reporting' },
      { slug: 'projects', title: 'Project reporting' },
    ],
  },
  {
    id: 'employees',
    title: 'Employees',
    description: 'Organize employee profiles, invitations, and teams.',
    sections: [
      { slug: '', title: 'Employee directory' },
      { slug: 'invitations', title: 'Invitations' },
      { slug: 'teams', title: 'Teams' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Manage workspace preferences and employee settings.',
    sections: [
      { slug: '', title: 'Settings overview' },
      { slug: 'profile', title: 'Profile' },
      { slug: 'preferences', title: 'Preferences' },
      { slug: 'notifications', title: 'Notification settings' },
      { slug: 'access', title: 'Role access' },
    ],
  },
];

export function workspaceHref(moduleId: WorkspaceModuleId, sectionSlug = ''): string {
  return sectionSlug ? `/${moduleId}/${sectionSlug}` : `/${moduleId}`;
}

export function findWorkspaceModule(id: string): WorkspaceModule | undefined {
  return WORKSPACE_MODULES.find((workspaceModule) => workspaceModule.id === id);
}

export function getWorkspacePage(segments: readonly string[]): WorkspacePage | null {
  if (segments.length < 1 || segments.length > 2) {
    return null;
  }

  const workspaceModule = findWorkspaceModule(segments[0]);

  if (!workspaceModule) {
    return null;
  }

  const sectionSlug = segments[1] ?? '';

  const section = workspaceModule.sections.find((item) => item.slug === sectionSlug);

  if (!section) {
    return null;
  }

  return {
    module: workspaceModule,
    section,
    title: section.slug ? section.title : workspaceModule.title,
    href: workspaceHref(workspaceModule.id, section.slug),
  };
}

export function getWorkspacePageFromPath(pathname: string): WorkspacePage | null {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 3 && segments[0] === 'leads' && segments[1] === 'details') {
    const workspaceModule = findWorkspaceModule('leads');

    if (!workspaceModule) {
      return null;
    }

    return {
      module: workspaceModule,
      section: {
        slug: 'details',
        title: 'Lead details',
      },
      title: 'Lead details',
      href: pathname,
    };
  }

  return getWorkspacePage(segments);
}

export function getWorkspaceStaticParams(): {
  segments: string[];
}[] {
  return WORKSPACE_MODULES.flatMap((workspaceModule) =>
    workspaceModule.sections.map((section) => ({
      segments: section.slug ? [workspaceModule.id, section.slug] : [workspaceModule.id],
    })),
  );
}

export function getWorkspaceSearchLinks(): WorkspaceSearchLink[] {
  return WORKSPACE_MODULES.flatMap((workspaceModule) =>
    workspaceModule.sections.map((section) => {
      const title = section.slug ? section.title : workspaceModule.title;

      return {
        moduleId: workspaceModule.id,
        moduleTitle: workspaceModule.title,
        title,
        href: workspaceHref(workspaceModule.id, section.slug),
        isRoot: section.slug === '',
        searchText:
          `${workspaceModule.title} ${section.title} ${workspaceModule.description}`.toLowerCase(),
      };
    }),
  );
}
