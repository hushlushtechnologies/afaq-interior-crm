import { z } from 'zod';
import { getApplicationOrigin } from '@/lib/supabase/server-config';
import { getLocalAttachmentWorkflow } from '@/features/lead-attachments/local-service';
import {
  ATTACHMENT_MAX_BYTES,
  attachmentUploadSchema,
  attachmentReferenceSchema,
  attachmentRemovalSchema,
} from '@/features/lead-attachments/schemas';

type Context = { params: Promise<{ leadId: string }> };

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new SyntaxError('Invalid attachment request.');
  return parsed.data;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
    },
  });
}

async function readBody(request: Request, limit: number) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new Error('Request is too large.');
  if (!request.body) throw new Error('The request body is empty.');

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request body timed out.')), 15000);
  });

  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw new Error('Request is too large.');
      chunks.push(Buffer.from(part.value));
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const invalid = [
    'Request is too large.',
    'The request body is empty.',
    'Request body timed out.',
    'The file size or signature does not match its declared format.',
    'The file is malformed, unsupported, or exceeds validation resource limits.',
  ];

  if (error instanceof SyntaxError || error instanceof URIError || invalid.includes(message)) {
    return json(
      {
        status: 'error',
        message: invalid.includes(message) ? message : 'Invalid attachment request.',
        retryable: false,
      },
      400,
    );
  }

  if (
    message === 'Upload attempt limit reached. Wait one minute.' ||
    message === 'Upload limit reached. Please wait a minute before retrying.'
  ) {
    return json({ status: 'error', message, retryable: true }, 429);
  }

  if (message === 'Local attachment operations are disabled.') {
    return json({ status: 'error', message, retryable: false }, 503);
  }

  if (
    message === 'Cross-origin request denied.' ||
    message === 'Your current account cannot access this lead.' ||
    message === 'Your current account cannot perform this attachment operation.' ||
    message === 'Sign in with an active employee account.' ||
    message === 'Your current account cannot upload to this lead.'
  ) {
    return json(
      {
        status: 'error',
        message: 'Your current account cannot perform this operation.',
        retryable: true,
      },
      403,
    );
  }

  return json(
    {
      status: 'error',
      message: 'The result is unconfirmed. Keep this page open and retry the same request.',
      retryable: true,
    },
    503,
  );
}

async function identity(context: Context) {
  return parseInput(z.uuid(), (await context.params).leadId);
}

function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== getApplicationOrigin())
    throw new Error('Cross-origin request denied.');
}

export async function GET(request: Request, context: Context) {
  try {
    const leadId = await identity(context);
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some((key) => !['page', 'removed'].includes(key)))
      throw new SyntaxError();

    const pageText = url.searchParams.get('page') ?? '0';
    const removed = url.searchParams.get('removed') ?? 'false';

    if (!/^(0|[1-9]\d{0,5})$/.test(pageText) || !['true', 'false'].includes(removed))
      throw new SyntaxError();

    const workflow = await getLocalAttachmentWorkflow();

    return json({
      status: 'ok',
      data: await workflow.list(leadId, Number(pageText), removed === 'true'),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const leadId = await identity(context);
    const header = request.headers.get('x-attachment-request');
    if (!header || header.length > 4096) throw new SyntaxError();

    const input = parseInput(attachmentUploadSchema, JSON.parse(decodeURIComponent(header)));
    if (input.leadId !== leadId || request.headers.get('content-type') !== input.declaredMime)
      throw new SyntaxError();

    const workflow = await getLocalAttachmentWorkflow();
    await workflow.authorizeUpload(leadId);

    // Require an exact raw-file length: Proxy may truncate oversized chunked bodies.
    // Browser File uploads supply Content-Length; ambiguous streaming uploads are rejected.
    if (request.headers.get('content-length') !== String(input.declaredBytes)) {
      throw new Error('The file size or signature does not match its declared format.');
    }

    const bytes = await readBody(request, ATTACHMENT_MAX_BYTES);

    return json({
      status: 'ok',
      data: await workflow.upload(input, bytes),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const leadId = await identity(context);
    const workflow = await getLocalAttachmentWorkflow();
    const input = JSON.parse((await readBody(request, 4096)).toString('utf8'));

    const command = parseInput(
      z
        .object({
          operation: z.enum(['download', 'remove']),
          input: z.object({ leadId: z.uuid() }).passthrough(),
        })
        .strict(),
      input,
    );

    if (command.input.leadId !== leadId) throw new SyntaxError();

    const reference =
      command.operation === 'download'
        ? parseInput(attachmentReferenceSchema, command.input)
        : parseInput(attachmentRemovalSchema, command.input);

    return json({
      status: 'ok',
      data:
        command.operation === 'download'
          ? await workflow.download(reference)
          : await workflow.remove(reference),
    });
  } catch (error) {
    return failure(error);
  }
}