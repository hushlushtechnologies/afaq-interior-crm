export type SampleInquiryValues = {
  clientName: string;
  email: string;
  propertyType: string;
  budget: string;
  contactMethod: string;
  includeSiteVisit: boolean;
  followUpReminder: boolean;
};

export type SampleInquiryErrors = Partial<Record<keyof SampleInquiryValues, string>>;

export const SAMPLE_INQUIRY_DEFAULTS: SampleInquiryValues = {
  clientName: '',
  email: '',
  propertyType: '',
  budget: '',
  contactMethod: 'whatsapp',
  includeSiteVisit: false,
  followUpReminder: false,
};

export const SAMPLE_FIELD_IDS = {
  clientName: 'sample-client-name',
  email: 'sample-email',
  propertyType: 'sample-property-type',
  budget: 'sample-budget',
  contactMethod: 'sample-contact-method',
  includeSiteVisit: 'sample-site-visit',
  followUpReminder: 'sample-follow-up',
} satisfies Record<keyof SampleInquiryValues, string>;

export const SAMPLE_PROPERTY_TYPES = [
  { value: 'villa', label: 'Villa' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'office', label: 'Office' },
] as const;

export const SAMPLE_CONTACT_METHODS = [
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    description: 'Preferred chat channel.',
  },
  {
    value: 'email',
    label: 'Email',
    description: 'Written correspondence.',
  },
  {
    value: 'phone',
    label: 'Phone',
    description: 'Voice conversation.',
  },
] as const;

export function validateSampleInquiry(values: SampleInquiryValues): SampleInquiryErrors {
  const errors: SampleInquiryErrors = {};

  const clientName = values.clientName.trim();
  const email = values.email.trim();
  const budget = values.budget.trim();

  if (clientName.length < 2) {
    errors.clientName = 'Enter a client name with at least 2 characters.';
  } else if (clientName.length > 80) {
    errors.clientName = 'Keep the client name within 80 characters.';
  }

  if (!email) {
    errors.email = 'Enter a sample email address.';
  } else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid sample email address.';
  }

  if (!SAMPLE_PROPERTY_TYPES.some((option) => option.value === values.propertyType)) {
    errors.propertyType = 'Choose a property type.';
  }

  if (budget) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(budget) || !Number.isFinite(Number(budget))) {
      errors.budget = 'Enter an AED amount with no more than 2 decimal places.';
    } else if (Number(budget) <= 0) {
      errors.budget = 'Enter an amount greater than zero.';
    }
  }

  if (!SAMPLE_CONTACT_METHODS.some((option) => option.value === values.contactMethod)) {
    errors.contactMethod = 'Choose a preferred contact method.';
  }

  return errors;
}
