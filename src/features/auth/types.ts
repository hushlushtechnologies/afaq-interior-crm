export type AuthIdentity = {
  id: string;
  email: string;
};

export type AuthState =
  | {
      status: 'authenticated';
      user: AuthIdentity;
    }
  | {
      status: 'anonymous';
    }
  | {
      status: 'unavailable';
    };

export type SignInActionState = {
  status: 'idle' | 'invalid' | 'error';
  message: string | null;
  fieldErrors: {
    email?: string;
    password?: string;
  };
};

export type SignOutActionState = {
  status: 'idle' | 'error';
  message: string | null;
};

export const INITIAL_SIGN_IN_STATE: SignInActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
};

export const INITIAL_SIGN_OUT_STATE: SignOutActionState = {
  status: 'idle',
  message: null,
};
