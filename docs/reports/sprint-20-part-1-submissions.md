# Sprint 20 Part 1 — protected review submission foundation

Date: 2026-11-17 (Asia/Dubai).
Sprint 19 acceptance and Sprint 20 start follow the owner's latest instruction.
Remote main remains 025d9aa; preceding copy/paste deliveries are present in the
working checkout. Existing changes were preserved, not reset or overwritten.

## Inspection and approved policy

Normal PM assigned permissions could not open a Sales-owned quotation: the legacy
quotation scope follows eligible Sales ownership. A rollback-only preflight test
proves that dependency. The solution introduces request-scoped review access and
does not broaden general lead access, change role grants or transfer Sales ownership.

DEC-013-sprint20-review-policy.md records the owner's accepted different-reviewer
and named-PM rules, superseding ADR-006 self-approval. Creator, latest saved editor
and submitter are all excluded, including dual-role and Super Admin users.

Existing in-app reminders are follow-up-specific. They will not be reused as fake
approval notifications. Decision/queue/notification UI remains later Sprint 20 work.

## Delivered

One additive migration creates private pending requests, retained file references,
retry receipts, guards and signed-in RPCs. Submission validates current quotation
and lead access, expected revision/version, a nonempty item list, authoritative
calculations, saved evidence, reviewer eligibility and selected source availability.
Unknown contacts and existing optional fields remain nullable; no customer details
or tax rules are invented. Zero monetary totals remain governed by the existing
pricing policy. Review evidence has a resource cap of 200 selected images; this is
not an AI quota or monthly usage limit.

The immutable package freezes customer/document/calculation data, relevant collected
requirements/room data and selected-image metadata. Submission locks the current
draft/references and prevents removal or mutation of retained attachment metadata.
Unsubmitted drafts remain editable and can create revisions. Existing draft status
remains separate from review status; no lead stage changes.

Named PMs can read only their assigned package through the new RPC. Legacy live
quotation access remains denied where it was denied before. Ordinary existing
quotation viewers retain financial visibility; linked evidence requires current
lead visibility or eligible named-PM authority. Ineligible PMs lose scoped access.
No direct client table access is granted; RLS stays deny-by-default.

New local-only Server Actions accept identifiers and expected counters only.
ENABLE_LOCAL_QUOTATION_APPROVALS=true, the fixed local endpoint, local application
origin and checked project ID are required. No administrative key is added.

## Migration and checks

20261117000100_sprint20_review_submission.sql was rehearsed in a rollback-only local
transaction; it was not persistently applied and migration history is unchanged.
Synthetic attachment rows test metadata retention; no image bytes were uploaded.
No production setting, real invitation, email or external service was used.

The submission SQL checks cover creator/editor/submitter exclusion, no admin bypass,
named access, Finance evidence redaction, inactive PM denial, snapshot retention,
exact retries, stale/duplicate rejection, draft/concept/file guards, unchanged lead
stage, separate statuses, unsubmitted editing and actual authenticated raw-table RLS.
Typed response contracts are validated against actual PostgreSQL output.
The two new integration cases and 84 existing quotation/security checks passed.
TypeScript, ESLint, formatting and production build passed. Cleanup verified one
baseline Auth user, zero leads/quotations/Storage objects, no review table and no
applied 20261117000100 history entry. No browser suite was rerun for this backend-only
part; the current UI and its existing workflows are unchanged.

This part is backend-only: no submit/review button, approval decision, rejection,
changes-requested transition, queue or notification feature is exposed in the UI.
Requests intentionally remain pending and immutable in this first foundation.
Do not submit genuine business quotations before the decision workflow is delivered.
Run only the isolated test fixtures at this checkpoint. Real parallel submission
stress tests and browser/server-action flows remain for the following parts.

## Next delivery and gate

Next: decision transitions and corrected-revision rules, then the protected queue,
review UI, in-app notification integration and final Sprint 20 verification.
Reviewer reassignment/delegation requires an additional approved policy if needed.
Official client delivery remains Sprint 21; project conversion remains Sprint 22.
Sprint 20 is not complete. Stop for this part's local test results.