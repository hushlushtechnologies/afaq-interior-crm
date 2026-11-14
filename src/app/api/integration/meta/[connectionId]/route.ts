import {
  CaptureError,
  captureBody,
  challengeMeta,
  receiveMeta,
} from '@/features/lead-capture/workflow';
import { captureFailure, captureJson } from '@/features/lead-capture/http';
type Context = { params: Promise<{ connectionId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some((k) => query.getAll(k).length !== 1))
      throw new CaptureError(400, 'Duplicate challenge parameters.');
    return new Response(
      await challengeMeta((await params).connectionId, Object.fromEntries(query)),
      {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    return captureFailure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    if (new URL(request.url).search) throw new CaptureError(400, 'Unexpected notification query.');
    return captureJson(
      await receiveMeta(
        (await params).connectionId,
        request.headers.get('x-hub-signature-256'),
        await captureBody(request, 65536),
      ),
      202,
    );
  } catch (error) {
    return captureFailure(error);
  }
}