# Afaq Al Manzel Interiors CRM — Acceptance Criteria

Status: Draft — awaiting business review
Document version: 0.1
Phase: 0
Sprint: 01

## 1. Interpretation

These criteria define expected behavior for future implementation.

They are not test results.
No application behavior has been verified by this document.

Requirement IDs refer to PRODUCT_REQUIREMENTS.md.
AC identifiers are stable acceptance references.

Where a criterion depends on an unresolved policy, it cannot pass final
acceptance until that policy is approved and the expected result is concrete.

Proposed permissions and status names remain unapproved.

Testing categories:
- DOC: documentation/manual review.
- UNIT: calculation or domain-rule test.
- INT: application/API integration test.
- DB: database constraint, transaction or concurrency test.
- AUTH: authorization, RLS or private-file test.
- UI: browser, responsive or accessibility test.
- OPS: integration, job, deployment or recovery test.
- UAT: business user acceptance.

The categories describe intended verification, not executed checks.

## 2. Project isolation

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-ISO-001-01 | Given the new CRM configuration, when its repository, services and database connections are inspected, then they identify the new standalone application and do not connect to or modify the previous AFAQ Enterprise CRM. | DOC, OPS |
| AC-ISO-002-01 | Given development, staging and production, when their configuration is reviewed, then their resources and environment-specific credentials are separated and no unrelated application's secrets are reused. | DOC, OPS |
| AC-ISO-003-01 | Given a proposed destructive production operation, when authorization and recovery preparation are absent, then the operation is not performed. | DOC, OPS |

## 3. Identity and authorization

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-ACC-001-01 | Given an eligible employee, when multiple approved roles are assigned, then one employee identity retains those assignments without duplicate profiles. | INT, DB |
| AC-ACC-002-01 | Given a user lacking an action permission, when the user calls the protected operation directly, then the request is denied without unauthorized data changes. | AUTH, INT |
| AC-ACC-002-02 | Given a user outside a record's permitted scope, when the user requests that record through applicable server and database access paths, then protected data is not returned. | AUTH, DB |
| AC-ACC-002-03 | Given revoked membership or deactivation, when the user makes a subsequent protected request, then the approved revocation policy is enforced. | AUTH, INT |
| AC-ACC-002-04 | Given multiple roles, when a sensitive operation is requested, then the approved role-combination and separation-of-duty rules apply without bypassing business prerequisites. | AUTH, INT |
| AC-ACC-003-01 | Given an external design reviewer, when the reviewer requests employee navigation, unrelated records or internal APIs, then ordinary employee access is denied. | AUTH, UI |
| AC-ACC-003-02 | Given an expired or revoked review grant, when the reviewer requests the protected submission, then access is denied under the approved external-review policy. | AUTH, INT |

Dependencies:
DEC-003, DEC-004 and DEC-013 must resolve the relevant policy expectations.

## 4. Dashboards

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-DASH-001-01 | Given a user without finance access, when dashboard data is requested, then neither financial widgets nor their protected data are returned. | AUTH, INT |
| AC-DASH-001-02 | Given accessible source records and selected date/status filters, when a dashboard summary is calculated, then its counts reconcile with those records under documented metric definitions. | UNIT, INT |
| AC-DASH-001-03 | Given a role's approved dashboard specification, when the dashboard is opened, then its required sales, approval, project, design, site, purchasing, stock, finance or personal-work widgets appear only where authorized. | UI, UAT |

## 5. Sales and requirements

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-SAL-001-01 | Given an incoming inquiry, when an authorized user qualifies it, then its lead and any resulting opportunity have distinct identities and a traceable relationship. | INT, DB |
| AC-SAL-001-02 | Given a configured pipeline, when an authorized user changes a permitted working stage, then Kanban and table views show the same stage without bypassing Won/Lost controls. | INT, UI |
| AC-SAL-001-03 | Given accessible leads/opportunities, when search, filters, sorting, pagination, saved views or authorized export are used, then the results follow the requested valid settings and record scope. | INT, AUTH, UI |
| AC-SAL-001-04 | Given an eligible lead, when an authorized operator assigns or reassigns it, then the eligible owner changes and assignment history is retained. | INT, AUTH |
| AC-SAL-001-05 | Given imported rows containing valid, invalid and possible duplicate data, when an import runs, then the approved policy determines each outcome and row-level results/history remain available without uncontrolled duplicates. | INT, DB, UAT |
| AC-SAL-001-06 | Given a lead with a configured source, when it is created or imported, then source attribution and available inquiry/contact/property information remain traceable. | INT |
| AC-REQ-001-01 | Given incomplete opportunity requirements, when an authorized user saves them, then valid partial data is retained without falsely marking the collection complete. | INT, UI |
| AC-REQ-001-02 | Given private customer references, when an unauthorized user requests a file directly, then access is denied. | AUTH |
| AC-REQ-001-03 | Given room-wise requirements and later edits, when an authorized user reviews the record, then structured preferences, measurements, notes, deliverables and relevant change history are available for the correct opportunity. | INT, UI |
| AC-FUP-001-01 | Given a follow-up, when it is completed, rescheduled or reassigned, then its owner, schedule and outcome history remain traceable. | INT, UI |
| AC-FUP-001-02 | Given a scheduled visit, call or meeting, when its outcome is recorded, then notes, permitted attachments and next actions remain linked to the correct record. | INT, UI |

Dependencies:
DEC-010 and DEC-011 govern qualification, outcome and matching rules.

## 6. Quotations

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-QUO-001-01 | Given approved calculation rules and quotation inputs, when totals and a PDF are generated, then displayed and document amounts match the same quantity, unit, price, discount, tax and rounding rules. | UNIT, INT |
| AC-QUO-001-02 | Given an authorized quotation draft, when room-wise items, terms and payment milestones are saved, then they remain linked to its client, opportunity and identifiable version. | INT, DB |
| AC-QUO-001-03 | Given customer acceptance evidence satisfying the approved policy, when acceptance is recorded, then the exact eligible version, contact, time and evidence remain identifiable. | INT, UAT |
| AC-QUO-APP-001-01 | Given a Draft or otherwise unapproved quotation version, when customer-facing sending is attempted through the CRM, then the operation is rejected. | AUTH, INT |
| AC-QUO-APP-001-02 | Given an approved version, when commercial content changes, then a new version is created and the prior approved content remains unchanged. | INT, DB |
| AC-QUO-APP-001-03 | Given an eligible submitted version and authorized PM, when approval or rejection is recorded, then the decision references that exact version and follows the approved delegation/self-approval rules. | AUTH, INT |
| AC-QUO-APP-001-04 | Given an approved eligible version and authorized sender, when sending succeeds or fails, then recipient/version and delivery outcome are recorded without falsely treating failure as successful delivery. | INT, OPS |

Dependencies:
DEC-012, DEC-013 and DEC-014 must resolve commercial and acceptance policies.

## 7. AI Interior Studio

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-AI-001-01 | Given a request exceeding the approved quota or cost-control limit, when generation is requested, then it is rejected before an unauthorized provider submission. | UNIT, INT |
| AC-AI-001-02 | Given generated assets, when an unauthorized user requests them, then their contents are not returned. | AUTH |
| AC-AI-001-03 | Given failure, timeout, partial output or uncertain provider completion, when retry handling runs, then job/usage evidence is retained and the approved duplicate-cost protection is applied. | INT, OPS |
| AC-AI-001-04 | Given approved processing authorization and supported inputs, when text generation, reference-based generation, redesign or variations are requested, then the configured supported operation produces linked results or a recorded actionable failure. | INT, OPS, UAT |
| AC-AI-001-05 | Given a generated concept lacking required sharing approval, when external sharing is attempted through the CRM, then sharing is denied. | AUTH, INT |
| AC-AI-001-06 | Given customer photos without required external-processing authorization, when submission to the provider is attempted, then submission is blocked. | AUTH, INT |
| AC-AI-001-07 | Given completed generation work, when an authorized user opens history, then permitted prompts/settings, presets, status, linked records and usage are visible, with concepts identified as visual references. | INT, UI |

Dependencies:
DEC-008, DEC-009 and DEC-021 govern privacy, jobs, pricing and limits.
Approximately 50 images per month is not an acceptance guarantee.

## 8. Won/Lost and customers

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-CONV-001-01 | Given an eligible opportunity, when conversion requests run concurrently or are repeated, then at most one linked project is created and successful retries identify the same result. | INT, DB |
| AC-CONV-001-02 | Given failure in a required conversion step, when the operation aborts, then no partially committed required conversion remains. | DB, INT |
| AC-CONV-001-03 | Given successful Won conversion, when payment is absent or handover is incomplete, then the linked project still exists immediately. | INT, DB |
| AC-CONV-001-04 | Given valid conversion inputs, when conversion succeeds, then the client relationship, accepted quotation/scope, approved ownership handling, initial handover and audit evidence are preserved. | INT, DB, UAT |
| AC-CONV-002-01 | Given a Lost request without a valid configured reason, when submitted, then it is rejected without deleting history. | INT |
| AC-CONV-002-02 | Given a valid Lost outcome, when an authorized user opens its history, then opportunity, quotations and communication remain available. | INT, UI |
| AC-CLI-001-01 | Given an existing client with one project, when another opportunity converts, then a separate project can belong to that same client. | INT, DB |
| AC-CLI-001-02 | Given a user without finance visibility, when client payment history is requested, then it is not returned. | AUTH |
| AC-CLI-001-03 | Given an authorized client profile, when contacts, addresses, notes, documents or status are updated, then shared client information remains separate from project-specific data and linked history is preserved. | INT, UI |

Dependencies:
DEC-005, DEC-006, DEC-010 and DEC-011.

## 9. Projects and design

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-PRJ-001-01 | Given a project with relevant access and prerequisites, when design and purchasing work proceed in parallel, then the system permits them without imposing an unrelated single global sequence. | INT, UAT |
| AC-PRJ-001-02 | Given project membership without finance permission, when protected financial data is requested, then access is denied. | AUTH |
| AC-PRJ-001-03 | Given later scope changes, when the project is reviewed, then its accepted commercial reference and controlled change history remain identifiable. | INT, DB |
| AC-PRJ-001-04 | Given authorized project operations, when team, dates, milestones, tasks, dependencies, documents, comments or progress are maintained, then valid changes are retained and invalid links/dependency cycles are rejected. | INT, UI |
| AC-PRJ-001-05 | Given incomplete internal handover, when the checklist is reviewed, then missing items, owners and next actions are visible without removing the project. | INT, UI |
| AC-PRJ-001-06 | Given an unmet approved closure gate, when closure is requested, then closure is rejected; when all approved gates and authority are satisfied, then closure is recorded with evidence. | INT, AUTH, UAT |
| AC-DES-001-01 | Given an existing revision, when a later revision is created, then the earlier files and review history remain preserved. | INT, DB |
| AC-DES-001-02 | Given authorized design work, when tasks/packages are maintained, then assignment, priority, due dates, room-wise deliverables, subtasks, files and Kanban/table views reflect the same records. | INT, UI |
| AC-DES-APP-001-01 | Given client approval of revision A and PM approval of revision B, when release is attempted, then neither revision is released based on those mismatched approvals. | INT, DB |
| AC-DES-APP-001-02 | Given a client review session, when internal comments or another project's files are requested, then access is denied. | AUTH |
| AC-DES-APP-001-03 | Given valid approvals from both required parties for one eligible revision, when an authorized release is requested, then that exact revision and file set become the identifiable approved execution reference. | INT, DB |
| AC-DES-APP-001-04 | Given rejection or a content change, when rework occurs, then feedback remains traceable and approval does not silently transfer to changed content. | INT, DB |

Dependencies:
DEC-004, DEC-006, DEC-015 and DEC-020.

## 10. Site operations

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-SITE-001-01 | Given an engineer assigned only to project A, when project B's restricted reports or photos are requested, then access is denied. | AUTH |
| AC-SITE-001-02 | Given a resolved snag, when its record is reviewed, then responsible participants, resolution evidence and history remain available. | INT, UI |
| AC-SITE-001-03 | Given a material request, when it is submitted, then its project, destination, quantities and purpose remain traceable without automatically moving stock or approving spending. | INT |
| AC-SITE-001-04 | Given an authorized mobile site user, when tasks, blockers, daily reports, workforce notes, visits or photos are recorded, then valid information is retained against the correct project/date. | INT, UI |
| AC-SITE-001-05 | Given a final inspection, when results are recorded, then checklist evidence, snags, acceptance decisions and outstanding obligations remain distinguishable. | INT, UAT |
| AC-SITE-001-06 | Given a final handover, when completion is recorded, then required documents, recipient/evidence and outstanding obligations follow the approved policy without automatically asserting financial settlement. | INT, UAT |

Dependencies:
DEC-020 and approved inspection/handover authority.

## 11. Procurement and inventory

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-PUR-001-01 | Given a valid partial delivery, when receipt is posted, then accepted quantities and remaining order quantities reconcile. | INT, DB |
| AC-PUR-001-02 | Given a user without required purchase approval or issue authority, when the action is attempted, then it is denied. | AUTH, INT |
| AC-PUR-001-03 | Given repeated receipt submission, when processing occurs, then stock receipt effects are not duplicated. | INT, DB |
| AC-PUR-001-04 | Given authorized purchasing operations, when vendors, contacts, materials, categories, requests or supplier comparisons are maintained, then valid records and project allocations remain traceable. | INT, UI |
| AC-PUR-001-05 | Given approved order content, when issued or subsequently changed, then original approved commercial details and authorized amendments remain distinguishable. | INT, DB |
| AC-INV-001-01 | Given a completed transfer, when quantities are reconciled, then source, destination and any explicit in-transit quantity preserve quantity integrity. | UNIT, DB |
| AC-INV-001-02 | Given concurrent stock issues, when available stock would be exceeded, then the approved negative-stock rule cannot be bypassed. | DB, INT |
| AC-INV-001-03 | Given a reservation, when it is created or released, then availability changes correctly without inventing a physical movement. | UNIT, DB |
| AC-INV-001-04 | Given a count discrepancy, return or damage adjustment, when the approved correction is posted, then reason, authority and resulting stock reconciliation remain traceable without silent historical edits. | INT, DB |
| AC-INV-001-05 | Given stock activity, when authorized balances, low-stock alerts, counts or movement reports are requested, then results reconcile with the approved ledger/balance mechanism and units. | UNIT, INT |

Dependencies:
DEC-007, DEC-016 and DEC-017.

## 12. Finance

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-FIN-001-01 | Given invoices and customer receipts, when allocations and balances are calculated, then invoice value, received cash and allocations remain distinct and reconcile under approved policy. | UNIT, DB |
| AC-FIN-001-02 | Given an unauthorized project member, when financial records or reports are requested, then protected information is not returned. | AUTH |
| AC-FIN-001-03 | Given commitments and related actual costs, when profitability is calculated, then approved definitions are applied without double counting. | UNIT, INT |
| AC-FIN-001-04 | Given approved Finance policies, when budgets, categories, invoice items or payment milestones are maintained, then calculations, currency, numbering and required evidence follow those policies. | UNIT, INT |
| AC-FIN-001-05 | Given an issued/posted record needing correction, when an authorized correction is performed, then the approved void/credit/refund/correction mechanism preserves original evidence and balances. | INT, DB |
| AC-FIN-001-06 | Given a supplier bill or project expense, when it is recorded, then its source, category, project allocation and approved duplicate checks are retained. | INT, DB |
| AC-FIN-001-07 | Given partial or excess customer payment, when recording/allocation occurs, then the approved handling is applied without silently discarding a balance or inventing a refund. | UNIT, INT |

Dependencies:
DEC-007, DEC-012, DEC-018 and DEC-019.
These criteria do not select tax rates, accounting policies or thresholds.

## 13. Reports, administration and platform

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-REP-001-01 | Given restricted data, when a report is exported, then only permitted records and fields are included. | AUTH, INT |
| AC-REP-001-02 | Given unsafe formula-like spreadsheet input, when exported, then the approved safe representation prevents unintended formula execution. | UNIT, INT |
| AC-REP-001-03 | Given approved metric definitions, when reports are calculated, then totals reconcile with their source records and selected reporting period. | UNIT, INT |
| AC-REP-001-04 | Given the approved report catalogue, when reviewed, then required sales, quotation, follow-up, project, design, site, purchasing, inventory, finance, management and audit reports have defined access and acceptance coverage. | DOC, INT, UAT |
| AC-ADM-001-01 | Given an unauthorized actor, when roles or configuration are changed, then the operation is rejected server-side. | AUTH, INT |
| AC-ADM-001-02 | Given an authorized permission change, when saved, then it is auditable and subsequent requests follow the approved change/revocation policy. | AUTH, INT |
| AC-ADM-001-03 | Given ordinary settings responses, when inspected, then secret credential values are absent. | AUTH, INT |
| AC-ADM-001-04 | Given approved business configuration, when company, branding, currency, timezone, numbering, pipeline, task, approval, notification, AI or storage settings change, then valid changes are audited and historical record meaning is preserved. | INT, UAT |
| AC-ADM-001-05 | Given a deactivated employee, when historical records are viewed, then authorship remains intact and subsequent protected access follows the approved policy. | AUTH, INT |
| AC-PLT-001-01 | Given inaccessible records, when global search is requested, then results, suggestions and counts do not expose protected information. | AUTH, INT |
| AC-PLT-001-02 | Given a saved view or modified filter request, when applied, then record permissions cannot be expanded. | AUTH, INT |
| AC-PLT-001-03 | Given shared controls, when operated by keyboard, then navigation, activation and visible focus follow the approved accessibility standard. | UI |
| AC-PLT-001-04 | Given loading, no data, failure or denied access, when a required screen is displayed, then it presents the appropriate understandable state. | UI |
| AC-PLT-001-05 | Given permitted data, when sorting, pagination, column visibility, comments, private uploads or required print/PDF functions are used, then valid settings and authorized results are consistent. | INT, UI |

## 14. Communication and integration

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-COM-001-01 | Given a committed business event, when its later email delivery fails, then the business event remains committed. | INT, OPS |
| AC-COM-001-02 | Given failed delivery, when retry processing occurs, then attempts are bounded and observable under the approved policy without duplicating the originating business action. | INT, OPS |
| AC-COM-001-03 | Given notification recipients and current permissions, when reminders/approval/assignment/overdue alerts are delivered or opened, then protected details and linked records follow the approved access policy. | AUTH, INT |
| AC-COM-001-04 | Given authentication configuration, when login, logout, recovery or configured verification/OTP is exercised, then valid and invalid paths follow the approved session and verification policy. | AUTH, INT, UI |
| AC-COM-001-05 | Given manual WhatsApp contact actions and call logging, when used, then core functionality works without requiring an official messaging or telephony API account. | UI, UAT |
| AC-INT-001-01 | Given a repeated validated external lead event, when ingested, then it does not create duplicate leads. | INT, DB |
| AC-INT-001-02 | Given an invalid or unauthorized Meta event, when received, then protected processing is rejected and safe diagnostic evidence is retained. | AUTH, INT |
| AC-INT-001-03 | Given a transient integration failure or invalid mapping, when processed, then its retry/review outcome is visible to authorized operators without exposing credentials. | INT, OPS |
| AC-INT-001-04 | Given an unconfigured optional integration, when unrelated core CRM work is performed, then the core workflow remains usable. | INT, UAT |
| AC-INT-001-05 | Given the approved integration architecture, when provider boundaries are reviewed, then email, AI and future accounting/messaging/telephony dependencies are isolated without falsely claiming those future connectors are implemented. | DOC |

Dependencies:
DEC-009 and DEC-022 through DEC-023.
Optional provider activation follows DEC-029 through DEC-031.

## 15. Nonfunctional acceptance

| Acceptance ID | Testable criterion | Categories |
| --- | --- | --- |
| AC-NFR-SEC-001-01 | Given malformed or unauthorized critical requests, when submitted, then server validation, authorization and applicable database constraints reject them without partial unauthorized effects. | INT, AUTH, DB |
| AC-NFR-SEC-001-02 | Given browser bundles, responses and ordinary logs, when inspected, then privileged keys and secret authentication values are absent. | AUTH, OPS |
| AC-NFR-PRIV-001-01 | Given the approved privacy/retention policy, when data collection, file access, external processing and deletion procedures are reviewed, then they follow that policy and require the applicable authorization. | DOC, AUTH, OPS |
| AC-NFR-UX-001-01 | Given approved visual references and target viewports, when representative screens are reviewed, then layout, typography, readable surfaces and responsive behavior follow the design contract. | UI, UAT |
| AC-NFR-UX-001-02 | Given the approved accessibility target, when forms/navigation are checked, then labels, errors, contrast, focus, keyboard operation and reduced-motion behavior satisfy it. | UI |
| AC-NFR-REL-001-01 | Given repeated requests and relevant concurrent operations, when critical workflows run, then required integrity and duplicate-protection properties hold. | INT, DB |
| AC-NFR-REL-001-02 | Given a representative backup, when a controlled restore is performed, then required records and files are recovered and the result is checked against approved recovery targets. | OPS |
| AC-NFR-REL-001-03 | Given a deployment/migration failure scenario, when the reviewed recovery procedure is exercised in an appropriate non-production test, then recovery follows the approved plan with recorded limitations. | OPS |
| AC-NFR-PERF-001-01 | Given approved load, data volume and performance targets, when representative performance checks run, then measured results are compared with those targets and any failures are reported. | OPS |
| AC-NFR-MNT-001-01 | Given the implemented sprint, when documentation and domain/provider boundaries are reviewed, then decisions, setup, migrations, dependencies, known issues and test evidence reflect the actual implementation. | DOC |
| AC-NFR-QA-001-01 | Given an implementation sprint, when its verification report is prepared, then applicable type checks, lint, tests, production build and domain/browser checks have actual recorded outcomes, with failures and unrun checks distinguished. | DOC |
| AC-NFR-QA-001-02 | Given a required failed critical check, when sprint advancement is proposed, then the sprint remains pending until the issue is resolved and the applicable approval gate is met. | DOC |

Dependencies:
Performance numbers, recovery targets, visual tokens and detailed
accessibility targets remain subject to approval.

## 16. Sprint 01 documentation acceptance gate

These checks concern the documents, not working software.

| Gate | Required result |
| --- | --- |
| DOC-01 | All eight named Markdown files have been supplied and saved. |
| DOC-02 | All 17 business modules are represented. |
| DOC-03 | All eight employee roles and eight permission categories are documented. |
| DOC-04 | All 38 required workflows contain trigger, actor, preconditions, steps, alternatives, failures, state changes, audit requirements and completion criteria. |
| DOC-05 | Requirements and acceptance criteria use stable identifiers. |
| DOC-06 | Each baseline requirement maps to planned work and acceptance references. |
| DOC-07 | Missing roadmap ownership and cross-sprint dependencies are explicitly flagged. |
| DOC-08 | Proposed permissions and unresolved policies are not presented as approved. |
| DOC-09 | No application implementation or database migration is claimed for Sprint 01. |
| DOC-10 | The user reviews the complete baseline and explicitly approves or requests changes. |

## 17. Execution status

Application tests:
Not executed. Application implementation is outside Sprint 01.

Documentation checks:
Delivery coverage is recorded in SPRINT_01_REPORT.md.
Local save verification and business review remain user checks.

No criterion in this document is marked as passed merely because it
has been written.