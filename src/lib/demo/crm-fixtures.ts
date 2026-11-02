import 'server-only';

import type { DemoDataset, DemoLead } from '@/types/demo-crm';

type LeadSeed = Pick<
  DemoLead,
  | 'id'
  | 'clientName'
  | 'title'
  | 'propertyType'
  | 'budget'
  | 'source'
  | 'priority'
  | 'stage'
  | 'ownerId'
  | 'createdOn'
  | 'nextFollowUpOn'
>;

const LEAD_SEEDS: LeadSeed[] = [
  {
    id: 'demo-001',
    clientName: 'Noor Rahman',
    title: 'Warm contemporary villa',
    propertyType: 'Villa',
    budget: 125000,
    source: 'Website',
    priority: 'high',
    stage: 'new',
    ownerId: 'owner-a',
    createdOn: '2026-10-29',
    nextFollowUpOn: '2026-10-31',
  },
  {
    id: 'demo-002',
    clientName: 'Omar Hassan',
    title: 'Family apartment refresh',
    propertyType: 'Apartment',
    budget: 85000,
    source: 'Meta Lead Ads',
    priority: 'high',
    stage: 'assigned',
    ownerId: 'owner-b',
    createdOn: '2026-10-28',
    nextFollowUpOn: '2026-10-30',
  },
  {
    id: 'demo-003',
    clientName: 'Lina Farooq',
    title: 'Minimal living spaces',
    propertyType: 'Apartment',
    budget: 64000,
    source: 'Phone',
    priority: 'normal',
    stage: 'contacted',
    ownerId: 'owner-a',
    createdOn: '2026-10-26',
    nextFollowUpOn: '2026-10-29',
  },
  {
    id: 'demo-004',
    clientName: 'Salim Nasser',
    title: 'Villa interior package',
    propertyType: 'Villa',
    budget: 180000,
    source: 'Referral',
    priority: 'urgent',
    stage: 'requirements',
    ownerId: 'owner-c',
    createdOn: '2026-10-22',
    nextFollowUpOn: '2026-10-31',
  },
  {
    id: 'demo-005',
    clientName: 'Maya Khalid',
    title: 'Creative office fit-out',
    propertyType: 'Office',
    budget: 95000,
    source: 'Website',
    priority: 'normal',
    stage: 'site-visit',
    ownerId: 'owner-b',
    createdOn: '2026-10-19',
    nextFollowUpOn: '2026-11-02',
  },
  {
    id: 'demo-006',
    clientName: 'Farah Ali',
    title: 'Premium villa renovation',
    propertyType: 'Villa',
    budget: 210000,
    source: 'Meta Lead Ads',
    priority: 'high',
    stage: 'quotation-shared',
    ownerId: 'owner-a',
    createdOn: '2026-10-16',
    nextFollowUpOn: '2026-10-30',
  },
  {
    id: 'demo-007',
    clientName: 'Rami Saeed',
    title: 'Modern family home',
    propertyType: 'Villa',
    budget: 145000,
    source: 'Manual',
    priority: 'high',
    stage: 'negotiation',
    ownerId: 'owner-c',
    createdOn: '2026-10-12',
    nextFollowUpOn: '2026-10-28',
  },
  {
    id: 'demo-008',
    clientName: 'Hana Yusuf',
    title: 'Soft neutral apartment',
    propertyType: 'Apartment',
    budget: 72000,
    source: 'Referral',
    priority: 'normal',
    stage: 'requirements',
    ownerId: 'owner-b',
    createdOn: '2026-10-08',
    nextFollowUpOn: '2026-11-01',
  },
  {
    id: 'demo-009',
    clientName: 'Karim Adel',
    title: 'Completed sales example',
    propertyType: 'Villa',
    budget: 165000,
    source: 'Meta Lead Ads',
    priority: 'normal',
    stage: 'won',
    ownerId: 'owner-a',
    createdOn: '2026-10-04',
    nextFollowUpOn: null,
  },
  {
    id: 'demo-010',
    clientName: 'Sara Ibrahim',
    title: 'Closed inquiry example',
    propertyType: 'Apartment',
    budget: 58000,
    source: 'Phone',
    priority: 'low',
    stage: 'lost',
    ownerId: 'owner-c',
    createdOn: '2026-10-02',
    nextFollowUpOn: null,
  },
  {
    id: 'demo-011',
    clientName: 'Adam Nabil',
    title: 'Compact studio update',
    propertyType: 'Apartment',
    budget: 42000,
    source: 'Website',
    priority: 'low',
    stage: 'new',
    ownerId: 'owner-b',
    createdOn: '2026-09-24',
    nextFollowUpOn: '2026-10-30',
  },
  {
    id: 'demo-012',
    clientName: 'Leila Samir',
    title: 'Calm workspace redesign',
    propertyType: 'Office',
    budget: 110000,
    source: 'Meta Lead Ads',
    priority: 'normal',
    stage: 'contacted',
    ownerId: 'owner-a',
    createdOn: '2026-10-30',
    nextFollowUpOn: '2026-10-31',
  },
];

function createLead(seed: LeadSeed): DemoLead {
  const roomNames =
    seed.propertyType === 'Office'
      ? ['Reception', 'Meeting room', 'Open workspace']
      : ['Living room', 'Main bedroom', 'Kitchen'];

  return {
    ...seed,
    email: seed.id + '@example.invalid',
    phoneDisplay: '+971 5X XXX XXXX',
    location: 'Dubai · sample location',
    summary:
      'Fictional inquiry exploring warm neutral finishes, practical storage and a consistent interior language.',
    requirements: [
      {
        id: seed.id + '-scope',
        label: 'Initial scope captured',
        completed: true,
      },
      {
        id: seed.id + '-budget',
        label: 'Budget preference recorded',
        completed: true,
      },
      {
        id: seed.id + '-measurements',
        label: 'Site measurements reviewed',
        completed: false,
      },
      {
        id: seed.id + '-references',
        label: 'Reference direction reviewed',
        completed: false,
      },
    ],
    rooms: roomNames.map((name, index) => ({
      id: seed.id + '-room-' + index,
      name,
      areaLabel: 'Measurement pending',
      requirements:
        'Sample preference: warm materials, comfortable lighting and integrated storage.',
    })),
    notes: [
      {
        id: seed.id + '-note-1',
        body: 'Sample note: discuss material preferences during the next conversation.',
        authorId: seed.ownerId,
        createdAt: seed.createdOn + 'T09:00:00+04:00',
      },
    ],
    activities: [
      {
        id: seed.id + '-activity-1',
        kind: 'inquiry',
        summary: 'Sample inquiry received through ' + seed.source + '.',
        at: seed.createdOn + 'T09:00:00+04:00',
      },
    ],
    attachments: [
      {
        id: seed.id + '-attachment-1',
        name: 'Sample requirements brief.pdf',
        kind: 'PDF',
        sizeLabel: '1.2 MB',
      },
      {
        id: seed.id + '-attachment-2',
        name: 'Sample room reference',
        kind: 'Image',
        sizeLabel: 'Preview only',
      },
    ],
  };
}

const DEMO_DATA: DemoDataset = {
  asOfDate: '2026-10-30',
  owners: [
    { id: 'owner-a', name: 'Aisha Karim', label: 'Sample sales owner' },
    { id: 'owner-b', name: 'Daniel Reed', label: 'Sample sales owner' },
    { id: 'owner-c', name: 'Mariam Noor', label: 'Sample sales owner' },
  ],
  leads: LEAD_SEEDS.map(createLead),
  quotations: [
    {
      id: 'quote-demo-01',
      leadId: 'demo-006',
      title: 'Villa renovation',
      version: 'V2',
      amount: 198000,
      createdOn: '2026-10-27',
      status: 'pm-review',
    },
    {
      id: 'quote-demo-02',
      leadId: 'demo-007',
      title: 'Family home package',
      version: 'V1',
      amount: 139000,
      createdOn: '2026-10-24',
      status: 'sent',
    },
    {
      id: 'quote-demo-03',
      leadId: 'demo-009',
      title: 'Accepted sample quotation',
      version: 'V2',
      amount: 165000,
      createdOn: '2026-10-03',
      status: 'accepted',
    },
    {
      id: 'quote-demo-04',
      leadId: 'demo-004',
      title: 'Interior package',
      version: 'V1',
      amount: 172000,
      createdOn: '2026-10-29',
      status: 'draft',
    },
    {
      id: 'quote-demo-05',
      leadId: 'demo-008',
      title: 'Apartment finishes',
      version: 'V1',
      amount: 72000,
      createdOn: '2026-10-21',
      status: 'pm-review',
    },
    {
      id: 'quote-demo-06',
      leadId: 'demo-003',
      title: 'Living spaces',
      version: 'V1',
      amount: 61000,
      createdOn: '2026-10-29',
      status: 'approved',
    },
  ],
  projects: [
    {
      id: 'project-demo-01',
      name: 'Palm Villa Refresh',
      focus: 'Design coordination',
      progress: 48,
      targetDate: '2026-11-20',
    },
    {
      id: 'project-demo-02',
      name: 'City Apartment Update',
      focus: 'Procurement',
      progress: 66,
      targetDate: '2026-11-12',
    },
    {
      id: 'project-demo-03',
      name: 'Studio Fit-out',
      focus: 'Site execution',
      progress: 82,
      targetDate: '2026-11-05',
    },
  ],
  approvals: [
    {
      id: 'approval-demo-01',
      title: 'Villa renovation · V2',
      kind: 'Quotation',
      requestedOn: '2026-10-27',
      href: '/quotations/approvals',
    },
    {
      id: 'approval-demo-02',
      title: 'Apartment finishes · V1',
      kind: 'Quotation',
      requestedOn: '2026-10-21',
      href: '/quotations/approvals',
    },
    {
      id: 'approval-demo-03',
      title: 'Living room concept · R3',
      kind: 'Design',
      requestedOn: '2026-10-29',
      href: '/design/reviews',
    },
  ],
};

export function getDemoDataset(): DemoDataset | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return structuredClone(DEMO_DATA);
}
