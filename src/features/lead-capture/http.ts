import 'server-only';
import { CaptureError } from './workflow';
export function captureJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export function captureFailure(error: unknown) {
  return captureJson(
    {
      status: 'error',
      message:
        error instanceof CaptureError ? error.message : 'Capture result could not be verified.',
    },
    error instanceof CaptureError ? error.status : 503,
  );
}