import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { attachmentUploadSchema, ATTACHMENT_MAX_BYTES } from './schemas';

const execute = promisify(execFile);
const resolveModule = createRequire(`${process.cwd()}/package.json`);
let running = 0;

// Node-only utility. Import from the protected server workflow, never a Client Component.
// Parsing is isolated from the application process, with no shell or uploaded code execution.
const parser = String.raw`
const chunks = [];
let length = 0;
process.stdin.on('data', chunk => {
  length += chunk.length;
  if (length > 10485760) process.exit(1);
  chunks.push(chunk);
});
process.stdin.on('end', async () => {
  try {
    const bytes = Buffer.concat(chunks);
    const kind = process.argv[1];
    if (kind === 'application/pdf') {
      const p = require(process.argv[2]);
      const doc = await p.PDFDocument.load(bytes, {
        ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false,
      });
      if (doc.isEncrypted || doc.getPageCount() < 1 || doc.getPageCount() > 200) throw Error();
      const forbidden = new Set([
        'A', 'AA', 'OpenAction', 'JS', 'JavaScript', 'Launch', 'URI', 'GoToR',
        'SubmitForm', 'ImportData', 'RichMedia', 'EmbeddedFiles', 'EmbeddedFile',
        'Filespec', 'XFA', 'AcroForm', 'Collection', 'Movie', 'Sound', '3D',
      ]);
      const seen = new Set();
      let count = 0;
      function visit(value, depth = 0) {
        if (!value || seen.has(value)) return;
        if (++count > 100000 || depth > 100) throw Error();
        seen.add(value);
        if (value instanceof p.PDFName && forbidden.has(value.decodeText())) throw Error();
        if (value instanceof p.PDFRef) visit(doc.context.lookup(value), depth + 1);
        else if (value instanceof p.PDFDict) {
          for (const [key, item] of value.entries()) {
            visit(key, depth + 1); visit(item, depth + 1);
          }
        } else if (value instanceof p.PDFArray) {
          for (const item of value.asArray()) visit(item, depth + 1);
        } else if (value instanceof p.PDFStream) visit(value.dict, depth + 1);
      }
      const objects = doc.context.enumerateIndirectObjects();
      if (objects.length > 20000) throw Error();
      for (const [, object] of objects) visit(object);
      process.stdout.write('ok');
    } else {
      const sharp = require(process.argv[2]);
      sharp.cache(false);
      sharp.concurrency(1);
      const image = sharp(bytes, {
        failOn: 'warning', limitInputPixels: 16000000, animated: false,
      }).timeout({ seconds: 5 });
      const meta = await image.metadata();
      const format = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[kind];
      if (meta.format !== format || (meta.pages || 1) !== 1 ||
          !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192) throw Error();
      const output = await image.rotate().toFormat(format).toBuffer();
      if (!output.length || output.length > 10485760) throw Error();
      process.stdout.write(output.toString('base64'));
    }
  } catch { process.exitCode = 1; }
});
`;

function matchesSignature(bytes: Buffer, mime: string) {
  if (mime === 'application/pdf') {
    return (
      /^%PDF-1\.[0-7][\r\n]/.test(bytes.subarray(0, 10).toString('latin1')) &&
      /%%EOF[\t\r\n ]*$/.test(bytes.subarray(-1024).toString('latin1'))
    );
  }
  if (mime === 'image/png')
    return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP' &&
    bytes.length >= 12 &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  );
}

export async function validateAttachmentBytes(input: unknown, bytes: Buffer) {
  const request = attachmentUploadSchema.parse(input);
  if (
    !Buffer.isBuffer(bytes) ||
    !bytes.length ||
    bytes.length > ATTACHMENT_MAX_BYTES ||
    bytes.length !== request.declaredBytes ||
    !matchesSignature(bytes, request.declaredMime)
  ) {
    throw new Error('The file size or signature does not match its declared format.');
  }
  if (running >= 2) throw new Error('File validation is busy. Please retry shortly.');
  const source = Buffer.from(bytes);
  running += 1;
  try {
    const task = execute(
      process.execPath,
      [
        '--max-old-space-size=192',
        '-e',
        parser,
        request.declaredMime,
        resolveModule.resolve(request.declaredMime === 'application/pdf' ? 'pdf-lib' : 'sharp'),
      ],
      {
        timeout: 8000,
        killSignal: 'SIGKILL',
        maxBuffer: 15 * 1024 * 1024,
        encoding: 'utf8',
        windowsHide: true,
        env: {
          NODE_ENV: 'production',
          ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}),
        },
      },
    );
    // The child can terminate while input is being written (timeout or resource failure).
    // Its rejected task supplies the safe error; do not allow an unhandled EPIPE.
    task.child.stdin?.on('error', () => {});
    task.child.stdin?.end(source);
    const { stdout } = await task;
    const validated =
      request.declaredMime === 'application/pdf' ? source : Buffer.from(stdout, 'base64');
    if (
      !validated.length ||
      validated.length > ATTACHMENT_MAX_BYTES ||
      (request.declaredMime === 'application/pdf' && stdout !== 'ok')
    )
      throw new Error();
    return {
      bytes: validated,
      mime: request.declaredMime,
      filename: request.filename,
      sha256: createHash('sha256').update(validated).digest('hex'),
      size: validated.length,
    };
  } catch {
    throw new Error('The file is malformed, unsupported, or exceeds validation resource limits.');
  } finally {
    running -= 1;
  }
}