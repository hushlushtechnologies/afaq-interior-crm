import { captureBody, processCapture, verifyWorker } from '@/features/lead-capture/workflow';
import { captureFailure, captureJson } from '@/features/lead-capture/http';
export async function POST(request: Request) {
  try {
    const bytes = await captureBody(request, 4096);
    return captureJson(
      await processCapture(verifyWorker(bytes, request.headers.get('x-afaq-worker-signature'))),
    );
  } catch (error) {
    return captureFailure(error);
  }
}