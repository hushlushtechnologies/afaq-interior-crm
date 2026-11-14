# Sprint 18 Part 3B — Protected draft persistence

Status: implemented and locally tested; awaiting Windows verification.
Sprint 18 remains in progress. Sprint 19 is not authorized.

## Implementation

Five private RLS-enabled tables: counters, quotations, drafts, saves and requests.
Sections and ordered items are stored in the versioned draft document, rather
than duplicate business tables. Each successful save retains a private snapshot
with actor, version, time, document and independently calculated financial data.
Removing a current draft item does not remove its earlier saved evidence.

Quotation numbers use AFAQ-Q-YYYY-000001, the server creation year in Asia/Dubai
and an atomic yearly counter. Six-digit padding expands without truncation.
Create/edit permissions reuse the existing quotation and lead permissions.
Assigned access follows the current eligible lead owner, not the former owner.
Company-wide quotation viewers gain no general Leads permission.
Project Managers receive no new assignments or expanded grants in this part.

Drafts are allowed on authorized active pre-quotation leads, including an
explicitly unassigned lead where company permissions permit. Qualification is
not inferred. Lost and archived leads cannot be changed through this workflow.
Source lead data and the initial customer snapshot are preserved.
Revision 1/draft is the only supported commercial state; lock version tracks
draft saves, not approved commercial revisions. No approval, PDF, delivery,
archive, negotiation, Won or project conversion operation is added.

Entered VAT number, tax treatments and rates remain draft information.
No tax-registry verification or production tax catalog is claimed; commercial
tax-policy validation remains a dependency before official approval/issuance.
The server passes validated inputs, never submitted totals, to PostgreSQL.

The existing eligibility/role advisory lock precedes request/resource locks.
Retries compare the original JSON request and recheck current authorization.
Exact retries return the original result; altered reuse is rejected. Stale
edits fail atomically. After a replay, reload the current draft before editing.
Unknown outcomes require retrying the unchanged input with the same request ID.

## Migrations and verification

20261113000400 adds tables, RLS, helpers and protected read/save RPCs.
Initial local execution revealed a missing explicit PL/pgSQL block label.
20261113000500 repairs that exact function definition without rewriting applied
history; function permissions are preserved. Apply both before using the RPC.
A private full local backup was created and its archive directory verified
before migration. A restore drill was not performed. No production changes.

- Quotation unit tests: 31 passed.
- Quotation database tests: 6 passed, including the earlier 505 pricing comparisons.
- Concurrent tests: six identical retries yield one quotation; six independent
  creates yield unique numbers; two competing edits yield one success/one conflict.
- Actual authenticated-role saves/read responses match server contracts.
- RLS, cross-owner/room access, Finance visibility, inactive accounts, Lost,
  archive, retries, validation and saved-history checks passed locally.
- Existing rollback-only SQL regressions passed: last-super-admin,
  database-authorization, leads, lead-pipeline, lead-details and security-audit.
- TypeScript, ESLint, source/test/config formatting and git diff --check passed.

Synthetic SQL fixtures roll back. Concurrent fixtures commit temporarily and
are removed by their exact IDs afterward. Existing counters are never rewound;
gaps are permitted. Existing roles and final-Super-Admin rules are unchanged.
No real emails, paid services, external APIs, resets or business-data deletion.

Not executed: Windows commands, browser Server Action submission or production
build for a connected quotation UI. No new screen is exposed yet.
Next within Sprint 18: builder, quotation listing, Lead Details integration,
browser verification and final sprint checks. Stop before Sprint 19.