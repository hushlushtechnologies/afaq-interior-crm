# Sprint 15 Part 4C — attachment byte validation

Scope: local validation utility only. No upload endpoint, Storage access, migration,
production setting change, scanner, external file service or UI was enabled.

## Implemented

- Explicit dependencies: sharp 0.35.5 and pdf-lib 1.17.1.
- Existing strict request schema and actual byte count/signature checks.
- PNG/JPEG/WebP decode and re-encode with default metadata stripping.
- Image limits: 16 million pixels, 8192 pixels per dimension, one frame/page.
- Static PDF 1.0–1.7 parsing, unchanged original bytes; encrypted PDFs rejected.
- PDF limits: 200 pages, 20,000 indirect objects, 100,000 visited objects,
  nesting depth 100. Known interactive/action/embedded-file structures rejected.
- Separate Node parser process, eight-second deadline, 192 MiB V8 old-space
  setting, bounded output and two concurrent validations per application process.
- Input snapshot and SHA-256 of the validated result.

## Verification

Five synthetic byte-validation tests and five existing request-schema tests pass.
TypeScript, ESLint, targeted Prettier and git diff whitespace checks pass.
The cloud command sandbox blocks child processes; parser tests were rerun with
the required command execution permission. No database or customer files used.
Browser, production build and attachment RLS tests are pending integration.

## Limits and remaining work

These are validation checks, not antivirus scanning or proof that a PDF is safe.
The PDF parser does not comprehensively validate all content-stream semantics.
V8 old-space is not a hard limit on native process memory. Process isolation is
not an operating-system sandbox. The concurrency limit is not an upload rate
limiter. Future deployment must support Node child processes and explicitly
package parser dependencies; standalone/serverless bundling is not verified.
Protected uploads, Storage cleanup, metadata/history, rate limiting, signed
downloads, removal, UI and end-to-end/RLS tests remain within Sprint 15.
Broader production use remains deferred under DEC-025. Do not start Sprint 16.