# Sprint 15 Part 1 — Audit and validation contract

Sprint 14 was approved by the owner in chat on 2026-11-07. Sprint 15 is authorized; Sprint 16 and Phase 4 are not started. This part is a validation foundation, not completed Lead Details functionality.

## Repository audit

- Working checkout: /workspace/afaq-sprint14-remaining, detached at 0419556 with the previously delivered Phase 2 repairs and Sprint 13/14 changes layered on top. The checkout has existing tracked modifications and untracked files. They were preserved; no reset, commit or push was performed. This audit does not establish what has been copied into the owner's Windows checkout or pushed remotely.
- Architecture: Next.js App Router, strict TypeScript, React, existing semantic Tailwind tokens, Supabase SSR clients, Zod, server services/actions and protected database RPCs. No dependency changes.
- Current lead tables: crm_sales.sources, leads, events, requests, losses and bulk_assignment_requests. No implemented requirement, room, site-visit, editable-note or business file-link tables were found in the application migrations.
- Current record authorization: crm_sales.allowed uses active-account checks and existing company/assigned/own permission scopes. crm_sales.eligible_owner validates Sales ownership. Existing leads.view/update/assign and stage permissions remain unchanged.
- Phase 2 completion and limitations were checked in docs/reports/phase-2-closeout.md and docs/reports/sprint-12-part-2.md. Private Storage containment exists; completed business attachment delivery does not.
- Reusable UI: src/components/leads/lead-details-prototype.tsx, room-reference-preview.tsx, layout/detail-section.tsx, forms/form-field.tsx, ui/dialog.tsx, files/file-picker.tsx, files/local-image-preview.tsx and files/file-preview-dialog.tsx. These include development-only sample data and local previews; they are not database workflows.
- Current real lead UI is src/components/leads/lead-record-workspace.tsx, routed from src/app/(workspace)/[...segments]/page.tsx. Its editor is not yet the complete Lead Details page.
- Phase 0 sources: TABLE_DICTIONARY_CORE.md sections 6.3/6.4, TABLE_DICTIONARY_SALES_SUPPORT.md sections 4/5, TABLE_DICTIONARY_PLATFORM.md section 3, ROLE_PERMISSION_MATRIX.md and REQUIREMENTS_TRACEABILITY.md. REQ-001 maps requirements work to Sprint 15. No contradictory approved sprint tracker was found.
- Existing migrations include the Phase 2 foundations and Sprint 13/14 files through 20261105000400. The earlier unpublished 20261105000200 query draft is not a required migration for the delivered 00400 workflow; do not apply files solely because they exist in this working directory.

## This delivery

- Shared strict schemas for partial requirement collection, room/space notes and internal notes.
- Optional unknown customer information stays null. Money follows the existing AED decimal-text convention; dates are real calendar dates with ordered start/completion values.
- Requirement states follow the approved Phase 3 plan: not_started, in_progress, completed and needs_clarification. Completed is an employee-recorded state, not quotation or engineering approval.
- Request UUIDs and per-record versions prepare retry/concurrency handling. A null version denotes attempted creation; future database operations must enforce uniqueness and reject a conflicting create. Validation alone provides neither authorization nor idempotency.
- Client-supplied actor, role, stage and attachment URL fields are rejected. Server/database authorization is still required in the following delivery.
- Repeated room names are allowed; UUIDs identify records. Measurements remain bounded notes here. No unapproved area-unit catalogue or automatic conversions are introduced.

## Remaining implementation sequence

1. Database and services: explain an additive local migration; map lead-linked requirements/rooms to the Phase 0 conceptual model without fabricating opportunity qualification or project conversion. Add protected transactions, per-record RLS, history, optimistic versions and request receipts. Extend existing lead permissions without changing role grants.
2. Details UI: preserve the prototype hierarchy and reuse existing controls; connect overview, requirements, multiple rooms and internal notes to real records. Implement loading, empty, denied and retry states.
3. Site visits and private attachments: implement authorized records and file links, actual-byte validation, private access, metadata, previews, progress and archive controls. Retain existing Storage deny guards. Do not enable files in ready state without resolving the applicable content/quarantine policy.
4. SQL/browser/static regression and manual acceptance: verify all Sprint 15 scope and existing Sprint 14/Phase 2 protections, then stop for owner acceptance.

## Dependencies and risks

- Phase 0 attaches requirements to conceptual opportunities, while the accepted current implementation stores the working pipeline on leads. The mapping must be explicit before the database delivery; do not create a second pipeline or silently implement conversion.
- Phase 0 unit catalogue/completion rules remain open. This part records measurements as notes and does not invent mandatory checklist questions.
- DEC-025 scanning/quarantine policy remains unresolved in the repository. The existing private bucket has a 10 MiB cap and PDF/PNG/JPEG/WebP allowlist. Those limits do not prove content safety or malware scanning. File activation needs a concrete policy decision before the attachment delivery.
- Site-visit eligibility/status rules and note-edit authority must be made explicit in the service/database delivery. Existing lead visibility is not automatically permission to assign an arbitrary employee or edit another author's note.
- Any required Phase 2 permission/Storage changes must be reported before changing them. No Phase 2 code was changed here.

## Verification

- Eight focused validation tests passed.
- TypeScript and ESLint passed.
- Formatting checks for the three new TypeScript files and git diff --check passed.
- No SQL, Storage, browser or production build tests were executed for this contract-only part; no database or UI behavior changed.
- No migration was created/applied. No local business fixtures, production data, emails, credentials or production settings were changed.

## Copy/paste files

- NEW src/features/lead-details/schemas.ts
- NEW tests/unit/lead-details.spec.ts
- NEW playwright.lead-details-unit.config.ts
- NEW docs/reports/sprint-15-part-1.md

Copy the complete files and run the supplied Windows unit/static commands. There is no visible UI change in this part. Sprint 15 remains in progress; no claim of end-to-end completion or final acceptance is made.