import type { DemoLead, DemoOwner, DemoPriority, DemoSource, DemoStage } from '@/types/demo-crm';

export type LeadView = 'kanban' | 'table';

export type LeadBoardSort = 'newest' | 'budget-high' | 'name';

export type LeadFilters = {
  query: string;
  source: DemoSource | 'all';
  ownerId: string;
  stage: DemoStage | 'all';
  priority: DemoPriority | 'all';
};

export const EMPTY_LEAD_FILTERS: LeadFilters = {
  query: '',
  source: 'all',
  ownerId: 'all',
  stage: 'all',
  priority: 'all',
};

export const DEMO_SOURCES: readonly DemoSource[] = [
  'Meta Lead Ads',
  'Website',
  'Phone',
  'Referral',
  'Manual',
];

export function leadDetailsHref(leadId: string): string {
  return '/leads/details/' + encodeURIComponent(leadId);
}

export function filterDemoLeads(
  leads: readonly DemoLead[],
  owners: readonly DemoOwner[],
  filters: LeadFilters,
): DemoLead[] {
  const query = filters.query.trim().toLowerCase();

  return leads.filter((lead) => {
    if (filters.source !== 'all' && lead.source !== filters.source) {
      return false;
    }

    if (filters.ownerId !== 'all' && lead.ownerId !== filters.ownerId) {
      return false;
    }

    if (filters.stage !== 'all' && lead.stage !== filters.stage) {
      return false;
    }

    if (filters.priority !== 'all' && lead.priority !== filters.priority) {
      return false;
    }

    if (!query) {
      return true;
    }

    const ownerName = owners.find((owner) => owner.id === lead.ownerId)?.name ?? '';

    const searchableText = [lead.clientName, lead.title, lead.location, lead.source, ownerName]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(query);
  });
}

export function sortDemoLeads(leads: readonly DemoLead[], sort: LeadBoardSort): DemoLead[] {
  return [...leads].sort((left, right) => {
    if (sort === 'budget-high') {
      return right.budget - left.budget || left.clientName.localeCompare(right.clientName, 'en');
    }

    if (sort === 'name') {
      return left.clientName.localeCompare(right.clientName, 'en');
    }

    return right.createdOn.localeCompare(left.createdOn) || left.id.localeCompare(right.id);
  });
}
