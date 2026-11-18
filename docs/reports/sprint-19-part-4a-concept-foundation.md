# Sprint 19 Part 4A — private concept reference foundation

## Scope and architecture

Based on inspected main 025d9aa plus the preceding Sprint 19 deliveries.
The Phase 0 TABLE_DICTIONARY_AI is proposed physical design and requires real
generation provenance for ai_generation_assets. No AI tables exist in migrations.
DEC-021 remains open: no provider, processing approval or paid generation is enabled.

This additive bridge stores existing validated lead images as concept_references,
not ai_generation_assets. Existing-reference origin and not_requested generation
state are enforced in SQL. No job, fake provider result, cost estimate or sharing
approval is manufactured. Approximate 50-images/month planning is not an enforced
quota. The zero recorded output field describes this disabled foundation only;
confirmedCost=null is not a claim that externally generated images cost nothing.
Real usage/billing reconciliation remains blocked with live provider integration.

Reuses ready PNG/JPEG/WebP attachments and their existing private Storage policy.
No new bucket, file format, upload limit, package or administrative key is added.
PDF source files and cross-lead files are rejected. Optional rooms must belong to
the same lead and be active when registering/selecting. Lost/archived leads and
historical commercial revisions are not writable. Unavailable sources can be
deselected; archiving retains the reference, attribution and audit history.

Both quotation visibility and lead visibility are required. Changes also require
existing quotations.update and an editable current draft. Reference archiving is
a draft-content operation; it does not archive the quotation or add a permission.
RLS and revoked direct table grants prevent raw metadata/receipt/event access.
Signed-in RPCs enforce resource authorization; service-role RPC access is revoked.
Audit events contain identifiers/actions/versions, not prompts or file contents.

## Delivery and migration

New migration: 20261116000200_sprint19_concept_references.sql.
Adds three private tables, scoped RPCs, constraints, indexes and immutable events.
No existing role, financial, quotation, lead stage or Storage policy is changed.
New strict contracts and local-only Server Actions are not connected to UI yet.
ENABLE_LOCAL_QUOTATION_CONCEPTS=true is required when exercising actions locally.
The endpoint, application origin and checked local project must match local setup.

The local SQL integration test rehearses the migration when absent inside a
rollback transaction. Synthetic attachment rows are metadata fixtures, not image
uploads. The rehearsal does not mark migration history applied. No persistent
concept schema or fixture data is left by the test. No production migration ran.
Before persistent local application, review migration history and back up locally.
Keep the migration pending for this checkpoint; apply with the following UI part.
Do not reset the database or delete business/audit history to undo a migration.

## Verification and checkpoint

The integration test covers cross-lead/source validation, room validation,
duplicate rejection, exact retries, stale versions, selection, source removal,
unauthorized and banned employees, old revisions, archive/history, pagination,
raw-table RLS, grants and SQL-to-TypeScript response validation.
Passed: one concept integration case, 40 quotation unit tests, nine PDF workflow
tests, 21 PDF/model tests and one PDF Storage SQL case: 72 cases in total.
TypeScript, ESLint, formatting and production build passed. Cleanup verified one
baseline Auth user, zero leads/quotations/attachments and no rehearsal concept
table or applied concept migration-history entry.
Browser actions, private preview and real image selection remain Part 4B work.
No browser flow is introduced or claimed tested by this delivery.
No external files, prompts or customer information were sent to an AI service.
PDFs do not include these references; selection grants no external sharing rights.

Copy all seven files, run the local test/check commands and report results.
Sprint 19 remains open; Sprint 20 has not started.