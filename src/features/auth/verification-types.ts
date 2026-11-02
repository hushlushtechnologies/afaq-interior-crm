import type { RecoveryRequestState } from '@/features/auth/recovery-types';

export type VerificationRequestState = RecoveryRequestState;

export type EmailCodeState = {
  status: 'idle' | 'invalid' | 'error';
  message: string | null;
  fieldErrors: {
    email?: string;
    token?: string;
  };
};

export const INITIAL_VERIFICATION_REQUEST_STATE: VerificationRequestState = {
  status: 'idle',
  message: null,
};

export const INITIAL_EMAIL_CODE_STATE: EmailCodeState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
};
