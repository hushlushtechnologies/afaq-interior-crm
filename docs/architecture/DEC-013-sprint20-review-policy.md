# DEC-013 — quotation review authority and assignment

Status: accepted by the project owner on 2026-11-17 (Asia/Dubai).
Applies to Sprint 20. No production deployment is authorized by this decision.

The owner's answers were:
- Require a different reviewer.
- Named PM per submission.

The reviewer must differ from the quotation creator, the latest saved editor and
the submitter. The same restriction applies to dual-role users and Super Admins.
This supersedes the earlier ADR-006 permission for PM quotation self-approval.
No implicit administrative bypass or self-approval exception is permitted.

Each request names one currently eligible active Project Manager. Eligibility
continues to depend on existing membership, view/approval grants and active-user
rules. Having an administrative role alone does not make someone the named PM.

The named PM receives access to that frozen review package and its linked evidence.
This is an approval-resource assignment, not a Sales lead ownership transfer.
Existing role grants and general lead/quotation access remain unchanged.
The current creator/editor/submitter identities are preserved with the request.

Unassigned shared queues, automatic reviewer replacement, delegation and exceptional
override behavior are not approved by these answers. They require explicit rules
before implementation. A reviewer who loses eligibility must lose review access.

This decision does not authorize client delivery, override financial validation,
enable AI generation or permit a lead to become Won without valid project conversion.