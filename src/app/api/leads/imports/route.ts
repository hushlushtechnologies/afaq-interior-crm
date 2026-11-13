import { getApplicationOrigin } from '@/lib/supabase/server-config';
import { importUploadSchema } from '@/features/lead-import/contracts';
import {
  confirmLeadImport,
  authorizeImport,
  ImportOperationError,
  loadLeadImport,
  readImportBody,
  stageLeadImport,
} from '@/features/lead-import/service';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    },
  });
}
function failure(error: unknown) {
  if (error instanceof ImportOperationError) {
    return json(
      { status: 'error', message: error.message, retryable: error.retryable },
      error.status,
    );
  }
  return json(
    {
      status: 'error',
      message: 'The import result could not be confirmed. Retry the unchanged request.',
      retryable: true,
    },
    503,
  );
}
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== getApplicationOrigin()) {
      throw new ImportOperationError(403, 'Cross-origin import requests are denied.');
    }
    await authorizeImport();
    if (
      !['text/csv', 'application/octet-stream'].includes(request.headers.get('content-type') ?? '')
    ) {
      throw new ImportOperationError(400, 'Upload the CSV as a raw file body.');
    }
    const header = request.headers.get('x-lead-import');
    let input: unknown;
    try {
      if (!header || header.length > 16384) throw new Error();
      input = JSON.parse(decodeURIComponent(header));
    } catch {
      throw new ImportOperationError(400, 'Provide valid import metadata.');
    }
    const metadata = importUploadSchema.safeParse(input);
    if (!metadata.success)
      throw new ImportOperationError(400, 'Review the import metadata and mapping.');
    return json({
      status: 'ok',
      data: await stageLeadImport(metadata.data, await readImportBody(request)),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const page = query.get('page') ?? '0';
    if (
      [...query.keys()].some((key) => !['batchId', 'page'].includes(key)) ||
      !/^(0|[1-9][0-9]{0,4})$/.test(page)
    ) {
      throw new ImportOperationError(400, 'Choose a valid import page.');
    }
    return json({
      status: 'ok',
      data: await loadLeadImport({ batchId: query.get('batchId'), page: Number(page) }),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (request.headers.get('origin') !== getApplicationOrigin()) {
      throw new ImportOperationError(403, 'Cross-origin import requests are denied.');
    }
    await authorizeImport();
    if (request.headers.get('content-type') !== 'application/json') {
      throw new ImportOperationError(400, 'Send confirmation as JSON.');
    }
    let input: unknown;
    try {
      input = JSON.parse((await readImportBody(request, 16384)).toString('utf8'));
    } catch (error) {
      if (error instanceof ImportOperationError) throw error;
      throw new ImportOperationError(400, 'Provide valid confirmation JSON.');
    }
    return json({ status: 'ok', data: await confirmLeadImport(input) });
  } catch (error) {
    return failure(error);
  }
}
