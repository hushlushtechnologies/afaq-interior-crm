# Phase 4 dependency checklist — planning handoff only

Status: prepared from verified Phase 3 interfaces; implementation is not authorized by this document.

## Existing foundations to reuse

- Phase 2 employee sessions, permission scopes, employee eligibility and final-Super-Admin protections.
- Stable crm_sales.leads identity/reference, source provenance, ownership, optimistic versions and retained history.
- Authorized Lead Details requirements, room/site notes, private reference files and recorded activities.
- Existing validation, Server Action/Route Handler conventions, protected transactional database operations and retry receipts.
- Existing design tokens, shell, forms, tables, dialogs, timeline and feedback components.

## Decisions/services required before opening gated stages

| Dependency | Required completion before using it |
| --- | --- |
| Quotation domain | Approved schema, immutable versions, numbering, money/currency/tax/rounding rules and server validation |
| PM approval | Approved actor/scope, delegation and self-approval rules; decisions tied to the exact quotation version |
| PDF generation | Approved template, authorized inputs, safe private output and verified amount/version consistency |
| Delivery/revisions | Real delivery evidence and revision rules; recording intent must not claim successful delivery |
| Quotation Shared/Negotiation | Database transition checks against actual approved quotation workflow evidence, with actor/version/history preservation |
| Client/project linkage | Approved client identity/duplicate policy, a client supporting multiple projects, and retained source lead relationships |
| Won/project conversion | One authorized atomic/idempotent conversion; valid project required before Won, with retry/concurrency/history checks |
| AI concepts | Explicit provider/processing approval, credentials, data/file sharing policy, limits and verified outputs; no external file processing implied |
| Notifications/background work | Approved reliable job authority, receipts, retries and operational ownership for each new workflow |

Do not merely enable blocked stage identifiers, create fake approval/delivery records or create incomplete projects to make a card move. Preserve Lost/reopening behavior and historical access.

## Production and deferred dependencies

- Meta and website live intake remain blocked by SPRINT17_CAPTURE_CONTRACT.md. Employee-only lead creation does not authorize an integration identity; Phase 2 dependency changes need explicit approval.
- DEC-009 is a local reminder scheduling decision only. Broader jobs or production scheduling need their own review.
- DEC-025 provides local file validation, not malware scanning. Resolve the deferred security decision before broader production file processing/use.
- XLSX remains unapproved; no dependency was installed.
- Before production migrations, verify the exact project/environment, backup readiness, SQL/data compatibility, RLS and deployment approval. Local checks do not approve production changes.
- Define supported spreadsheet behavior, operational monitoring, retention and production-volume testing. Private export filters can contain customer search terms.

## Gate

Obtain final Phase 3 local acceptance with its explicit blocked/deferred list, then review the owner's Phase 4 plan. Do not infer authorization to implement quotation, project or AI modules from this checklist.