# Sprint 15 — closeout and remaining reference delivery

Status: accepted for the approved local scope. The owner confirmed all final
balance checks passed and authorized the next sprint in chat on 2026-11-10
(Asia/Dubai). Room-specific and site-visit-specific references were delivered
and included in that confirmation. Sprint 16 is now authorized.

## Scope check

| Sprint 15 requirement | Implementation |
| --- | --- |
| Lead overview and customer/project information | Existing protected real Lead Details |
| Partial requirements and completion states | Implemented with validation/history |
| Multiple rooms, preferences and measurement notes | Implemented; unit catalogue is not invented |
| Internal notes and authorship | Implemented with existing scoped edit rules/history |
| Site visits | Approved Planned/Completed/Cancelled workflow implemented |
| Private uploads/downloads/removal | Implemented under local-only DEC-025 |
| Room references and site-visit attachments | Final balance implementation adds explicit links |
| Access, RLS and history | Existing grant scopes reused; new associations are protected |
| Role and final-Super-Admin preservation | No role grants or protection changes |

## Balance implementation

Migration 20261110000100 adds attachment links, link events and retry receipts,
plus a composite attachment identity constraint. Existing files/records are not
rewritten or copied. Cross-lead attachment/room/visit associations are rejected.
Link creation uses leads.view plus leads.update. Unlinking uses leads.archive.
Unlinking archives the association and keeps its history; it does not delete a file.
Archived rooms and finalized visits reject new association changes. Committed
requests can replay after current authorization without changing finalized records.
Duplicate active associations do not create duplicate rows or artificial events.
Target lists and active/archived association rows are paginated in groups of 20.
Separate audit events remain stored and protected by parent-file visibility.
The existing file-removal policy remains unchanged; removed files keep link metadata.

## Integration and delivery

Complete files are supplied directly in chat in three numbered balance deliveries:
1. Migration, validation/action contracts, SQL verification and this closeout report.
2. Complete new reference UI, complete existing attachment UI and fixture cleanup.
3. Complete browser tests/configuration and final Windows/manual verification.
Delivery continuation is not authorization to begin another sprint.

## Verification

Full test:all passed: 172 production + 12 design + 15 shell + 85 prototype = 284.
Four focused desktop/mobile reference tests passed. All 17 rollback-only SQL suites passed.
TypeScript, lint, project formatting, explicit new-runner formatting and builds passed.
SQL variable ambiguity and fixture ordering assertions were corrected before the final reruns.
The bounded secret scan checked 40 client artifacts and two logs with no configured-secret matches.
Final reference/link-event/receipt/attachment/private-object/generated-Auth fixture counts were zero.
Existing nonfatal Next.js listener and color warnings remain observations, not performance guarantees.
The assistant did not execute the owner's Windows commands or production deployment.

## Acceptance and limitations

The final delivery message supplies Windows commands and the new manual acceptance checklist.
All testing uses dedicated local fixtures; no production migration/settings,
real emails, external scanning or paid providers are used.
No antivirus engine, production rollout or standalone/serverless packaging is approved.
Measurements remain notes until a separately approved unit/checklist policy exists.
Full unified activities/follow-ups/reminders belong to Sprint 16.
Previously documented pending-object reconciliation and mounted-page retry limits remain.
Do not claim universal security, zero defects or production readiness.

The Sprint 15 acceptance gate is satisfied by the owner's reported results.
Production rollout and the limitations above remain outside that acceptance.