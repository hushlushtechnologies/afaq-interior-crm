# Sprint 17 Part 1 — CSV parsing and preview foundation

Status: implemented and locally tested; owner copy/paste verification pending.
Sprint 16 repair acceptance was received before starting this part.

## Delivered

- Pure UTF-8 comma-separated CSV parsing with quoted fields, escaped quotes,
  multiline values, optional BOM and CRLF/LF/CR record separators.
- Bounds: 1 MiB, 500 data rows, 40 columns, 4000 characters per field and
  160 characters per header. Malformed syntax fails the complete file.
- Empty single-field records are counted and ignored after the header.
  Other width mismatches produce row errors. Headers must be nonempty and unique.
- Explicit column mapping, batch source, optional owner and default inquiry date.
  Mapping indices are zero-based. Row numbers are one-based logical CSV record
  numbers, with header 1; multiline fields do not increment record numbers.
- Existing lead field validation, null optional information and decimal budgets.
  International phone formatting is stripped; no country code is guessed.
  Unmapped inquiry dates use the explicitly supplied batch date. A mapped blank
  inquiry date remains invalid. Blank priority uses normal.
- Same-file exact email and cross-primary/alternate-phone duplicate warnings.
  Every candidate row is retained. Names alone do not cause duplicate warnings.
- Ready, invalid and review counts reconcile with all nonblank data records.
- No new dependencies, migrations, endpoints, UI routes, storage or database writes.

New files: src/features/lead-import/csv.ts;
src/features/lead-import/preview.ts; tests/unit/lead-import.spec.ts;
playwright.imports-unit.config.ts; this report.
Previously accepted Sprint 16 repairs remain unchanged.

## Verification

- Import unit tests: 15 passed using synthetic data only.
- Existing lead validation tests: 6 passed.
- TypeScript, ESLint, project/runner formatting and whitespace checks passed.
- Production build passed.
- No browser, database, RLS or live integration test was run for this pure layer.

## Boundaries and pending work

Preview helpers are advisory and must receive the parser output. They are not an
import authorization boundary. Future server workflows must reparse the original
bytes and recheck actor permissions, active sources, eligible owners, current
record visibility, database duplicates and all values before writing.

No database duplicate lookup or duplicate override policy is implemented here.
DEC-011 duplicate resolutions and CSV retention need review before persistent
imports; the existing attachment bucket policy does not authorize CSV uploads.
No row merging, skipping, uploading, external transmission or spreadsheet formula
execution occurs. Formula-like text remains literal data; future CSV export must
apply its own formula-injection protection. This is not malware scanning.

XLSX requires a separate approved parser/dependency. Protected batch storage,
transactional application, idempotency, row history, import UI, capture foundations,
reports, exports and final Phase 3 QA remain later Sprint 17 work. Meta production
access and credentials are not assumed. Historical traceability places Meta in
Sprint 42; reconcile its foundation scope with the newer Phase 3 plan before
implementing that part. Phase 4 has not started.

## Owner checkpoint

Copy all five complete files and run the supplied Windows commands. Expect 15
import tests, six existing lead validation tests and successful static/build
checks. No visible application change is expected. No Supabase migration or
configuration step is required. Stop here before the protected write workflow.