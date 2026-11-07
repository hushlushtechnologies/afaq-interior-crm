# DEC-010 — Sales transitions, Lost reasons and reopening

Status: approved by the project owner on 5 November 2026 (Asia/Dubai).
This records the decision that was previously Open in Phase 0 OPEN_DECISIONS.md.
Scope: Sprint 14, DEC-010 and its tests only. No quotation/project workflow changes.

- Preserve existing stage identifiers. Allow forward/backward working moves among new, assigned, contacted, requirements and site-visit.
- Assigned requires an eligible active Sales owner under the existing owner eligibility rules. Move to New before unassigning a lead in Assigned.
- Quotation shared, Negotiation and Won remain blocked; ordinary stage changes cannot fabricate their prerequisites.
- Authorized Sales users operate within existing resource scopes. Super Admin retains company access. No Sales Manager role is invented and Management/Director's existing read-only grants are unchanged.
- Lost requires one approved reason. Other additionally requires an explanation. Internal notes are optional.
- Approved reasons: Budget Too High; Chose Competitor; Client Not Interested; No Response from Client; Project Postponed; Project Cancelled; Requirements Not Matching; Location / Service Area Issue; Timeline Not Suitable; Duplicate Lead; Other.
- Lost records cannot be edited or reassigned until reopened. Authorized archiving retains their evidence.
- Reopening requires a reason and restores the previous working stage. Restore New when the previous stage is invalid, including Assigned with an ineligible/missing owner.
- Each Lost cycle is a new preserved loss record. Reopening never overwrites that record or creates another lead.
- All state changes, actor identities and reasons are recorded transactionally. No-op moves create no fake activity.
- Optimistic versions reject stale changes. Exact request retries do not repeat effects; current authorization is checked before replay.
- Existing source, creator, initial note, lead information and linked history are preserved. This sprint does not implement attachments or qualification/opportunity creation.

Implementation uses the existing inquiries and audit foundation; the owner-approved working-stage/outcome workflow does not fabricate an opportunity, quotation or project.

Manual acceptance and the remaining Sprint 14 features are separate from this decision's implementation. No subsequent sprint is authorized by continuing a code-delivery part.