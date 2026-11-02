# Afaq Al Manzel Interiors CRM — Architecture Decisions

Document version: 0.3
Phase: 0
Sprint: 02
Status: Active decision register

## 1. Interpretation

Accepted:
Explicitly approved by the user.

Conditional:
Approved preference subject to identified verification.

Proposed:
Design recommendation awaiting review.

Open:
A business answer or technical verification remains necessary.

This register records newer decisions that supersede older Open labels
in the original Sprint 01 documents.

Approval of recommendations does not invent answers to unresolved
tax, purchasing, retention or other business-policy questions.

No secret values belong in this file.

## ADR-001 — Sprint authorization

Status: Accepted.

Sprint 01 is approved.
Sprint 02 is authorized and in progress.

The user has reported saving Sprint 02 Parts 1 and 2A through 2F.
Saving Part 2G has not yet been explicitly confirmed.

Do not begin Sprint 03 without approval.
Do not initialize the application or apply migrations in this design delivery.

## ADR-002 — Technology

Related: DEC-001.
Status: Conditional.

Proposed stack:
Next.js, React, TypeScript, Supabase and Vercel.

Verify residency, security, capability and costs before selecting services.

Final versions, plans and compatible deployment arrangements remain open.
Provider compatibility has not been established.

## ADR-003 — Company and scale

Related: DEC-002.
Status: Accepted.

One company:
Afaq Al Manzel Interiors.

Planning estimates:
20 employees and 3 active projects.

Do not introduce multi-company functionality without a new requirement.

These estimates are not measured performance guarantees.

## ADR-004 — Access principles

Related: DEC-003.
Status: Accepted principles; detailed catalog under design.

- Management accesses explicitly authorized domains.
- Sales accesses assigned records and related customer context.
- PMs access assigned projects.
- Designers and Site Engineers access assigned work.
- Procurement and Finance access authorized domains.
- Multiple roles are supported.
- Combined permissions do not bypass business prerequisites.
- External clients do not receive employee access.

Explicit-denial behavior, exceptional delegation and final grants remain open.

## ADR-005 — PM financial visibility

Related: DEC-003.
Status: Accepted.

PMs may view financial information for assigned projects.

Not automatically granted:
Organization-wide finance access, posting, issuing invoices, corrections,
configuration or exports.

Earlier matrix proposals must be reconciled accordingly.

## ADR-006 — PM quotation self-approval

Related: DEC-013.
Status: Accepted.

An authorized PM may approve a quotation they prepared.

Exact-version, record-scope and current-authority checks still apply.

This does not permit impersonating a client's design approval.

Exceptional delegation remains open.

## ADR-007 — PM selection before Won

Related: DEC-005.
Status: Accepted.

An eligible PM must be selected before successful Won conversion.

Ownership, outcome and project creation must remain consistent.

Successful conversion immediately creates one project.
Payment and completed handover are not prerequisites.
Retries/concurrent requests cannot create duplicates.

## ADR-008 — Commercial prerequisite for Won

Related: DEC-005, DEC-006, DEC-014.
Status: Accepted prerequisite; evidence policy remains open.

Require:
- PM approval of an exact quotation version.
- Client acceptance of that same version.
- An eligible selected PM.

Preserve accepted version and scope.

Permitted quotation acceptance evidence and revocation/correction handling
still need business policy.

Commercial acceptance is separate from client design approval.

## ADR-009 — Currency

Related: DEC-007.
Status: Accepted initial scope.

AED only.
No general foreign-exchange conversion initially.
Use precise decimal arithmetic.

Tax, rounding, monetary correction and reporting details remain open.

## ADR-010 — Units

Related: DEC-007.
Status: Accepted initial scope.

No automatic unit conversions.

Validate controlled compatible units.
Final unit catalogue, quantity precision and valuation remain open.

## ADR-011 — Client invitation and identity verification

Related: DEC-004, DEC-029.
Status: Accepted direction; technical implementation pending.

Send the review invitation manually through WhatsApp.

Require an email OTP before allowing a client design decision.

Rules:
- Invitation delivery and identity verification are separate.
- Forwarded-link possession alone cannot authorize approval.
- Bind verification to the designated contact, grant and review context.
- External clients receive no employee roles.
- Email provider and processing arrangements require verification/approval.
- Official WhatsApp API and paid automatic messaging are not selected.

A client without access to the designated email cannot use this flow.
Any assisted or alternative verification process requires separate approval.

Timeouts, rate limits and recovery details remain technical proposals
until security review.

## ADR-012 — UAE policy

Related: DEC-008.
Status: Accepted policy; compatibility unverified.

Keep core customer records, private files and backups in verified UAE locations.

External processing requires explicit approval for the purpose, data and provider.

Review application/worker processing, authentication, logs, email, AI,
support and subprocessor arrangements.

Customer photo processing requires applicable authorization.
Minimize sensitive information in ordinary email/WhatsApp notifications.

No foreign storage substitute is approved.
No provider residency or legal-compliance claim is established.

Use synthetic data until relevant services are approved.

## ADR-013 — Retention

Related: DEC-008.
Status: Open.

The company has no existing retention policy.

Define retention/deletion for customer records, files, financial evidence,
authentication data, audit and backups.

Do not invent automatic deletion or indefinite retention as approved policy.
Archiving is separate.

## ADR-014 — Background execution

Related: DEC-009.
Status: Requirement accepted; mechanism open.

Require durable jobs, bounded retries, truthful execution provenance,
duplicate protection, authorized execution, monitoring and cost review.

Worker deployment/provider and scheduling remain unselected.

Unknown external outcomes must not trigger blind repeated billable actions.

## ADR-015 — Commercial and design integrity

Status: Baseline retained.

- Quotation decisions reference exact versions.
- Changed approved content creates new versions.
- Won references eligible approved and accepted commercial content.
- PM/client design approvals must match the same revision.
- Execution release requires eligible matching approvals.
- Preserve historical content and decisions.

Review order, revocation and reviewer multiplicity remain open.

## ADR-016 — Sprint boundary

Status: Accepted.

Deliver architecture and schema documents.

Do not execute migrations, provision production services, activate paid
integrations or begin Sprint 03 through this delivery.

## ADR-017 — Physical schema proposals

Status: Proposed.

Dictionaries specify reviewable:
- Typed relationships.
- Controlled archiving.
- Immutable snapshots.
- Critical transactions.
- Duplicate-safe conversion/posting.
- Explicit financial sources.
- Scoped client access.
- Execution provenance.

Physical definitions remain subject to complete Sprint 02 review.

## ADR-018 — Direct project actual-cost recognition

Related: DEC-019.
Status: Accepted recognition trigger; detailed policy still incomplete.

Recognize eligible direct project costs when Finance posts the supplier
bill or expense.

Do not wait for supplier cash payment to recognize those eligible costs.

Required:
- Posted source.
- Valid direct-project allocation.
- Approved cost basis.
- Appropriate project/category.
- One recognized effect per eligible source.
- Traceable corrections.
- No duplicate cost from later payment.

Tax cost treatment, recognition-date rules and final profitability
definitions remain open.

## ADR-019 — Warehouse valuation

Related: DEC-007, DEC-019.
Status: Explicitly open for Finance.

No valuation method is approved.

Do not choose FIFO, weighted average or latest supplier price by default.

Required before warehouse-related project cost implementation:
- Approved valuation policy.
- Enforceable source/valuation records.
- Return, damage and supplier-correction handling.
- Reconciliation with project actual-cost records.

Physical inventory design may proceed independently.
Full warehouse-related project profitability cannot be declared complete.

## 2. Outstanding architecture work

- UAE service compatibility.
- Full client verification/security implementation design.
- Effective approval/revocation rules.
- Role conflicts and exceptional delegation.
- Final actor-field reconciliation.
- Commercial variation handling.
- Warehouse valuation.
- Durable job deployment.
- AI usage reconciliation.
- Numbering formats.
- Custom-field scope.
- Recovery targets and retention.
- Outstanding roadmap ownership gaps.

## 3. Reconciliation required before approval

Supply complete updates for affected earlier documents:
- Open-decision status.
- PM financial grants.
- Won prerequisites.
- Client verification.
- Direct-cost recognition.
- UAE policy.
- Changed common columns.
- Remaining schema gaps.

Approval must not conceal unresolved limitations.

## 4. Evidence and limitations

Recorded:
Explicit user decisions and reported document saves.

Not established:
Applied schema, installed services, working authentication, accurate
financial calculations, UAE provider compatibility or passed software tests.

Sprint 02 remains in progress.