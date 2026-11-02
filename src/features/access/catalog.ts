import type { WorkspaceModuleId } from '@/types/workspace';

export const ROLE_KEYS = [
  'super_admin',
  'management_director',
  'sales_executive',
  'project_manager',
  'interior_designer',
  'site_engineer',
  'procurement_officer',
  'finance_officer',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Readonly<Record<RoleKey, string>> = {
  super_admin: 'Super Admin',
  management_director: 'Management / Director',
  sales_executive: 'Sales Executive',
  project_manager: 'Project Manager',
  interior_designer: 'Interior Designer',
  site_engineer: 'Site Engineer',
  procurement_officer: 'Procurement Officer',
  finance_officer: 'Finance Officer',
};

export const ACCESS_SCOPES = ['own', 'assigned', 'company'] as const;

export type AccessScope = (typeof ACCESS_SCOPES)[number];

export const PERMISSION_LABELS = {
  'dashboard.view': 'View dashboard',

  'leads.view': 'View leads',
  'leads.create': 'Create leads',
  'leads.update': 'Update leads',
  'leads.assign': 'Assign leads',
  'leads.mark_won': 'Mark eligible opportunities Won',
  'leads.mark_lost': 'Mark opportunities Lost',

  'quotations.view': 'View quotations',
  'quotations.create': 'Create quotations',
  'quotations.update': 'Update quotations',
  'quotations.submit': 'Submit quotations for approval',
  'quotations.approve': 'Approve quotations',
  'quotations.share': 'Share approved quotations',
  'quotations.internal_costs.view': 'View quotation internal costs',

  'clients.view': 'View clients',
  'clients.create': 'Create clients',
  'clients.update': 'Update clients',

  'projects.view': 'View projects',
  'projects.update': 'Update projects',
  'projects.financials.view': 'View permitted project financial information',

  'ai_studio.view': 'View AI Studio',
  'ai_studio.generate': 'Request AI generations',

  'design.view': 'View design work',
  'design.update': 'Update design work',
  'design.submit_review': 'Submit design revisions for review',
  'design.approve_internal': 'Approve internal design revisions',

  'site.view': 'View site work',
  'site.update': 'Update site work',

  'procurement.view': 'View procurement',
  'procurement.manage': 'Manage procurement',

  'inventory.view': 'View inventory',
  'inventory.manage': 'Manage inventory',

  'finance.view': 'View financial work',
  'finance.manage': 'Manage financial work',

  'reports.view': 'View permitted reports',
  'employees.view': 'View permitted employee information',
  'settings.view': 'View permitted settings',

  'access.roles.manage': 'Assign and remove employee roles',
} as const;

export type PermissionKey = keyof typeof PERMISSION_LABELS;

export const MODULE_VIEW_PERMISSIONS = {
  dashboard: 'dashboard.view',
  leads: 'leads.view',
  quotations: 'quotations.view',
  'ai-studio': 'ai_studio.view',
  clients: 'clients.view',
  projects: 'projects.view',
  design: 'design.view',
  site: 'site.view',
  procurement: 'procurement.view',
  inventory: 'inventory.view',
  finance: 'finance.view',
  reports: 'reports.view',
  employees: 'employees.view',
  settings: 'settings.view',
} as const satisfies Readonly<Record<WorkspaceModuleId, PermissionKey>>;

export function isPermissionKey(value: unknown): value is PermissionKey {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(PERMISSION_LABELS, value)
  );
}
