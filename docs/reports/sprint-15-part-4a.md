# Sprint 15 Part 4A — Safe room/note archiving

Status: implementation delivered and locally verified. Owner manual acceptance is pending. This is the archive delivery within Part 4, not completion of site visits, attachments or Sprint 15. The owner reported Part 3 good before authorizing this work.

## Approved decisions recorded

- docs/architecture/DEC-025-local-attachments.md records the owner's full local-only attachment policy approved on 2026-11-07. Supported formats remain PDF/PNG/JPEG/WebP, maximum 10 MiB, with actual content validation and bounded image decoding. No antivirus, external processing or production rollout is approved. Invalid files must be rejected and partial objects cleaned up; malware risk remains explicit.
- docs/architecture/sprint-15-site-visit-policy.md records Planned/Completed/Cancelled, terminal finalized states, current active lead-owner assignment, historical assignment preservation/review flags, required scheduling/outcome/cancellation evidence, existing lead-update permissions and Dubai-time presentation. No calendar/GPS/customer notifications are approved.
- These decisions remain authorized for subsequent Sprint 15 deliveries; no repeated policy approval is needed.

## Migration explained before local application

20261107000200_sprint15_detail_archive.sql depends on the applied Part 2 migration 20261107000100. Dedicated local project: afaq-interiors-crm-s09-local. A private application-schema dump was created before applying it; a combined migration/fixture preflight passed and rolled back first.

- Adds a nullable archived_at column and pagination index. Existing records remain active; content and creator fields are not rewritten.
- Extends the history action check to include archived. This replaces a check constraint, not a table or business row.
- Moves the old save function to a private, non-client-executable implementation and retains the same public save signature through a guarded wrapper. This prevents direct saves/no-ops on archived records while retaining exact committed-request replay after current authorization.
- Adds protected archive and archived-read RPCs. The existing active-read signature is preserved and delegates to a private shared query implementation. Filtering/counting occurs before pagination, not after it.
- Archive requires current parent leads.view plus leads.archive scope. No roles or grants are broadened. The current Super Admin company archive policy is preserved; Sales/Management receive no new archive authority.
- Only rooms/notes may be archived. Requirements cannot be archived. Lost/archived parents reject new child mutations. Archived children remain readable to employees who can currently view the parent.
- Archive metadata/version, before/after history and the receipt commit atomically. Stale requests reject without partial changes; exact retries do not duplicate history; changed input cannot reuse a receipt.
- Parent lead versions, source, history, ownership and final-Super-Admin protections remain unchanged. No ordinary deletion or restore operation is provided.

## UI and server workflow

Complete server-side input validation, current capability checks and database record authorization protect archive operations. The confirmation dialog retains the same request/record/version through uncertain retries and prevents dismissal until confirmed or a known rejection is returned.

The existing Details workspace offers active/archived room and note views with independent counts and pagination. Archived records display preserved content, author and archive time, with editing/archive/add controls unavailable in that view. History includes archive actor/time. The mounted page retains retry state; a hard reload/browser restart does not persist that state.

## Files

- NEW supabase/migrations/20261107000200_sprint15_detail_archive.sql
- NEW src/features/lead-details/archive-schemas.ts
- NEW src/features/lead-details/archive-actions.ts
- MODIFIED src/features/lead-details/contracts.ts
- NEW src/components/leads/lead-detail-archive.tsx
- MODIFIED src/components/leads/lead-details-workspace.tsx
- NEW tests/sql/lead-detail-archive.sql
- NEW tests/unit/lead-detail-archive.spec.ts
- NEW tests/e2e/lead-detail-archive.spec.ts
- MODIFIED playwright.lead-details-unit.config.ts
- MODIFIED playwright.lead-details.config.ts
- MODIFIED playwright.config.ts
- NEW docs/architecture/DEC-025-local-attachments.md
- NEW docs/architecture/sprint-15-site-visit-policy.md
- NEW docs/reports/sprint-15-part-4a.md

## Verification

- Sixteen detail/archive unit checks passed.
- All thirteen local rollback-only SQL suites passed; the final archive suite additionally verifies positive note archiving after its latest update.
- Twenty focused desktop/mobile detail/archive browser checks passed, including cancellation, persistence, stale rejection, lost-response retry, one archive event and authorized Sales archived visibility without archive controls.
- Full sequential npm run test:all passed all 260 browser checks: 148 production, 12 design, 15 shell and 85 prototype. Production builds passed through the runners.
- The final updated archive SQL suite passed after the browser regression; all thirteen SQL suites have passed.
- The local migration ledger includes 20261107000200. Detail/lead/loss/history/receipt and generated fixture-account counts were zero after testing.
- Bounded secret scan checked 40 production client files and the final browser log with no configured private-binding matches; this is not a universal security guarantee.
- TypeScript, ESLint, project formatting, explicit runner formatting and git diff --check passed.
- No Windows/manual/production-volume verification has been performed by the assistant. Next.js listener warnings remain nonfatal observations, not a claim of a proven leak or production performance.

Commands: private local pg_dump; npx supabase migration up --local; thirteen sequential psql suites; detail unit/focused browser configurations; npm run test:all; npm run typecheck; npm run lint; npm run format:check; explicit runner Prettier; git diff --check; final bounded secret scan and read-only fixture checks.

## Manual checkpoint and remaining Sprint 15 work

Copy all complete files. Review the migration, verify the dedicated local project/ledger, back up local schemas and apply only this explained migration. Run the supplied Windows SQL/unit/static/browser commands sequentially. Verify confirmation cancellation, room/note archiving, archived visibility, retained history, permissions and stale/retry behavior using synthetic local records.

Site visits and attachment processing are not delivered here. Their business/security policies are approved and recorded above. The next numbered delivery implements site visits, followed by local attachment validation/storage and final Sprint 15 verification. No real external emails, customer file processing, paid services, production data/settings, role grants, bucket limits or Storage guards were changed. Existing regression invitation tests use only local fixtures and the local email viewer.

Stop for the archive manual checkpoint. Do not mark Sprint 15 complete or start Sprint 16/Phase 4.