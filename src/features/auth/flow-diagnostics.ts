export function reportAuthFlowFailure(stage: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const details =
    typeof error === 'object' && error !== null
      ? (error as {
          name?: unknown;
          code?: unknown;
          status?: unknown;
        })
      : {};

  console.error('AFAQ_AUTH_FLOW_DIAGNOSTIC', {
    stage,
    name: typeof details.name === 'string' ? details.name : 'UnknownError',
    code: typeof details.code === 'string' ? details.code : null,
    status: typeof details.status === 'number' ? details.status : null,
  });
}
