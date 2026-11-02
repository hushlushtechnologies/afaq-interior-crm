import type { RoleAccount } from '@/features/access/role-admin-schemas';

export type RoleLookupState = {
  status: 'idle' | 'invalid' | 'found' | 'not-found' | 'denied' | 'unauthenticated' | 'error';
  message: string | null;
  fieldError?: string;
  account: RoleAccount | null;
};

export type RoleChangeState = {
  status: 'changed' | 'denied' | 'unauthenticated' | 'error';
  message: string;
  account: RoleAccount | null;
};

export const INITIAL_ROLE_LOOKUP_STATE: RoleLookupState = {
  status: 'idle',
  message: null,
  account: null,
};
