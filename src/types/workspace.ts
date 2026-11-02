export type WorkspaceModuleId =
  | 'dashboard'
  | 'leads'
  | 'quotations'
  | 'ai-studio'
  | 'clients'
  | 'projects'
  | 'design'
  | 'site'
  | 'procurement'
  | 'inventory'
  | 'finance'
  | 'reports'
  | 'employees'
  | 'settings';

export type WorkspaceSection = {
  slug: string;
  title: string;
};

export type WorkspaceModule = {
  id: WorkspaceModuleId;
  title: string;
  description: string;
  sections: readonly WorkspaceSection[];
};

export type WorkspacePage = {
  module: WorkspaceModule;
  section: WorkspaceSection;
  title: string;
  href: string;
};

export type WorkspaceSearchLink = {
  moduleId: WorkspaceModuleId;
  moduleTitle: string;
  title: string;
  href: string;
  isRoot: boolean;
  searchText: string;
};

export type WorkspaceUser = {
  id?: string;
  name: string;
  email: string;
  label: string;
  mode: 'development' | 'authenticated';
};

/**
 * Compatibility alias for the existing shell components.
 */
export type WorkspacePreviewUser = WorkspaceUser;
