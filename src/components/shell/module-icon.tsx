import {
  BarChart3,
  Contact,
  FileText,
  Folder,
  HardHat,
  LayoutGrid,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { Icon } from '@/components/ui/icon';
import type { WorkspaceModuleId } from '@/types/workspace';

const moduleIcons: Record<WorkspaceModuleId, LucideIcon> = {
  dashboard: LayoutGrid,
  leads: Users,
  quotations: FileText,
  'ai-studio': Sparkles,
  clients: Contact,
  projects: Folder,
  design: Palette,
  site: HardHat,
  procurement: ShoppingCart,
  inventory: Package,
  finance: Wallet,
  reports: BarChart3,
  employees: UsersRound,
  settings: Settings,
};

export function ModuleIcon({
  moduleId,
  size = 'md',
  className,
}: {
  moduleId: WorkspaceModuleId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return <Icon icon={moduleIcons[moduleId]} size={size} className={className} />;
}
