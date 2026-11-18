# Sprint 19 Part 3B — English internal draft PDF renderer

## Scope

Continues the Part 3A data foundation on inspected main commit 025d9aa. The owner
approved English-only rendering for this first internal draft. This delivery
generates real PDF bytes; it does not complete Sprint 19 or begin Sprint 20.

The existing pdf-lib dependency produces deterministic A4 documents from the
authorized Part 3A model. Each page identifies the quotation, commercial revision,
saved version and unapproved draft status. Tables retain item order, section names,
full decimal input precision, discounts, tax and recorded totals. Long rows and
notes can continue across pages; headers and page counts repeat correctly.

The renderer accepts only an internal draft model and never accepts approval or
delivery instructions. Integrating callers must use loadDraftQuotationPdfModel;
do not accept browser-supplied financial models. No new public endpoint exists.

## Files and setup

New: pdf-renderer.ts; quotation-pdf-fixtures.ts; quotation-pdf-renderer.spec.ts;
this report. Modified: playwright.quotation-pdf.config.ts to include renderer tests.
Part 3A files remain required. No dependency, migration or environment key added.

Company address, contact details, license, bank details and logo were not supplied
and are not invented. Only the existing CRM display identity and recorded quotation
VAT text appear. Saved terms remain user-recorded terms, not generated legal text.

## Verification

- Combined PDF selection: 21 passed, including 11 renderer cases, nine model cases
  and one rollback-only local database case.
- Existing quotation unit selection: 40 passed.
- TypeScript, ESLint, formatting and final production build passed.
- The synthetic six-page PDF was parsed and visually inspected. An initial long
  unbroken-text width issue was corrected by measuring the glyph advances emitted
  by PDF text operators. A decoded-output margin regression now covers that case.
- Rendering the same model twice produced identical bytes. Metadata uses the saved
  source timestamp; it is not an actual issuance timestamp.
- Internal-note sentinels, unsafe control characters, unsupported glyphs and resource
  limits were tested. Generated samples contain no PDF JavaScript or annotations.

The cloud preview initially needed a font-substitution configuration for its local
PDF viewer; no application font installation or dependency change was made.
Windows viewing and owner manual checks remain pending. Browser suites were not
rerun because this delivery adds no browser interaction. Hosted Supabase and Vercel
were not changed.

## Limitations and next part

This first renderer uses standard English/WinAnsi PDF fonts. Arabic, emoji and other
unsupported characters are rejected clearly, not silently replaced. It is not an
Arabic renderer, PDF/A document or tagged PDF/UA implementation. Output is bounded
to 80 pages, 600,000 processed text characters and 10 MiB; excess content fails.

The application has no PDF button from this part. Tests write only synthetic PDFs
under the ignored test-results directory. Private Storage, protected download/UI
integration and generation/access audit remain Part 3C work. AI asset management
and final Sprint 19 verification also remain pending; live AI generation is disabled.

Open the synthetic PDF locally, review the first/middle/last pages and recorded
totals, and report results. Do not begin Sprint 20.