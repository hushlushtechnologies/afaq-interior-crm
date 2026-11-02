export type DemoStage =
  | 'new'
  | 'assigned'
  | 'contacted'
  | 'requirements'
  | 'site-visit'
  | 'quotation-shared'
  | 'negotiation'
  | 'won'
  | 'lost';

export type DemoPriority = 'low' | 'normal' | 'high' | 'urgent';

export type DemoSource = 'Meta Lead Ads' | 'Website' | 'Phone' | 'Referral' | 'Manual';

export type DemoPeriod = '7' | '30' | 'all';

export type DemoPreviewState = 'ready' | 'loading' | 'empty' | 'error';

export type DemoOwner = {
  id: string;
  name: string;
  label: string;
};

export type DemoRequirement = {
  id: string;
  label: string;
  completed: boolean;
};

export type DemoRoom = {
  id: string;
  name: string;
  areaLabel: string;
  requirements: string;
};

export type DemoNote = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
};

export type DemoActivity = {
  id: string;
  kind: 'inquiry' | 'call' | 'meeting' | 'note';
  summary: string;
  at: string;
};

export type DemoAttachment = {
  id: string;
  name: string;
  kind: 'PDF' | 'Image' | 'Drawing';
  sizeLabel: string;
};

export type DemoLead = {
  id: string;
  clientName: string;
  title: string;
  email: string;
  phoneDisplay: string;
  location: string;
  propertyType: 'Villa' | 'Apartment' | 'Office';
  budget: number;
  source: DemoSource;
  priority: DemoPriority;
  stage: DemoStage;
  ownerId: string;
  createdOn: string;
  nextFollowUpOn: string | null;
  summary: string;
  requirements: DemoRequirement[];
  rooms: DemoRoom[];
  notes: DemoNote[];
  activities: DemoActivity[];
  attachments: DemoAttachment[];
};

export type DemoQuotation = {
  id: string;
  leadId: string;
  title: string;
  version: string;
  amount: number;
  createdOn: string;
  status: 'draft' | 'pm-review' | 'approved' | 'sent' | 'accepted';
};

export type DemoProject = {
  id: string;
  name: string;
  focus: string;
  progress: number;
  targetDate: string;
};

export type DemoApproval = {
  id: string;
  title: string;
  kind: 'Quotation' | 'Design';
  requestedOn: string;
  href: string;
};

export type DemoDataset = {
  asOfDate: string;
  owners: DemoOwner[];
  leads: DemoLead[];
  quotations: DemoQuotation[];
  projects: DemoProject[];
  approvals: DemoApproval[];
};

export type DemoChartPoint = {
  label: string;
  value: number;
};
