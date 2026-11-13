# Sprint 17 Part 6 — CSV safety foundation

Status: partial implementation; protected download blocked on export-grant approval.

## Delivered

- Pure CSV formatter, no database/session access or download route.
- UTF-8 BOM, CRLF records, quoting and escaping of delimiters, quotes and embedded line breaks.
- Apostrophe escaping for formula operators, whitespace/formatting concealment, compatibility operators and leading tab/newline cells; headers receive the same treatment.
- Reject unsupported controls, malformed Unicode, nonfinite/unsafe numeric ranges, excessive columns/rows/cell length and files exceeding 4 MiB. No silent truncation.
- Limits: 1000 data rows, 32 columns, 4000 UTF-16 code units per input cell, 4 MiB serialized UTF-8 including BOM/header/escaping.
- Concrete role/scope, field and workflow proposal in docs/architecture/SPRINT17_EXPORT_AUTHORIZATION_PROPOSAL.md.

New files: src/features/lead-export/csv.ts; tests/unit/lead-export.spec.ts; playwright.exports-unit.config.ts; authorization proposal; this report. No existing files modified.

## Verification

- Export unit suite: 13 passed.
- TypeScript, ESLint, repository formatting, new config formatting and whitespace checks passed.
- Production build, browser downloads, SQL/RLS integration, spreadsheet application execution and Windows commands were not run in this foundation-only part. No endpoint or grant is implemented, so these tests cannot establish a working protected download.

Initial tests identified BOM stripping during the Unicode round-trip check; decoder configuration was corrected. The header-only test now checks the export format directly because the existing import parser intentionally requires data rows.

## Checkpoint

Current requirements distinguish view from export; the installed catalog lacks the export grant. The master plan requires approval before changing this Phase 2 dependency. No migration applied, no production/settings changes, no real messages and no business-data export.

Approve or revise the permission proposal before implementing the protected database/API/UI workflow. Sprint 17 and Phase 3 remain incomplete; live capture remains blocked, and Phase 4 is not authorized. Spreadsheet behavior still requires manual verification in the supported viewer once downloads exist.