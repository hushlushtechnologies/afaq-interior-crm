type AuthErrorDetails = {
  name?: string;
  status?: number;
};

export function isAuthServiceFailure(error: AuthErrorDetails): boolean {
  return (
    error.name === 'AuthRetryableFetchError' ||
    (typeof error.status === 'number' && error.status >= 500)
  );
}
