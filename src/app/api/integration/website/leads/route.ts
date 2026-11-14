import { captureBody, receiveWebsite } from '@/features/lead-capture/workflow';
import { captureFailure, captureJson } from '@/features/lead-capture/http';
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    return captureJson(
      await receiveWebsite(
        request.headers.get('x-afaq-connection-id') ?? '',
        request.headers,
        await captureBody(request),
        url.pathname + url.search,
      ),
      202,
    );
  } catch (error) {
    return captureFailure(error);
  }
}