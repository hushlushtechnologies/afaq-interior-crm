# Sprint 15 Part 3 — Real Lead Details UI

Status: implementation delivered; owner Windows/manual verification pending. Sprint 15 remains in progress. Site visits, private attachments and child archive controls are not delivered in this part. Sprint 16 and Phase 4 are not started.

## Changes

- Real UUID records now open at /leads/details/[leadId]. Current session/module/record access is checked on the server before protected data is rendered. Metadata uses a generic title. Invalid or hidden record IDs do not disclose lead information.
- Development sample details remain development-only and retain the existing full-demo permission gate. No sample quotation, image or activity is presented as real business data.
- Full details links appear beside the existing stage controls in the real Table and Kanban. Existing View dialogs continue to handle intake edits, assignment and DEC-010 transitions. Links are disabled during existing list loading/bulk locks.
- The connected workspace reuses DetailSection, PageHeader, badges, form fields, inputs, error summary and Radix-based dialogs with current semantic tokens. It shows overview/contact/owner/source, original inquiry evidence, requirements, multiple rooms and internal notes.
- Partial requirement data is supported. Calendar order, AED precision, room names/order and note bounds use the shared schemas. Measurements are explicitly unverified notes. Completion is employee assessment, not quotation approval or project conversion.
- Requirements, rooms and notes have loading/error/empty states, section reloads, and history showing before/after changes. Rooms and notes paginate in groups of 20. The latest 50 history events per kind are displayed; earlier history remains stored.
- Only one editor or section load is active at a time. Validation errors focus the existing summary. Pending/unconfirmed mutations prevent modal dismissal and preserve the same parsed command, request UUID, record UUID and version for retry. A successful save closes the editor and fetches current records rather than trusting an old replay snapshot.
- Stale versions are rejected without replacement. Lost/archived records and Management visibility are read-only; note editing follows current parent permission and original authorship. The database remains authoritative after permissions or state change while a form is open.
- Authors are identified as You or their stable employee UUID. Human-name lookup is not fabricated or obtained by bypassing employee-directory permissions. Times use Asia/Dubai; intake dates remain calendar dates.
- Browser fixture cleanup removes only generated fixture leads' detail receipts/history/records before their existing parent cleanup. Ordinary application deletion remains unavailable.

## Safety and prerequisites

Part 1 schemas and Part 2 server/database files, including applied local migration 20261107000100, are required. This part creates/applies no migration and changes no role grants, final-Super-Admin protection, Storage policy, quotation/project service or production setting. No real external email or customer data was used; regression invitation delivery is confined to the existing local fixture/email environment.

## Files

- NEW src/components/leads/lead-detail-editor.tsx
- NEW src/components/leads/lead-details-workspace.tsx
- MODIFIED src/app/(workspace)/leads/details/[leadId]/page.tsx
- NEW src/app/(workspace)/leads/details/[leadId]/loading.tsx
- MODIFIED src/components/leads/lead-stage-select.tsx
- MODIFIED tests/helpers/lead-fixtures.ts
- NEW tests/e2e/lead-details.spec.ts
- NEW playwright.lead-details.config.ts
- MODIFIED playwright.config.ts
- NEW docs/reports/sprint-15-part-3.md

## Verification

- Twelve focused desktop/mobile browser checks passed: persisted requirements/room/note operations and history, form validation, duplicate room names, stale updates, lost-response idempotency, Management read-only access, unrelated Sales isolation, pagination and Lost/archive preservation. Main-region WCAG A/AA automated checks passed in the persistence scenario.
- Final sequential npm run test:all passed all 252 browser checks: 140 production, 12 design, 15 shell and 85 prototype. Production builds passed through the runners. The final production run includes all twelve new desktop/mobile checks.
- Thirteen existing detail validation/contract unit checks passed.
- Post-run detail/lead/loss/history/receipt and generated Auth fixture counts were zero; existing setup identities were retained.
- Bounded secret scan checked 40 production client files and the final browser log; no configured private-binding matches. This is not a universal security guarantee.
- Next.js emitted nonfatal listener warnings during action tests. No assertion failed; production-volume performance and listener-lifetime diagnosis were not performed.
- TypeScript, ESLint, project formatting, explicit new-runner formatting and git diff --check passed.
- Part 2's twelve SQL suites passed previously; the database/service files are unchanged and those suites were not repeated here.
- Windows commands and owner manual acceptance have not been executed by the assistant. Automated accessibility checks do not replace keyboard/visual review.

Commands executed: npm run test:all; focused Playwright Lead Details configuration; detail unit configuration; npm run typecheck; npm run lint; npm run format:check; explicit new-runner Prettier check; git diff --check; bounded secret scan and read-only fixture counts. Cloud browser runs used an external installed-Chromium adapter; Windows uses pinned Playwright Chromium.

## Manual checkpoint

Copy all ten complete files before testing. Verify Part 2 migration locally, run unit/static/build/browser checks sequentially, then open a synthetic local lead using Full details. Test partial requirements and invalid dates/budget, repeated rooms, note edits/history, reload persistence, pagination, keyboard focus, mobile layout and current authorization.

For stale edits, use two sessions; cancel the rejected editor and reload before editing again. For a changed lead stage/access, use Reload lead details after closing any editor. For an unconfirmed mutation, retry the same request instead of reopening a new form. Unknown-result retry state is held in the current mounted page, not persisted across a hard reload or browser restart.

No file-upload/reference image or site-visit action is enabled. DEC-025 content/quarantine policy remains an attachment dependency; private Storage guards remain unchanged. Do not declare Sprint 15 complete or begin Sprint 16 before final Sprint 15 scope and owner approval.