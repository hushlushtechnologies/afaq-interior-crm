import { getApplicationOrigin } from '@/lib/supabase/server-config';
import {
  authorizeExport,
  ExportError,
  prepareExport,
  readExportBody,
} from '@/features/lead-export/service';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Cookie',
};
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== getApplicationOrigin())
      throw new ExportError(403, 'Cross-origin exports are denied.');
    await authorizeExport();
    if (request.headers.get('content-type') !== 'application/json')
      throw new ExportError(400, 'Send export filters as JSON.');
    const result = await prepareExport(await readExportBody(request));
    return new Response(result.csv, {
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="afaq-leads-${result.id}.csv"`,
        'X-Export-Row-Count': String(result.count),
      },
    });
  } catch (error) {
    return Response.json(
      {
        status: 'error',
        message:
          error instanceof ExportError
            ? error.message
            : 'The export could not be confirmed. Try requesting a new snapshot.',
      },
      { status: error instanceof ExportError ? error.status : 503, headers },
    );
  }
}