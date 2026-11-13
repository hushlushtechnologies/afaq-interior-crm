# DEC-011 — Sprint 17 import duplicate and retention policy

Owner approved on 2026-11-12 (Asia/Dubai), in response to the policy question.
This decision covers employee-confirmed CSV imports only.

- Exact normalized email and primary/alternate phone matches visible to the
  importing employee are held for review. Names alone are not duplicate evidence.
- Duplicate rows require explicit skipping. No duplicate override or merge exists.
- Invalid rows also require explicit skipping. No invalid row is silently discarded.
- Keep normalized row history and the file hash; do not retain original CSV files.
- Existing lead-create, view and assignment permissions remain authoritative.

Implementation: one bounded batch, private to its initiating employee. Recheck
all inputs and current source/owner eligibility. Check duplicates again before
confirmation. A new visible match returns the batch to review without creating
leads. Otherwise create every selected row and record every explicit skip in one
transaction. Reuse protected lead creation; do not fabricate quotations/projects.

Exact retries replay receipts. Optimistic versions reject stale confirmations.
Current access is checked before returning prior receipts. Created lead history
is redacted from import pages if current lead visibility is lost.

No global duplicate guarantee is claimed: inaccessible records are excluded to
avoid disclosing customer existence. No automatic fuzzy matching is approved.
Raw-file storage, automated ingestion/service actors, wider retention/deletion
schedules and other DEC-011 matching decisions remain separate. The raw file hash
is computed from bytes on the HTTP path; it is not a signed provenance attestation
for direct authenticated RPC callers. Their inputs are still permission-checked.