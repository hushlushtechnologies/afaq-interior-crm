# Afaq Al Manzel Interiors CRM — Module Requirements

Status: Draft — awaiting business review
Document version: 0.1
Phase: 0
Sprint: 01

## Reading this document

This document expands PRODUCT_REQUIREMENTS.md.

The requirement IDs established there remain authoritative.
Acceptance references below will be expanded in ACCEPTANCE_CRITERIA.md.

Employee access described here is proposed, not approved.
Use ROLE_PERMISSION_MATRIX.md for the complete permission proposal.

Business states explicitly required by the supplied plan are baseline
requirements. Additional status labels below are proposals, not final
database values or approved transition rules.

All modules must enforce:
- Server-side and database authorization.
- Input validation.
- Appropriate project and record access boundaries.
- Private file access.
- Clear loading, empty, error and permission-denied states.
- Appropriate audit history.
- Appropriate search, filtering and pagination.
- Accessible responsive interfaces.

This document does not define database tables, migrations or application code.

## 1. Dashboard

Requirement: DASH-001

Purpose:
Give each authorized employee a useful summary of their work and the
business information they are permitted to see.

Proposed authorized users:
All eight employee roles, with different widgets and record scopes.

Screens:
Role dashboard, filtered summary, pending work and notification summaries.

Actions:
View summaries, apply date/status filters and open authorized source records.

Required data:
Pipeline statistics, lead sources, quotation status, approvals,
opportunity outcomes, active projects, design/site progress,
procurement status, inventory alerts, financial summaries,
follow-ups, overdue work, recent activity and notifications.

Business rules:
- Widget visibility and underlying queries must respect permissions.
- Financial summaries require financial access.
- A summary must not expose records hidden from its viewer.
- Metrics need documented definitions and date boundaries.

Statuses:
Display source-record statuses.
Do not create a separate conflicting dashboard status.

Validation:
Validate filters, date ranges and supported metric parameters.

Dependencies:
Authentication, permissions and each underlying business module.

Edge cases:
No assigned work, no accessible records, unavailable optional integration,
partially unavailable widgets and stale data.

Acceptance:
AC-DASH-001-01:
A user without finance access cannot retrieve financial dashboard data.
AC-DASH-001-02:
Filtered summary counts match the accessible underlying records.

## 2. Lead and Opportunity Management

Requirements: SAL-001, CONV-001, CONV-002

Purpose:
Track incoming inquiries and individual potential projects through
qualification and commercial outcome.

Proposed authorized users:
Sales, assigned Project Managers and authorized Management.
Administration access is separately controlled.

Screens:
Lead directory, opportunity directory, Sales Kanban, table view,
lead/opportunity details, assignment, import history and outcome dialogs.

Actions:
Create, view, edit, archive, assign, qualify, search, filter, sort,
save views, import, export and record outcomes as authorized.

Required data:
Lead source, contacts, inquiry details, owner, customer match,
opportunity identifier, property/location, budget/preferences,
pipeline/stage, outcome, Lost reason, notes, attachments and history.

Business rules:
- Lead, opportunity, client and project remain distinct.
- A client may have multiple opportunities.
- Configurable stages must not bypass protected Won/Lost operations.
- Won creates one project immediately after successful conversion.
- Conversion preserves accepted scope and approved commercial references.
- Repeating or concurrently submitting conversion must not duplicate a project.
- Payment is not a prerequisite for project creation.
- Lost requires a configured reason and preserves history.
- Assignment authority, client matching and reopening rules remain open.

Statuses:
Proposed stage labels: New, Assigned, Contacted, Requirements Gathering,
Site Visit, Quotation Shared and Negotiation.
Won/Lost are protected business outcomes.
Exact lifecycle and reopening transitions require DEC-010.

Validation:
Validate contact fields, owner eligibility, accessible customer links,
configured stages, outcome prerequisites and import data.
Apply approved duplicate-detection rules.

Dependencies:
Identity, permissions, client matching, requirements, quotations,
transactional project creation and audit.

Edge cases:
Repeat customer, shared phone number, ambiguous client match, deactivated
owner, duplicate submissions, concurrent edits and conversion failure.

Acceptance:
AC-SAL-001-01:
An authorized user can maintain an opportunity separately from its lead.
AC-CONV-001-01:
Concurrent successful conversion attempts produce one linked project.
AC-CONV-002-01:
A Lost request without a valid reason is rejected without deleting history.

## 3. Requirements Management

Requirement: REQ-001

Purpose:
Maintain structured, evolving information about the customer's needs.

Proposed authorized users:
Sales and assigned Project Managers; assigned Designers may view
relevant requirements.

Screens:
Requirements checklist, room/space editor, references gallery and history.

Actions:
Capture, update, review and attach authorized requirements and references.

Required data:
Project/property type, location, estimated area, rooms/spaces, style,
materials/finishes, furniture, colors, budget, timeline, references,
measurements, site notes, special instructions and deliverables.

Business rules:
- Link requirements to the correct opportunity.
- Support partial completion.
- Distinguish estimates and customer preferences from verified measurements.
- Preserve relevant change history.
- Private reference files must retain authorization controls.

Statuses:
Proposed: Not Started, In Progress and Ready for Review.
Completeness rules and required fields need business confirmation.

Validation:
Validate formats, numeric ranges, dates, units and accessible links.
Do not invent mandatory business fields.

Dependencies:
Opportunities, private storage, comments and activity history.

Edge cases:
Unknown budget, changing room count, missing measurements, contradictory
requests and removed or replaced references.

Acceptance:
AC-REQ-001-01:
An authorized user can save incomplete requirements without falsely
marking them complete.
AC-REQ-001-02:
An unauthorized user cannot retrieve reference files through a direct request.

## 4. Quotations

Requirements: QUO-001, QUO-APP-001

Purpose:
Prepare controlled commercial proposals and preserve their versions,
approvals and customer responses.

Proposed authorized users:
Sales creates quotations.
Authorized Project Managers approve versions.
Finance and Management visibility is subject to the permission proposal.

Screens:
Quotation directory, builder, room-wise items, version comparison,
approval queue, PDF preview and customer-response history.

Actions:
Create drafts, edit drafts, calculate, generate PDFs, submit for approval,
approve/reject, revise, send approved versions and record acceptance.

Required data:
Quotation number, opportunity/client, version, rooms, material/service
items, quantity, unit, unit price, discount, tax, subtotal, total,
terms, milestones, comments, documents and approval evidence.

Business rules:
- PM approval references the exact version.
- Approved content must not be silently overwritten.
- Commercial changes require a new version and applicable reapproval.
- Reject sending an unapproved version through CRM-controlled channels.
- Record recipient, version and delivery outcome for sending.
- Preserve accepted scope for project conversion.
- Apply approved calculation, tax and numbering policies.
- A document generated for internal review must not be treated as
  authorization to send it externally.
- Delegation and self-approval rules remain open.

Statuses:
Draft, approval pending, approved and rejected concepts are required.
Proposed additional labels: Sent, Accepted, Declined and Superseded.
Exact transitions require DEC-012 through DEC-014.

Validation:
Validate quantities, units, prices, discounts, tax configuration,
currency, arithmetic, recipient and version/state consistency.

Dependencies:
Opportunity, client/contact, permissions, calculation policies,
document generation, audit and delivery service.

Edge cases:
Approval races with editing, rejected versions, expired offers,
duplicate sends, failed delivery and acceptance of a superseded version.

Acceptance:
AC-QUO-001-01:
The displayed totals and generated PDF use the same approved calculations.
AC-QUO-APP-001-01:
Sending a Draft or unapproved version is rejected.
AC-QUO-APP-001-02:
An approved version remains unchanged when a new revision is created.

## 5. AI Interior Studio

Requirement: AI-001

Purpose:
Generate private visual concepts linked to CRM work.

Proposed authorized users:
Authorized Sales, Designers and Project Managers.
Usage oversight requires separate permission.

Screens:
Prompt builder, reference upload, room redesign, presets, job status,
variations gallery, history and usage summary.

Actions:
Request generation/editing, upload references, inspect results,
link assets and request external-sharing approval.

Required data:
Provider/model configuration, prompt/settings, room/style/material
preferences, authorized source files, linked records, job status,
result assets, usage, estimated/actual cost and sharing approval.

Business rules:
- Keep provider credentials server-side.
- Verify provider capabilities and pricing before selecting a model.
- Enforce permissions, budget and quotas before accepting work.
- Record usage and prevent retries from causing uncontrolled duplicate cost.
- Store outputs privately.
- Obtain required authorization before external processing of customer photos.
- Require approval before external sharing.
- Treat images as concepts, not verified construction documents.
- AED 50/month is a budget constraint, not a guaranteed image count.

Statuses:
Proposed: Queued, Processing, Succeeded, Failed and Cancelled where
supported by the provider.
Sharing approval is separate from generation status.

Validation:
Validate supported files, accessible source records, provider parameters,
quota, budget and processing authorization.

Dependencies:
Private storage, durable background jobs, provider adapter,
permissions, usage accounting and approved privacy policy.

Edge cases:
Provider timeout, duplicate submission, partial result, unknown final
provider cost, quota exhaustion and revoked file access.

Acceptance:
AC-AI-001-01:
A request exceeding approved usage limits is rejected before submission.
AC-AI-001-02:
Generated assets remain inaccessible to unauthorized users.
AC-AI-001-03:
Failure and retry handling preserve usage evidence and duplicate protection.

## 6. Won and Lost Opportunities

Requirements: CONV-001, CONV-002

Purpose:
Protect commercial outcomes and initiate confirmed project work.

Proposed authorized users:
Authorized Sales or explicitly delegated conversion operators.
Final authority requires business approval.

Screens:
Won confirmation, client matching, accepted-scope review,
PM assignment/pending-assignment display and Lost reason form.

Actions:
Validate and commit Won conversion; record Lost with reason.

Required data:
Opportunity, current outcome, matched/new client, accepted quotation/scope,
PM ownership decision, project reference, handover initiation and audit.

Business rules:
- Commit the outcome and required conversion records consistently.
- Roll back required database changes if conversion cannot complete.
- Create the project immediately on successful Won conversion.
- Do not wait for payment or completed handover.
- Repeated calls return/reference the existing result without duplicating it.
- Notification failure must not undo an already committed valid conversion.
- Retain Lost history.
- Confirm correction/reopening policy before implementing reversals.

Statuses:
Protected Won and Lost outcomes.
Pending handover is separate from outcome and project existence.

Validation:
Validate authority, current record state, accepted scope, client matching
and the approved PM ownership rule.

Dependencies:
Sales, clients, quotations, projects, transactions and reliable notifications.

Edge cases:
Concurrent requests, existing client, ambiguous match, missing PM,
notification failure and retry after a response timeout.

Acceptance:
AC-CONV-001-02:
A failed required conversion step leaves no partially committed project.
AC-CONV-001-03:
An incomplete handover does not prevent a successfully converted project
from existing.
AC-CONV-002-02:
Lost history remains retrievable by authorized users.

## 7. Client Management

Requirement: CLI-001

Purpose:
Maintain shared customer information across opportunities and projects.

Proposed authorized users:
Sales, authorized Management and assigned PMs.
Other roles receive only the minimum customer context needed for their work.

Screens:
Client directory, profile, contacts, addresses, linked records and history.

Actions:
Create, view, update, archive and link records as authorized.

Required data:
Client identity, contacts, addresses, status, communication history,
notes, documents and linked opportunities/projects/quotations.

Business rules:
- Support multiple projects per client.
- Keep shared client details separate from project-specific information.
- Financial history requires explicit finance visibility.
- Do not automatically merge uncertain matches.
- Archiving must preserve linked history.

Statuses:
Proposed: Active and Archived.
Additional client classifications require approval.

Validation:
Validate contact formats, relationship access and approved matching rules.

Dependencies:
Sales matching, projects, private documents and permissions.

Edge cases:
Repeat customer, changed contact person, shared company address,
possible duplicates and archived client with an active project.

Acceptance:
AC-CLI-001-01:
One client can have two independently managed projects.
AC-CLI-001-02:
A user without finance visibility cannot retrieve the client's payment history.

## 8. Project Management

Requirement: PRJ-001

Purpose:
Coordinate confirmed work across teams without blocking valid parallel activity.

Proposed authorized users:
Assigned PMs and team members; authorized Management has oversight.

Screens:
Project directory, overview, team, scope, documents, tasks, milestones,
calendar, timeline, activity and handover checklist.

Actions:
View/manage assigned projects, allocate team members, maintain tasks,
dependencies, dates, documents, progress and handover records.

Required data:
Project number, client, Won opportunity, accepted quotation/scope,
PM, members, dates, status, milestones, tasks, dependencies,
documents, progress and closeout evidence.

Business rules:
- Preserve the conversion relationship and accepted scope.
- Separate project existence, handover readiness and execution status.
- Support authorized parallel design, site, purchasing and finance work.
- Protect scope history and record controlled changes.
- Confirm closure and reopening gates before implementation.

Statuses:
Proposed operational labels: Planned, Active, On Hold, Completed and Closed.
Handover readiness and financial settlement are separate dimensions.

Validation:
Validate membership, dates, dependency cycles, progress inputs,
accessible records and permitted transitions.

Dependencies:
Conversion, clients, identity, private files, design, site and finance.

Edge cases:
PM departure, reassignment, overdue milestones, conflicting dependencies,
scope changes and operational completion with unpaid invoices.

Acceptance:
AC-PRJ-001-01:
An authorized project team can run design and procurement work in parallel.
AC-PRJ-001-02:
Project membership alone does not grant unrestricted financial access.
AC-PRJ-001-03:
The project retains its accepted commercial reference after later changes.

## 9. Interior Designer Workspace

Requirements: DES-001, DES-APP-001

Purpose:
Manage design work and release only correctly approved revisions.

Proposed authorized users:
Assigned Designers and PMs; external clients receive scoped review access.

Screens:
Designer dashboard, Kanban/table, tasks/subtasks, package details,
revision gallery, internal review, client review and release history.

Actions:
Assign tasks, set priorities/dates, upload deliverables, create revisions,
comment, submit, approve/reject/request changes and release as authorized.

Required data:
Project, room/package, assignments, due dates, priority, revision,
drawings/renders/reference files, comments, decisions and release record.

Business rules:
- Packages belong to projects.
- Approvals reference immutable submitted content.
- Both PM and client approval must reference the same revision.
- Rejection and revision requests retain history.
- Approved-content changes create a new revision.
- Superseded files must not be presented as the current execution release.
- Internal comments and unrelated files must remain private from clients.

Statuses:
Proposed task labels: To Do, In Progress, In Review and Done.
Revision review, approval and release statuses remain separate.
Review order and revocation rules require DEC-015.

Validation:
Validate file access, eligible reviewers, revision identity,
approval authority and release prerequisites.

Dependencies:
Projects, tasks, private storage, external review access and audit.

Edge cases:
Client approves an old link, PM approves a different revision,
concurrent revisions, revoked reviewer and rejected submission.

Acceptance:
AC-DES-001-01:
A revision retains its files and review history after a later revision exists.
AC-DES-APP-001-01:
Client approval of revision A and PM approval of revision B cannot release either.
AC-DES-APP-001-02:
A client review session cannot retrieve internal comments or another project.

## 10. Site Operations

Requirement: SITE-001

Purpose:
Capture execution progress, issues and completion evidence at project sites.

Proposed authorized users:
Assigned Site Engineers and PMs; Management oversight where authorized.

Screens:
Mobile site workspace, Kanban/table, daily reports, photos, visits,
issues, inspections, snags, material requests and handover.

Actions:
Maintain tasks, report work/workforce, upload evidence, raise blockers,
request materials, perform inspections and document resolution.

Required data:
Project/site, task, date, workforce notes, progress, photos,
inspection checklist, snag, material request and completion evidence.

Business rules:
- Restrict records and files to authorized projects.
- Preserve report and inspection history.
- Link material requests to the correct project/location.
- Distinguish reported progress from approved completion.
- Do not treat unapproved design revisions as final execution references.

Statuses:
Proposed task labels: To Do, In Progress, Blocked and Done.
Proposed issue labels: Open, In Progress and Resolved.
Inspection and closeout approval rules remain open.

Validation:
Validate dates, quantities, project links, required evidence where approved,
photo/file limits and transition authority.

Dependencies:
Projects, approved design releases, private uploads, procurement and inventory.

Edge cases:
Failed mobile upload, duplicate report submission, unresolved snag,
damaged delivery and design change during execution.

Acceptance:
AC-SITE-001-01:
An engineer assigned to project A cannot access project B's reports or photos.
AC-SITE-001-02:
A snag retains its resolution evidence and responsible user.
AC-SITE-001-03:
A material request preserves its project and delivery-location context.

## 11. Procurement

Requirement: PUR-001

Purpose:
Control supplier selection, purchasing and receipt of materials/services.

Proposed authorized users:
Procurement, project requesters, authorized approvers and Finance
according to approved spending policies.

Screens:
Vendors, catalogue, requests, supplier quotations/comparison,
approval queue, purchase orders, receipts and project allocations.

Actions:
Request, source, compare, submit, approve/reject, issue purchase orders,
record partial receipts and manage purchasing records.

Required data:
Vendor/contact, material/category/unit, project allocation,
request items, supplier offers, approval evidence, order items,
commercial terms, expected deliveries and receipt items.

Business rules:
- Do not invent monetary approval thresholds.
- Preserve approved commercial details.
- Support partial deliveries and remaining quantities.
- Link receipts to valid order items where applicable.
- Separate receipt of goods from supplier billing and payment.
- Prevent duplicate receipt processing from duplicating stock.

Statuses:
Proposed request states: Draft, Submitted, Approved and Rejected.
Proposed order states: Draft, Approved, Issued, Partially Received,
Received and Cancelled.
Actual transitions require approved authority and exception rules.

Validation:
Validate vendor/material access, units, quantities, prices,
approved request/order references and receipt limits/exceptions.

Dependencies:
Projects, materials, approval rules, inventory and financial cost definitions.

Edge cases:
Partial delivery, overdelivery, damaged goods, substitutions,
cancelled balance and receipt retry.

Acceptance:
AC-PUR-001-01:
A partial receipt preserves the outstanding order quantity.
AC-PUR-001-02:
An unauthorized user cannot approve or issue a purchase order.
AC-PUR-001-03:
A repeated receipt request cannot create duplicate stock receipts.

## 12. Inventory

Requirement: INV-001

Purpose:
Maintain trustworthy material quantities across warehouse and project sites.

Proposed authorized users:
Authorized Procurement/stock operators; assigned site users may view
relevant stock and request movements.
Actual stock posting authority requires approval.

Screens:
Materials/SKUs, locations, balances, movement history, reservations,
transfers, adjustments, counts, reconciliation and alerts.

Actions:
Receive, issue, transfer, reserve, release reservations, count,
adjust and inspect balances as authorized.

Required data:
Material, unit, source/destination, quantity, project, movement type,
source document, reason, actor, timestamp and reservation/count records.

Business rules:
- Use transactional stock movements and auditable corrections.
- Preserve transfer quantity integrity.
- Separate physical on-hand quantity from reserved/available quantity.
- Prevent unauthorized negative stock.
- Apply approved return, damage, conversion and adjustment policies.
- Posted stock history must not be silently edited or deleted.

Statuses:
Proposed transfer concepts: Draft, In Transit where needed, Received
and Cancelled before posting.
Reservation concepts: Active, Released and Fulfilled.
Exact movement lifecycle requires DEC-017.

Validation:
Validate positive movement quantities, compatible units, valid locations,
available stock and posting authority.

Dependencies:
Materials, locations, procurement receipts, site requests and transactions.

Edge cases:
Concurrent issues, partial transfer receipt, unit mismatch, counted
difference, damaged stock and retry after posting.

Acceptance:
AC-INV-001-01:
A completed transfer decreases the source and increases the destination
by the corresponding quantity without losing stock.
AC-INV-001-02:
Concurrent issues cannot bypass the approved negative-stock rule.
AC-INV-001-03:
A reservation changes availability without pretending that stock moved.

## 13. Finance

Requirement: FIN-001

Purpose:
Track project finances without building a full general ledger.

Proposed authorized users:
Finance and explicitly authorized Management.
Other roles receive only separately approved financial information.

Screens:
Budgets, invoices, milestones, receipts, allocations, supplier bills,
expenses, commitments, receivables and profitability.

Actions:
Maintain budgets/drafts, issue invoices, record payments, allocate receipts,
record supplier bills/expenses and inspect financial reports as authorized.

Required data:
Project, monetary currency/precision, budget categories, invoice/items,
payment terms, receipt/reference, allocation, bill/expense evidence,
commitment references and financial reporting definitions.

Business rules:
- Use approved tax, rounding, numbering and correction policies.
- Distinguish quote, contract, invoice, receipt, commitment and actual cost.
- Prevent double counting when commitments become actual costs.
- Preserve issued and posted records through controlled corrections.
- Apply explicit finance permissions to every query and export.
- Do not infer payment-provider integration from manual receipt recording.

Statuses:
Proposed invoice concepts: Draft, Issued, Partially Paid and Paid.
Overdue may be derived from due dates and remaining balances.
Void, credit, refund and settlement behavior requires approved policy.

Validation:
Validate amounts, precision, currency, project links, allocation totals,
duplicate references and supported correction operations.

Dependencies:
Projects, quotations, procurement, Finance policies and permissions.

Edge cases:
Partial payment, overpayment, refund, cancelled purchase, duplicate bill,
rounding differences and late supplier invoices.

Acceptance:
AC-FIN-001-01:
A receipt and its allocations remain distinguishable from invoice value.
AC-FIN-001-02:
Unauthorized project members cannot retrieve financial records.
AC-FIN-001-03:
Profitability follows the approved definitions without double-counting costs.

## 14. Reports and Analytics

Requirement: REP-001

Purpose:
Provide consistent operational and management evidence.

Proposed authorized users:
Each role for explicitly authorized domains and record scopes.

Screens:
Report directory, filters, report results, charts and export controls.

Actions:
Filter, inspect, drill into permitted records, export and print where required.

Required data:
Sales/source/employee/conversion, quotations, follow-ups, project status,
design performance/approvals, site progress, purchasing, inventory,
budgets, invoices/receipts, receivables, profitability and audit activity.

Business rules:
- Define metric meaning and date treatment.
- Scope queries, aggregates and exports to permissions.
- Restrict finance and audit reports independently.
- Protect spreadsheet exports against formula injection.
- Never rely on hiding an export button as enforcement.

Statuses:
Use source statuses; label report date/time and filters.

Validation:
Validate filter combinations, dates, export permission and supported formats.

Dependencies:
Domain data, agreed calculations, audit and authorization.

Edge cases:
No data, large export, changing records during export,
timezone boundaries and restricted drill-down.

Acceptance:
AC-REP-001-01:
An export contains only records the requester may access.
AC-REP-001-02:
A spreadsheet cell containing unsafe formula-like input is safely represented.
AC-REP-001-03:
Report totals reconcile with the approved source definitions.

## 15. Administration and Settings

Requirement: ADM-001

Purpose:
Manage approved configuration without bypassing business controls.

Proposed authorized users:
Super Admin for technical administration.
Business configuration may be delegated through explicit permissions.

Screens:
Employees, roles/permissions, company/branding, currency/timezone,
numbering, pipelines, statuses, approvals, notifications, AI,
integrations, storage, audit and shared/personal views.

Actions:
Invite/deactivate users, manage role assignments, configure approved
settings and inspect authorized audit records.

Required data:
User/profile, role assignments, configuration values, numbering rules,
provider configuration references and change evidence.

Business rules:
- Administrative access does not automatically confer business approval authority.
- Keep privileged credentials out of browser responses and ordinary settings displays.
- Audit permission and sensitive configuration changes.
- Preserve historical meaning when stages/settings change.
- Confirm final-admin protection and access-recovery rules before implementation.
- AED and Asia/Dubai remain configurable proposed defaults.

Statuses:
User lifecycle and invitation states will follow approved authentication design.
Configuration changes may require separate review depending on risk.

Validation:
Validate settings, eligible role assignments, numbering conflicts,
allowed configuration values and authority.

Dependencies:
Identity, authorization, audit, approved business policies and integrations.

Edge cases:
Deactivating an assigned PM, changing a stage used by active records,
revoked permissions during a session and invalid provider configuration.

Acceptance:
AC-ADM-001-01:
Unauthorized role/configuration changes are rejected server-side.
AC-ADM-001-02:
An approved permission change is auditable and affects subsequent access checks.
AC-ADM-001-03:
Secret credentials are not exposed through ordinary settings responses.

## 16. Notifications and Communication

Requirements: COM-001, FUP-001, INT-001

Purpose:
Deliver actionable reminders and messages without losing business events.

Proposed authorized users:
Employees receive their authorized notifications.
Delivery configuration is separately controlled.

Screens:
Notification center, follow-up/calendar views, preferences and
authorized delivery/failure history.

Actions:
Read/mark notifications, log calls, schedule follow-ups, use manual
WhatsApp contact actions and retry eligible failed deliveries.

Required data:
Recipient, authorized record reference, event, channel, schedule,
delivery attempt, provider reference, status and failure information.

Business rules:
- Provide in-app and configured email notifications.
- Support configured verification/OTP through the authentication workflow.
- Do not leak private data in notifications or insecure links.
- Recheck access when opening linked records.
- Do not require official WhatsApp API or telephony setup for manual actions.
- Use bounded, observable retries and duplicate protection.
- Commit business operations independently of later notification delivery.

Statuses:
Proposed: Pending, Sent/Delivered where observable, Failed and Read
for applicable channels.
Email provider acceptance is not proof that a person read the message.

Validation:
Validate recipient access, channel configuration, schedule/timezone,
template parameters and retry eligibility.

Dependencies:
Authentication delivery, event/job processing, email provider and permissions.

Edge cases:
Expired recipient access, bounce, provider timeout, duplicate event,
invalid address and overdue reminder.

Acceptance:
AC-COM-001-01:
An email failure does not erase a successfully committed business event.
AC-COM-001-02:
Failed delivery is visible to authorized operators and retried under policy.
AC-FUP-001-01:
A follow-up retains its owner, schedule and completion history.
AC-INT-001-01:
Repeated external lead events do not create duplicate leads.

Meta integration:
Authorized webhooks must be verified, mapped, validated and deduplicated.
Retain failure/retry evidence.
Detailed integration implementation belongs to its approved sprint.

## 17. Global Platform Features

Requirement: PLT-001

Purpose:
Provide consistent shared behavior across CRM modules.

Proposed authorized users:
All authenticated employees within their explicit permissions.
External clients receive only the isolated review capabilities.

Screens:
Global search, shared forms, file viewers, activity/comments,
saved views, filters, tables, dialogs and common state displays.

Actions:
Search, paginate, sort, filter, manage personal views/columns,
upload/download authorized files, comment, export and print where authorized.

Required data:
Accessible record references, search fields, saved-view ownership,
column/filter settings, attachments, comments and audit/activity events.

Business rules:
- Apply authorization before returning search results or counts.
- Separate user activity displays from protected audit evidence.
- Personal saved views cannot expand data access.
- Private file access must be checked independently of visible UI links.
- Use consistent dates, currency and number formatting.
- Include loading, empty, error, success and denied states.
- Respect keyboard accessibility and reduced-motion preferences.
- Confirm custom-field scope and implementation ownership.

Statuses:
Use component interaction states and source-record statuses.
Do not invent shared statuses that override domain rules.

Validation:
Validate filters, sort fields, pagination, file limits, comment inputs,
view ownership and export requests.

Dependencies:
Shared UI foundations, authentication, permissions, storage and domain modules.

Edge cases:
Saved filter references a removed stage, access revoked after a search,
expired file access, empty result and unsupported upload.

Acceptance:
AC-PLT-001-01:
Search cannot reveal the name, count or contents of inaccessible records.
AC-PLT-001-02:
Changing a saved view cannot bypass record permissions.
AC-PLT-001-03:
Shared controls support keyboard use and visible focus.
AC-PLT-001-04:
Required screens provide understandable loading, empty and error states.

## 18. Cross-module acceptance obligations

The following apply in addition to the module-specific checks:

- Invalid input must not partially commit critical operations.
- Duplicate requests must not duplicate protected business effects.
- Direct server/database/file requests must respect authorization.
- Revoked access must not remain effective merely because a screen is open.
- Audit evidence must identify the actor, operation, target and time.
- Sensitive data and secrets must not appear in ordinary errors or logs.
- Critical status changes must validate current state and authority.
- Automated tests must cover relevant failures and concurrency.
- UI implementation requires browser, responsive and accessibility checks.

Detailed architecture, exact policies and test implementation are later work.

## 19. Current delivery status

All 17 business modules from Section 4 of the supplied plan are represented.

Activities/follow-ups, conversion, approvals and integrations are also
documented explicitly in their related modules.

No proposed status, permission or unresolved policy is approved merely
because it appears in this document.

No application tests have been executed for this documentation deliverable.