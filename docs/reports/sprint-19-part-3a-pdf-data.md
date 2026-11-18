# Sprint 19 Part 3A — Draft PDF data foundation

Based on the inspected GitHub main commit 025d9aa. Earlier audit and deployment
working trees were preserved. This part continues Sprint 19; Sprint 20 is not started.

## Delivered

An explicit PDF data projection selects an exact saved quotation version, retains
its commercial revision and save timestamp, verifies all recorded financial values
against the existing decimal-safe policy, and excludes internal notes and employee
identities. It preserves nullable customer fields, manual VAT text, item order and
same-name sections. Room database references are omitted from the document data.

The internal server loader requires quotations.view and uses both existing
resource-authorized read RPCs. It exposes no new Server Action or HTTP route.
The projection function alone does not authorize callers; use the server loader
when integrating the renderer. No customer data is logged.

## Files

New: pdf-model.ts, pdf-model-service.ts, quotation-pdf-model unit and integration
tests, playwright.quotation-pdf.config.ts, and this report. No existing source file
was modified. No dependency, environment variable or migration was added.

## Verification

- Nine new unit cases and one rollback-only local database case passed.
- Existing quotation unit selection: 40 passed.
- TypeScript, ESLint and production build passed.
- The database case retrieved Revision 1 evidence after Revision 2 was edited.
  Its synthetic Auth account, lead, quotation and audit data rolled back.
- Changed-file formatting and diff checks passed.

The server loader has not been exercised through a PDF HTTP endpoint because that
endpoint is not part of this delivery. Existing browser suites were not rerun;
this part adds no browser interaction. Windows commands and hosted feature tests
were not executed. No hosted database, Vercel deployment or production data changed.

## Remaining work and checkpoint

This part does not generate PDF bytes or add a download button. Rendering,
pagination, approved fonts/languages, branding, private PDF storage and access
auditing remain in the following Sprint 19 parts. Company address/contact text
and language requirements were requested; no legal details were invented.
Unicode preservation in the model is not a claim of Arabic PDF rendering support.

AI concept asset management and usage accounting remain pending. Live AI generation
stays disabled until provider, budget and data-handling approval. Sprint 20 approvals,
Sprint 21 delivery/negotiation, and Sprint 22 conversion/handover remain later work.

Run the provided local checks and report results. Supply the PDF language and
company details before renderer integration. Do not begin Sprint 20.