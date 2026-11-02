# Afaq Al Manzel Interiors CRM — Business Workflows

Status: Draft — awaiting business review
Document version: 0.1
Phase: 0
Sprint: 01

## 1. Purpose and interpretation

This document defines the 38 workflows required by the supplied Phase 0 plan.

Workflow identifiers WF-001 through WF-038 are stable references.

Requirement identifiers refer to PRODUCT_REQUIREMENTS.md.
Detailed acceptance and sprint mappings will be recorded in:
- ACCEPTANCE_CRITERIA.md
- REQUIREMENTS_TRACEABILITY.md

"Authorized actor" means an active user with the applicable action
permission and record scope. Role names indicate the business participant,
not an approved permission grant.

ROLE_PERMISSION_MATRIX.md remains a proposal.

Conceptual state descriptions below are not final database enums.
Unresolved business policies must be resolved before the affected
implementation is finalized.

No application code, tables or migrations are created by this document.

## 2. Shared workflow rules

### Authorization

Validate access when performing an operation, not merely when opening a page.

Recheck relevant project membership, role, record scope, current state
and file permissions.

An external client review session is not employee access.

### Integrity

Critical operations must commit consistently or leave no partial
required business changes.

Repeated or concurrent requests must not duplicate protected effects.

Do not overwrite submitted/approved versions or posted transaction history.

The technical transaction and background-processing design belongs
to Sprint 02.

### Business changes and notifications

A successfully committed business action must not be undone solely
because a later notification fails.

Notification failure must remain visible to authorized operators.

### Audit and history

For critical operations, preserve the actor, operation, target,
time, relevant version/revision, outcome and permitted change evidence.

Record critical denied or failed attempts where relevant without storing
credentials, approval tokens or unnecessary sensitive content.

User-facing activity history and protected audit records are distinct.

### Open decisions

Where a required policy is unresolved:
- Keep its decision ID visible.
- Do not silently select a recommended option.
- Do not claim the affected workflow is implementation-ready.

### Workflow sequence

The CRM is not one rigid linear sequence.

After project creation, authorized design, site planning, procurement
and financial work may proceed in parallel subject to their own gates.

Project existence, operational readiness, execution progress and
financial settlement are separate concepts.

## WF-001 — Lead creation

Requirements: SAL-001

Trigger:
A new inquiry arrives through an authorized manual or import/integration route.

Actor:
Authorized Sales user or validated ingestion process.

Preconditions:
Source is identified; actor/source is authorized; applicable required
fields and duplicate rules are defined.

Main steps:
1. Capture the inquiry and available contact/project information.
2. Validate fields and source attribution.
3. Check for potential existing leads/clients.
4. Apply the approved match/review policy.
5. Save the lead and creation history.

Alternate paths:
A possible duplicate is flagged for review; an existing client may make
a new inquiry without creating a duplicate customer identity.

Failure cases:
Invalid fields, unauthorized source, failed save or unresolved blocking
duplicate condition.

State changes:
A new lead enters its configured initial state.

Audit requirements:
Record creator/source, creation time and matching/import references.

Completion criteria:
One valid lead exists with traceable origin and no unintended duplicate.
Matching policy remains subject to DEC-011.

## WF-002 — Lead assignment

Requirements: SAL-001, ACC-002

Trigger:
A new lead needs an owner or an existing owner must change.

Actor:
Authorized assignment operator; final role authority requires DEC-003.

Preconditions:
Lead is accessible; assignee is active and eligible; assignment is permitted.

Main steps:
1. Select the lead and eligible assignee.
2. Validate current ownership and assignment authority.
3. Save the new owner.
4. Preserve assignment history.
5. Queue the applicable assignment notification.

Alternate paths:
Reassignment may occur when an employee leaves or workload changes.

Failure cases:
Inactive assignee, revoked permission or concurrent reassignment conflict.

State changes:
Owner changes; a configured stage may change only under approved rules.

Audit requirements:
Record previous/new owner, assigning actor, time and supplied reason.

Completion criteria:
The lead has the intended eligible owner and traceable assignment history.

## WF-003 — Lead qualification

Requirements: SAL-001, REQ-001

Trigger:
Sales evaluates whether an inquiry represents a potential project.

Actor:
Authorized Sales user.

Preconditions:
Lead is accessible; qualification criteria are approved under DEC-010.

Main steps:
1. Review contact and inquiry details.
2. Capture qualification evidence and missing information.
3. Identify the relevant client match where known.
4. Create or link the specific opportunity when the approved criteria are met.
5. Record the qualification result.

Alternate paths:
Keep the lead pending further information or record a nonqualified result
under approved rules.

Failure cases:
Duplicate opportunity, invalid client link or insufficient required evidence.

State changes:
Qualification result changes; opportunity creation is separate from
creating a confirmed project.

Audit requirements:
Record actor, outcome, evidence references and resulting opportunity.

Completion criteria:
The result is traceable, and any opportunity remains distinct from the lead.

## WF-004 — Requirements collection

Requirements: REQ-001

Trigger:
Sales or the assigned PM gathers or updates customer requirements.

Actor:
Authorized Sales user or PM.

Preconditions:
Opportunity exists; actor has edit access.

Main steps:
1. Capture property, location, rooms, preferences, budget and timeline.
2. Add measurements, site notes and required deliverables.
3. Upload authorized reference files.
4. Save partial or reviewed requirements.
5. Preserve relevant change history.

Alternate paths:
Unknown values remain explicitly unknown; requirements can be refined later.

Failure cases:
Invalid values, inaccessible attachment, unsupported upload or stale update.

State changes:
Requirements progress changes without implying technical verification.

Audit requirements:
Record author, time and meaningful changes.

Completion criteria:
Requirements are saved against the correct opportunity, with partial
completion distinguished from approved readiness.

## WF-005 — Site visit

Requirements: FUP-001, REQ-001

Trigger:
A customer visit or site assessment is requested.

Actor:
Authorized Sales user or assigned site/PM participant with scheduling access.

Preconditions:
Accessible opportunity/project, eligible participants and location details.

Main steps:
1. Schedule the visit and record participants.
2. Notify authorized participants.
3. Record attendance, observations and measurements.
4. Attach authorized photos/documents.
5. Update requirements and next actions.

Alternate paths:
Reschedule, cancel or record that the visit could not take place.

Failure cases:
Invalid date/location, unauthorized participant or failed upload.

State changes:
Visit moves from scheduled to completed, cancelled or rescheduled;
exact labels remain provisional.

Audit requirements:
Record scheduling changes, participants, author and evidence references.

Completion criteria:
The visit outcome and follow-up actions are recorded without treating
unverified measurements as certified technical data.

## WF-006 — Follow-up

Requirements: FUP-001, COM-001

Trigger:
A user schedules a customer contact or another follow-up action.

Actor:
Authorized employee responsible for the accessible record.

Preconditions:
Valid owner, related record, schedule and permitted contact information.

Main steps:
1. Record purpose, due date/time and owner.
2. Schedule the approved reminder.
3. Perform and log the call, meeting or contact action.
4. Record outcome.
5. Complete or reschedule the follow-up.

Alternate paths:
Reassign the follow-up or schedule another action.

Failure cases:
Invalid schedule, deactivated owner or failed reminder delivery.

State changes:
Scheduled work becomes completed, rescheduled or cancelled;
overdue is derived from approved rules.

Audit requirements:
Preserve schedule changes, ownership and outcome history.

Completion criteria:
The action has a recorded outcome or a clear next owner/date.
Reminder failure follows WF-038.

## WF-007 — Quotation preparation

Requirements: QUO-001

Trigger:
An opportunity requires a commercial proposal.

Actor:
Authorized Sales user.

Preconditions:
Accessible opportunity/client; approved pricing, tax, rounding,
numbering and payment policies under DEC-012.

Main steps:
1. Create a quotation draft/version.
2. Add room-wise materials/services, quantities, units and prices.
3. Apply permitted discounts and configured taxes.
4. Add terms and payment milestones.
5. Validate totals and generate the internal preview/PDF.
6. Submit the version for PM approval.

Alternate paths:
Save an incomplete draft or revise it before submission.

Failure cases:
Invalid arithmetic, missing required fields, unauthorized discount
or document-generation failure.

State changes:
Draft becomes submitted for approval; submission does not authorize sending.

Audit requirements:
Record author, version, submission and relevant calculation/configuration references.

Completion criteria:
A complete, identifiable version is ready for authorized PM review.

## WF-008 — PM quotation approval

Requirements: QUO-APP-001

Trigger:
A submitted quotation version awaits review.

Actor:
Authorized PM; delegation/self-approval policy requires DEC-013.

Preconditions:
Exact version is available and eligible; reviewer has current authority.

Main steps:
1. Review scope, items, totals, terms and milestones.
2. Confirm the reviewed version identity.
3. Approve or reject that version.
4. Save the decision and comments.
5. Notify authorized Sales participants.

Alternate paths:
Reject through WF-009 or request clarification without approval.

Failure cases:
Unauthorized approver, obsolete version, changed state or concurrent decision.

State changes:
The reviewed version becomes approved or rejected.
Approval of one version does not approve another.

Audit requirements:
Record reviewer, time, version and decision evidence.

Completion criteria:
A valid decision is attached to the exact reviewed version.
Customer sending remains a separate authorized operation.

## WF-009 — Quotation rejection and revision

Requirements: QUO-001, QUO-APP-001

Trigger:
A PM rejects a version or approved commercial content needs changing.

Actor:
Authorized PM records rejection; authorized Sales prepares revision.

Preconditions:
Existing version and accessible rejection/change reason.

Main steps:
1. Preserve the rejected or previously approved version.
2. Record the decision/reason.
3. Create the appropriate revised version.
4. Update commercial content.
5. Validate and resubmit for approval.

Alternate paths:
Sales may abandon the revision while retaining history.

Failure cases:
Attempted historical overwrite, invalid totals or unauthorized revision.

State changes:
The new version begins its own approval lifecycle.
Its existence does not transfer prior approval.

Audit requirements:
Link predecessor/new version and preserve reasons, authors and decisions.

Completion criteria:
The new version can be reviewed independently while historical evidence
remains unchanged.

## WF-010 — Customer quotation acceptance

Requirements: QUO-001, QUO-APP-001

Trigger:
The customer accepts an eligible quotation.

Actor:
Authorized operator recording evidence; identity/evidence policy requires DEC-014.

Preconditions:
Exact version is identifiable and PM-approved; customer communication
and acceptance evidence meet the approved policy.

Main steps:
1. Identify the version presented to the customer.
2. Verify eligibility and acceptance evidence.
3. Record accepting contact, time and evidence.
4. Preserve the accepted scope/version reference.
5. Make it available to Won conversion.

Alternate paths:
Decline, request a revision or investigate acceptance of a superseded version.

Failure cases:
Unapproved version, ambiguous customer evidence or unauthorized recording.

State changes:
Customer acceptance is recorded separately from internal approval
and opportunity outcome.

Audit requirements:
Record version, customer/contact, recorder, time and evidence reference.

Completion criteria:
Acceptance is attributable to the exact eligible version.
It does not itself create a project unless the authorized Won action occurs.

## WF-011 — Won conversion

Requirements: CONV-001, CLI-001, PRJ-001

Trigger:
An authorized user confirms that an opportunity is Won.

Actor:
Authorized conversion operator under DEC-005.

Preconditions:
Conversion prerequisites, accepted scope and PM ownership rule are approved;
opportunity/client references are valid.

Main steps:
1. Validate authority and current outcome.
2. Resolve the existing or new client.
3. Preserve accepted commercial scope.
4. Commit the Won outcome and one linked project consistently.
5. Record PM ownership or approved pending-assignment state.
6. Initiate handover and record audit evidence.
7. Queue authorized notifications.

Alternate paths:
A repeated successful request returns/references the existing project.

Failure cases:
Ambiguous client match, invalid prerequisite, concurrent conflict
or failed required transaction step.

State changes:
Opportunity becomes Won; project exists immediately.
Handover completion and payment are separate.

Audit requirements:
Link opportunity, client, accepted version, project and conversion actor.

Completion criteria:
Exactly one linked project exists after successful conversion.
Required failure leaves no partial conversion.

## WF-012 — Lost opportunity

Requirements: CONV-002

Trigger:
An authorized user records that the opportunity is Lost.

Actor:
Authorized Sales/outcome operator.

Preconditions:
Accessible opportunity; permitted transition; valid configured Lost reason.

Main steps:
1. Select the Lost reason and permitted notes.
2. Validate authority and current state.
3. Save the outcome.
4. Retain linked quotation, activity and communication history.
5. Apply approved follow-up handling.

Alternate paths:
Keep the opportunity open when the decision is not final.
Reopening requires the policy in DEC-010.

Failure cases:
Missing reason, unauthorized transition or conflicting concurrent outcome.

State changes:
Opportunity outcome becomes Lost.

Audit requirements:
Record actor, reason, time and previous outcome.

Completion criteria:
Lost is recorded with a valid reason and preserved history.
No project is created by the Lost operation.

## WF-013 — Repeat customer with a new project

Requirements: CLI-001, SAL-001, CONV-001

Trigger:
An existing client requests additional work.

Actor:
Authorized Sales user.

Preconditions:
Existing client can be reliably identified and accessed.

Main steps:
1. Review the approved client match.
2. Create a distinct opportunity for the new work.
3. Capture project-specific requirements and quotation history.
4. Obtain the required approvals/acceptance.
5. Perform Won conversion when authorized.

Alternate paths:
Route uncertain matching to review rather than merging automatically.

Failure cases:
Incorrect client match, duplicate opportunity or attempted reuse of
another project's scope/history.

State changes:
Existing client gains a new opportunity and, after successful conversion,
a separate project.

Audit requirements:
Preserve client/opportunity/project relationships and matching decisions.

Completion criteria:
One client can have multiple independently tracked projects without
unnecessarily duplicating shared customer information.

## WF-014 — Sales-to-Project handover

Requirements: CONV-001, PRJ-001

Trigger:
Won conversion creates the project and initiates handover.

Actor:
Authorized Sales prepares; assigned/authorized PM reviews.

Preconditions:
Project already exists; accepted scope and source records are accessible.

Main steps:
1. Populate the handover checklist.
2. Link requirements, accepted quotation, references and commitments.
3. Record missing information and responsible owners.
4. Review PM ownership and next actions.
5. Record handover review/readiness under the approved policy.

Alternate paths:
An incomplete handover remains visible while the project continues to exist.

Failure cases:
Missing documents, unavailable owner, unauthorized access or conflicting scope.

State changes:
Handover readiness changes independently of project existence/status.

Audit requirements:
Record checklist changes, reviewers, scope references and outstanding items.

Completion criteria:
Ownership, received information and remaining actions are explicit.
This is the internal Sales-to-Project handover, not final client handover.

## WF-015 — Design task assignment

Requirements: DES-001, PRJ-001

Trigger:
A project needs a design task or package.

Actor:
Authorized PM/design assignment operator.

Preconditions:
Project exists; eligible designer and relevant scope are available.

Main steps:
1. Create/link the task and design package.
2. Define room, deliverables, priority and due date.
3. Assign an eligible employee.
4. Validate project membership and dependencies.
5. Notify the assignee.

Alternate paths:
Reassign or split work into permitted subtasks.

Failure cases:
Inactive designer, inaccessible project or invalid dependency/date.

State changes:
Task becomes assigned; actual design progress is tracked separately.

Audit requirements:
Record creator, assignment changes, dates and deliverable scope.

Completion criteria:
The assignee can access the authorized task and relevant source information.

## WF-016 — Design revision

Requirements: DES-001, DES-APP-001

Trigger:
A designer prepares a new submission or responds to change requests.

Actor:
Authorized assigned Designer.

Preconditions:
Accessible package/project; permitted files and revision operation.

Main steps:
1. Create a new revision identity where required.
2. Upload and associate its drawings/renders/deliverables.
3. Record changes and client-visible/internal notes separately.
4. Validate the submission.
5. Submit the exact revision for the applicable reviews.

Alternate paths:
Save draft work before submission.

Failure cases:
Incomplete upload, unauthorized file, stale update or attempted overwrite
of approved content.

State changes:
The new revision enters its own review lifecycle.

Audit requirements:
Preserve author, predecessor revision, file references and submission time.

Completion criteria:
Reviewers can identify the exact submitted content; prior revisions
and decisions remain preserved.

## WF-017 — PM design approval

Requirements: DES-APP-001

Trigger:
A submitted design revision requires internal PM review.

Actor:
Authorized PM for the project/revision.

Preconditions:
Revision is eligible, accessible and identifiable; review sequence
follows DEC-015.

Main steps:
1. Review the exact submitted revision.
2. Record approval, rejection or requested changes.
3. Preserve comments and decision evidence.
4. Evaluate whether the same revision also has valid client approval.

Alternate paths:
Request clarification or reject through WF-019.

Failure cases:
Unauthorized reviewer, superseded/ineligible revision or concurrent change.

State changes:
PM review result changes for that revision only.

Audit requirements:
Record reviewer, revision, time and decision.

Completion criteria:
A valid PM decision exists for the exact revision.
PM approval alone does not release the design.

## WF-018 — Client design approval

Requirements: ACC-003, DES-APP-001

Trigger:
An authorized client receives a designated design review invitation.

Actor:
Verified/scoped external reviewer under DEC-004.

Preconditions:
Valid review session; correct submission; current access;
approved identity and expiry/revocation policy.

Main steps:
1. Validate the reviewer's scope.
2. Display only client-visible content for the designated revision.
3. Record permitted comments, approval or rejection.
4. Preserve identity evidence and revision reference.
5. Notify authorized internal participants.

Alternate paths:
Request changes or renew access under the approved process.

Failure cases:
Expired/revoked access, wrong revision, unauthorized file request
or failed identity verification.

State changes:
Client review result changes for that revision only.

Audit requirements:
Record attributable reviewer, revision, decision and time;
do not log secret access tokens.

Completion criteria:
A valid client decision exists without exposing internal CRM records.
It cannot replace PM approval.

## WF-019 — Design rejection

Requirements: DES-001, DES-APP-001

Trigger:
An authorized PM or client rejects a revision or requests changes.

Actor:
Authorized reviewer within the relevant review scope.

Preconditions:
Eligible submitted revision and valid reviewer access.

Main steps:
1. Record the rejection/change request against the exact revision.
2. Preserve the feedback.
3. Notify the responsible design team.
4. Create/reassign rework as authorized.
5. Prepare a new revision when content changes.

Alternate paths:
Clarification may resolve a question without changing submitted content,
subject to the approved review policy.

Failure cases:
Unauthorized decision, ambiguous revision or lost feedback submission.

State changes:
The affected review records rejection/changes requested.
A later revision requires its own applicable approvals.

Audit requirements:
Record reviewer, revision, reason and linked rework.

Completion criteria:
The rejected revision cannot be released as approved.
Earlier decisions are not silently transferred to new content.

## WF-020 — Approved design release

Requirements: DES-APP-001, SITE-001

Trigger:
A revision is proposed for release to execution teams.

Actor:
Explicitly authorized release operator; proposed PM authority awaits review.

Preconditions:
Both required approvals are valid for the same revision;
release and revocation rules are approved.

Main steps:
1. Validate both decisions and exact revision identity.
2. Confirm the revision is still eligible.
3. Record the release and approved file set.
4. Make authorized execution references available.
5. Notify relevant project/site users.

Alternate paths:
A later approved revision may supersede the release through controlled change.

Failure cases:
Mixed revisions, missing/revoked approval, inaccessible files
or unauthorized release request.

State changes:
The eligible revision becomes an approved execution release.

Audit requirements:
Link release actor, time, revision and supporting approvals.

Completion criteria:
Execution users can identify the current approved release and distinguish
superseded references.

## WF-021 — Site task execution

Requirements: SITE-001, PRJ-001

Trigger:
An authorized site task is assigned or ready to begin.

Actor:
Assigned Site Engineer or authorized site participant.

Preconditions:
Project access, task scope and any required approved execution references.

Main steps:
1. Review instructions and dependencies.
2. Record work start/progress.
3. Log blockers and material needs.
4. Attach completion evidence.
5. Submit completion for any required review.

Alternate paths:
Pause for a blocker or approved scope/design change.

Failure cases:
Unauthorized project, missing required release, invalid progress
or failed evidence upload.

State changes:
Task progress changes; reported completion is distinct from final acceptance.

Audit requirements:
Record responsible user, progress changes, blockers and evidence.

Completion criteria:
Task outcome is recorded and any required acceptance remains explicit.
Do not assume all site activities must wait for all project designs.

## WF-022 — Site daily reporting

Requirements: SITE-001

Trigger:
The site team records a reporting period's work.

Actor:
Authorized assigned Site Engineer.

Preconditions:
Accessible project/site and approved report requirements.

Main steps:
1. Select the reporting date.
2. Record work, workforce notes and progress.
3. Add issues, blockers, visits and photos.
4. Validate and submit/save the report.
5. Make it available to authorized reviewers.

Alternate paths:
Save a draft or record an approved correction with history.

Failure cases:
Invalid date, inaccessible project, failed upload or duplicate submission.

State changes:
Report moves through its approved draft/submission lifecycle.

Audit requirements:
Record author, reporting date, submission and corrections.

Completion criteria:
The report and its evidence are accessible to authorized users,
with clear reporting dates and authorship.

## WF-023 — Material request

Requirements: SITE-001, PUR-001, INV-001

Trigger:
A project/site needs materials.

Actor:
Authorized site requester or PM.

Preconditions:
Accessible project, identified delivery location and valid material/unit
or an approved description for an uncatalogued need.

Main steps:
1. Record items, quantities, need date and purpose.
2. Link project and delivery location.
3. Submit for the approved review process.
4. Check available stock where authorized.
5. Route to reservation/transfer or purchasing as appropriate.

Alternate paths:
Partially satisfy from stock and purchase the remainder under approved rules.

Failure cases:
Invalid quantity/unit, missing location or unauthorized request.

State changes:
Request records its review and fulfillment progress.

Audit requirements:
Preserve requester, item changes, decisions and fulfillment references.

Completion criteria:
The requirement is traceable to stock movement or purchasing activity.
Submitting a request does not itself move stock or authorize spending.

## WF-024 — Purchase request and approval

Requirements: PUR-001

Trigger:
An authorized need requires procurement.

Actor:
Authorized requester, Procurement operator and designated approver.

Preconditions:
Valid request and approved authority/threshold policy under DEC-016.

Main steps:
1. Prepare requested items, project allocation and justification.
2. Validate quantity, unit and purchasing information.
3. Submit to eligible approvers.
4. Record approval/rejection.
5. Make approved requests available for sourcing/order preparation.

Alternate paths:
Return for clarification, revise or reject.

Failure cases:
Missing policy, unauthorized approver, changed request
or invalid commercial information.

State changes:
Request becomes submitted, approved, rejected or returned under approved rules.

Audit requirements:
Record request version/details reviewed, approver, decision and reason.

Completion criteria:
Procurement can identify which request details were authorized.
Do not invent thresholds or assume every PM can approve spending.

## WF-025 — Purchase order

Requirements: PUR-001

Trigger:
Approved purchasing needs are ready to order.

Actor:
Authorized Procurement operator and required approver/issuer.

Preconditions:
Eligible supplier, approved authority, valid commercial details
and applicable request references.

Main steps:
1. Record supplier quotations and comparison where required.
2. Prepare order items, quantities, prices, terms and project allocation.
3. Obtain applicable approval.
4. Issue the approved order through the authorized process.
5. Track expected deliveries and order balance.

Alternate paths:
Revise before issue or use an approved amendment/cancellation process.

Failure cases:
Unapproved terms, invalid supplier, duplicate issue or failed delivery.

State changes:
Order progresses through draft, approval and issued concepts.
Receiving status changes through WF-026.

Audit requirements:
Preserve approved commercial details, issuer and issue/amendment history.

Completion criteria:
The issued order corresponds to authorized commercial content and remains
distinct from goods receipt, supplier billing and payment.

## WF-026 — Goods receipt

Requirements: PUR-001, INV-001

Trigger:
Ordered goods arrive at an authorized location.

Actor:
Authorized receiving/posting operator under DEC-017 and purchasing policy.

Preconditions:
Valid order/item references where applicable, material/unit/location,
and approved receipt/exception rules.

Main steps:
1. Identify delivery and outstanding quantities.
2. Inspect received quantities and condition.
3. Record accepted, damaged or disputed quantities appropriately.
4. Post approved receipt effects consistently.
5. Update order fulfillment and linked stock evidence.

Alternate paths:
Partial receipt, rejected delivery or approved overdelivery handling.

Failure cases:
Duplicate receipt, invalid unit, unauthorized posting
or quantity exception without approval.

State changes:
Order may become partially or fully received.
Accepted physical stock changes only through valid posting.

Audit requirements:
Link delivery evidence, order items, receiver and stock effects.

Completion criteria:
Accepted receipt quantities reconcile with order progress and stock.
Retrying cannot duplicate the receipt effects.

## WF-027 — Warehouse-to-site transfer

Requirements: INV-001

Trigger:
A project site requires stock from another authorized location.

Actor:
Authorized stock operator and receiving participant under DEC-017.

Preconditions:
Valid locations/material/unit, available quantity and transfer authority.

Main steps:
1. Identify source, destination, project and quantity.
2. Validate availability and any reservation.
3. Record dispatch/receipt under the approved direct or in-transit process.
4. Post corresponding stock effects consistently.
5. Reconcile quantity received and any exception.

Alternate paths:
Partial transfer, in-transit tracking or approved return/correction.

Failure cases:
Insufficient available stock, unit mismatch, duplicate posting
or unexplained quantity difference.

State changes:
Stock location quantities and transfer progress change consistently.

Audit requirements:
Record both locations, material, quantities, actors and related request.

Completion criteria:
The transfer preserves total quantity across source, destination
and any explicitly tracked in-transit quantity.

## WF-028 — Stock adjustment

Requirements: INV-001

Trigger:
A count difference, damage, approved correction or other stock exception occurs.

Actor:
Authorized counter/requester and adjustment approver/poster under DEC-017.

Preconditions:
Valid stock reference, documented reason and approved adjustment policy.

Main steps:
1. Record observed discrepancy and evidence.
2. Compare against ledger/balance and relevant pending movements.
3. Obtain required approval.
4. Post a traceable adjustment.
5. Reconcile the resulting stock position.

Alternate paths:
Resolve the issue through an existing unposted receipt/transfer
instead of an adjustment, where correct.

Failure cases:
Missing reason/approval, stale count, unauthorized negative stock
or duplicate adjustment.

State changes:
Approved quantity correction is posted; historical entries remain intact.

Audit requirements:
Preserve count, reason, evidence, approver and adjustment references.

Completion criteria:
The discrepancy is explained and the balance reconciles without silently
editing or deleting posted movement history.

## WF-029 — Customer invoice

Requirements: FIN-001

Trigger:
An approved billing event or payment milestone becomes billable.

Actor:
Authorized Finance operator with issuance authority.

Preconditions:
Valid project/customer, approved billing basis, tax/rounding/numbering
and correction policies under DEC-012 and DEC-018.

Main steps:
1. Prepare invoice items and linked milestone/scope references.
2. Calculate totals using approved rules.
3. Validate customer, dates and required information.
4. Issue the invoice through the approved process.
5. Record delivery and receivable information.

Alternate paths:
Save a draft or apply an approved correction/credit process after issue.

Failure cases:
Invalid totals, missing billing authority, duplicate issue
or delivery failure.

State changes:
Draft becomes issued; payment and overdue status follow approved calculations.

Audit requirements:
Preserve issued content, issuer, number, time and correction links.

Completion criteria:
An issued invoice is traceable and its receivable is distinguishable
from quoted value, contract value and cash received.

## WF-030 — Customer payment

Requirements: FIN-001

Trigger:
The business receives evidence of a customer payment.

Actor:
Authorized Finance operator.

Preconditions:
Valid customer/project context, payment evidence and approved
receipt/allocation policy under DEC-018.

Main steps:
1. Record receipt amount, date, method and reference.
2. Validate possible duplicate recording.
3. Allocate against eligible invoices under approved rules.
4. Preserve any permitted unallocated balance.
5. Update calculated receivables and receipt history.

Alternate paths:
Partial payment, overpayment, advance or refund follows approved policy.

Failure cases:
Duplicate receipt, invalid allocation, currency mismatch
or unauthorized correction.

State changes:
Receipt/allocation records and invoice settlement calculations change.

Audit requirements:
Record operator, evidence, allocations and subsequent corrections.

Completion criteria:
Recorded cash and allocations reconcile; invoice amount is not
mistaken for received amount.
This workflow does not assume a payment-gateway integration.

## WF-031 — Supplier expense

Requirements: FIN-001, PUR-001

Trigger:
A supplier bill or other project expense needs recording.

Actor:
Authorized Finance operator; Procurement provides permitted source evidence.

Preconditions:
Valid supplier/payee, project allocation, supporting documents
and approved cost/correction policy.

Main steps:
1. Identify the bill/expense and source order/receipt where applicable.
2. Validate possible duplicates and commercial evidence.
3. Record amount, category, dates and project allocation.
4. Apply approved review/posting rules.
5. Reconcile related commitments without double counting.

Alternate paths:
Allocate a shared cost under approved rules or dispute an invalid bill.

Failure cases:
Duplicate bill, unsupported expense, wrong project
or unexplained source discrepancy.

State changes:
Recorded actual cost and outstanding supplier information change
under the approved definitions.

Audit requirements:
Preserve source evidence, author, allocations and corrections.

Completion criteria:
The expense is attributable and appears once in the correct financial totals.
Recording a bill does not prove that it has been paid.

## WF-032 — Project profitability

Requirements: FIN-001, REP-001

Trigger:
An authorized user requests a project financial summary.

Actor:
Authorized Finance or Management user.

Preconditions:
Approved metric definitions under DEC-019 and accessible project data.

Main steps:
1. Select project and reporting date/basis.
2. Retrieve authorized contract, invoice, receipt, budget and cost data.
3. Reconcile commitments and actual costs.
4. Calculate the approved margin/profitability measures.
5. Display definitions, period and relevant limitations.

Alternate paths:
Show incomplete-data warnings where approved source information is missing.

Failure cases:
Unauthorized request, inconsistent data or undefined calculation policy.

State changes:
No financial transaction is created merely by viewing the report.

Audit requirements:
Record sensitive exports where required; preserve source traceability
without unnecessarily logging report contents.

Completion criteria:
Results follow approved definitions and distinguish receivables, cash,
commitments and actual costs without double counting.

## WF-033 — Final inspection

Requirements: SITE-001, PRJ-001

Trigger:
Project/site work is submitted for final inspection.

Actor:
Authorized inspector and acceptance authority, to be confirmed.

Preconditions:
Accessible project, approved checklist and relevant completion evidence.

Main steps:
1. Review completed scope and approved execution references.
2. Perform the inspection.
3. Record results, photos and outstanding snags.
4. Assign corrections where required.
5. Record acceptance or further inspection requirements.

Alternate paths:
Conditional acceptance is permitted only if the business approves its rules.

Failure cases:
Missing evidence, unresolved blocking defects or unauthorized acceptance.

State changes:
Inspection result and snag status change.
Project closure does not occur automatically.

Audit requirements:
Record inspector, checklist, evidence, decisions and follow-up ownership.

Completion criteria:
The inspection outcome and remaining obligations are explicit and traceable.

## WF-034 — Final client/project handover

Requirements: SITE-001, PRJ-001

Trigger:
Completed work is ready for final handover.

Actor:
Authorized PM/site participants and designated client representative.

Preconditions:
Required inspection and handover conditions are satisfied
under the approved business policy.

Main steps:
1. Assemble the final handover checklist and approved documents.
2. Review completed scope and outstanding obligations.
3. Record client receipt/acceptance evidence under approved rules.
4. Transfer required manuals, warranties and relevant deliverables.
5. Record follow-up responsibilities.

Alternate paths:
Record an approved conditional handover with explicit outstanding items.

Failure cases:
Missing required documents, unresolved blocking defects
or unverifiable acceptance.

State changes:
Final handover status changes independently of financial settlement.

Audit requirements:
Preserve recipient, documents, evidence, outstanding items and time.

Completion criteria:
Final handover evidence is complete under the approved policy.
This is distinct from the internal handover in WF-014.

## WF-035 — Project closure

Requirements: PRJ-001, FIN-001

Trigger:
An authorized user requests formal project closure.

Actor:
Closure authority to be approved under DEC-020.

Preconditions:
Approved operational, document and financial closure gates are known.

Main steps:
1. Review inspection, handover and outstanding task evidence.
2. Review financial position under the approved closure policy.
3. Identify unresolved obligations.
4. Obtain required decisions.
5. Record closure and preserve historical access.

Alternate paths:
Keep operational completion and financial settlement separate where
the approved policy permits; defer closure if gates are unmet.

Failure cases:
Missing approval, unresolved blocking condition
or attempted bypass through a direct status edit.

State changes:
Project becomes closed only through the approved operation.

Audit requirements:
Record closer, decisions, gate evidence, time and any approved reopening.

Completion criteria:
The project meets approved closure rules without deleting its history.
Reopening requires a separately approved policy.

## WF-036 — AI concept generation

Requirements: AI-001

Trigger:
An authorized user requests an interior concept or photo redesign.

Actor:
Explicitly enabled Sales, PM or Designer user.

Preconditions:
Approved provider/settings, accessible linked records, processing
authorization, valid files and available budget/quota.

Main steps:
1. Build and validate the prompt/settings.
2. Confirm permitted use of reference/customer photos.
3. Validate/reserve usage capacity using the approved cost-control policy.
4. Submit durable generation work.
5. Track provider outcome and usage.
6. Store successful assets privately and link them to the correct record.
7. Require separate approval before external sharing.

Alternate paths:
Provider-supported variations/editing or a controlled retry.

Failure cases:
Quota exhaustion, unsupported file, provider error/timeout,
uncertain completion or partial result.

State changes:
Job progresses through processing to a recorded outcome.
Sharing approval remains separate.

Audit requirements:
Record requester, provider/job references, usage, cost evidence
and approved external-processing basis without logging secrets.

Completion criteria:
Result or actionable failure is recorded; usage is traceable;
no unauthorized sharing or uncontrolled duplicate generation occurs.

## WF-037 — Meta lead ingestion

Requirements: INT-001, SAL-001

Trigger:
An event arrives from an authorized Meta Lead Ads connection.

Actor:
Validated integration process using the configured authorized account.

Preconditions:
Approved account/forms, valid integration credentials, mapping
and event-verification rules under DEC-023.

Main steps:
1. Validate the incoming event using the provider's required mechanism.
2. Identify whether the event was already processed.
3. Retrieve authorized lead details when required.
4. Map and validate fields.
5. Apply the shared matching/deduplication policy.
6. Create/link the lead and preserve source attribution.
7. Record processing outcome.

Alternate paths:
Route invalid mappings or ambiguous matches to authorized review.
Retry transient provider failures under policy.

Failure cases:
Invalid verification, revoked access, unsupported form, malformed data
or provider outage.

State changes:
Integration event records its outcome; a valid lead is created/linked once.

Audit requirements:
Preserve event/source references, mapping outcome and bounded failure evidence.
Do not expose access tokens or unnecessary lead content in logs.

Completion criteria:
A validated event produces a traceable result without duplicate leads.
An unconfigured integration does not break manual lead handling.

## WF-038 — Notification failure and retry

Requirements: COM-001, INT-001

Trigger:
A notification attempt fails or its delivery outcome is uncertain.

Actor:
Authorized delivery worker or explicitly permitted support operator.

Preconditions:
Persisted event/recipient reference, configured channel,
approved retry policy and current recipient eligibility.

Main steps:
1. Record the attempt outcome with safe diagnostic information.
2. Classify permanent, transient or uncertain failure.
3. Recheck eligibility and applicable expiry.
4. Retry only when allowed, with bounded attempts and duplicate protection.
5. Record provider outcome or terminal failure.
6. Surface unresolved failures to authorized operators.

Alternate paths:
Use an approved fallback channel or manual intervention.
Do not invent a fallback that sends data to an unapproved recipient.

Failure cases:
Invalid recipient, revoked access, provider outage,
exhausted attempts or uncertain previous delivery.

State changes:
Delivery moves to retry-pending, successful or terminal failure concepts.
The originating committed business action remains intact.

Audit requirements:
Preserve event/attempt references, timestamps and safe outcome evidence;
never record OTP values, tokens or credentials.

Completion criteria:
Delivery success or a visible terminal outcome is recorded.
Retries do not duplicate the underlying business action.
Exactly-once human receipt is not assumed when a provider outcome is uncertain.

## 3. Parallel work and boundaries

The following relationships must be preserved:

- Lead qualification may precede opportunity creation.
- Requirements, visits and follow-ups may evolve together.
- Quotation sending requires the applicable PM-approved version.
- Won conversion creates the project immediately.
- Incomplete handover does not erase or prevent that created project.
- Design, procurement, site planning and finance may proceed in parallel
  where their specific prerequisites allow.
- Design release requires both approvals for the same revision.
- A material request is not a stock movement or purchase approval.
- A purchase order is not a goods receipt, bill or payment.
- A reservation is not physical movement.
- A customer invoice is not a customer receipt.
- Operational completion is not automatically financial settlement.
- Final handover is not automatically formal closure.
- Optional integration failure must remain isolated from unrelated work.

## 4. Cross-workflow controls requiring later verification

### Permissions and external isolation

Applicable requirements:
ACC-001, ACC-002, ACC-003, NFR-SEC-001, NFR-PRIV-001.

Verify:
- Action permission and record scope.
- Multi-role behavior under approved rules.
- Revoked membership and deactivated user handling.
- Client review isolation.
- Independent file access checks.
- No privileged browser credentials.

### Commercial and design history

Applicable requirements:
QUO-APP-001, DES-APP-001, CONV-001.

Verify:
- Exact version/revision decisions.
- No silent overwrite of approved content.
- No mixed-revision release.
- Accepted scope preservation.
- Controlled later changes.

### Inventory and money

Applicable requirements:
INV-001, FIN-001, NFR-REL-001.

Verify:
- Concurrent movement and allocation safety.
- Quantity and unit integrity.
- Precise monetary arithmetic.
- Approved correction processes.
- No duplicate posting or double-counted costs.

### Platform, configuration and reporting

Applicable requirements:
DASH-001, REP-001, ADM-001, PLT-001.

Verify:
- Authorized aggregates, search and exports.
- Safe spreadsheet output.
- Audited role/settings changes.
- Clear interaction states.
- Consistent formatting and accessible controls.

These controls are cross-cutting obligations.
They are not additional permission grants or approved architecture.

## 5. Decision dependencies

Architecture-critical decisions:
DEC-001 through DEC-009.

Sales and commercial decisions:
DEC-010 through DEC-014.

Design approval sequence:
DEC-015.

Purchasing and inventory:
DEC-016 and DEC-017.

Finance definitions and corrections:
DEC-018 and DEC-019.

Closure:
DEC-020.

AI:
DEC-021, together with DEC-008 and DEC-009.

Email and integration:
DEC-022 and DEC-023.

Design, files, recovery and roadmap ownership:
DEC-024 through DEC-028.

Optional external providers:
DEC-029 through DEC-031.

Where multiple decisions affect a workflow, all relevant approved policies
must be reflected before its implementation is finalized.

## 6. Sprint 01 workflow review checklist

- [ ] All 38 requested workflows are present.
- [ ] Each workflow identifies trigger and actor.
- [ ] Each workflow identifies preconditions.
- [ ] Each workflow includes main steps.
- [ ] Each workflow includes alternate paths.
- [ ] Each workflow includes failure cases.
- [ ] Each workflow identifies state changes.
- [ ] Each workflow identifies audit requirements.
- [ ] Each workflow defines completion criteria.
- [ ] Immediate and duplicate-safe Won conversion is preserved.
- [ ] PM quotation approval references the exact version.
- [ ] Client and PM design approval reference the same revision.
- [ ] Internal and final handover are distinguished.
- [ ] Procurement, physical stock and financial events are distinguished.
- [ ] Parallel work remains possible.
- [ ] Unresolved policies remain visibly open.
- [ ] Workflow requirements are mapped in the forthcoming traceability document.

## 7. Current status

This document delivers the draft requirements for all 38 requested workflows.

No workflow has been implemented, executed or tested by this document.

No business decision or proposed permission is approved merely by
saving this file.

Sprint 01 remains in progress until the acceptance criteria,
traceability and sprint report are delivered and the full baseline
is reviewed.