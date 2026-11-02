export type RecoveryRequestState = {
  status: 'idle' | 'invalid' | 'submitted' | 'error';
  message: string | null;
  fieldError?: string;
};

export type EmailLinkState = {
  status: 'idle' | 'error';
  message: string | null;
};

export type PasswordUpdateState = {
  status: 'idle' | 'invalid' | 'error' | 'updated';
  message: string | null;
  fieldErrors: {
    password?: string;
    confirmPassword?: string;
  };
};

export const INITIAL_RECOVERY_REQUEST_STATE: RecoveryRequestState = {
  status: 'idle',
  message: null,
};

export const INITIAL_EMAIL_LINK_STATE: EmailLinkState = {
  status: 'idle',
  message: null,
};

export const INITIAL_PASSWORD_UPDATE_STATE: PasswordUpdateState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
};
