# Afaq Al Manzel Interiors CRM — Requirements Traceability

Status: Draft — awaiting business review
Document version: 0.1
Phase: 0
Sprint: 01

## 1. Interpretation

This document maps the baseline requirement identifiers from
PRODUCT_REQUIREMENTS.md.

Acceptance references are defined in ACCEPTANCE_CRITERIA.md.
Workflow references are defined in BUSINESS_WORKFLOWS.md.

Sprint mappings identify planned responsibility, not completed work.

Unless explicitly stated otherwise:
- Requirement approval: Pending Sprint 01 review.
- Detailed business policy: Open where referenced in OPEN_DECISIONS.md.
- Implementation: Not started.
- Software verification: Not executed.

A range such as 01–04 in an acceptance cell means all existing acceptance
IDs under the stated prefix from suffix 01 through suffix 04 inclusive.

Test categories:
DOC = documentation review
UNIT = unit/domain calculation
INT = integration/API
DB = database/transaction/concurrency
AUTH = authorization/RLS/files
UI = browser/responsive/accessibility
OPS = jobs/integration/deployment/recovery
UAT = business acceptance

"Proposed owner" means an allocation requiring roadmap approval.
It is not permission to expand the current sprint.

## 2. Isolation and access requirements

| Requirement | Coverage | Workflow | Planned sprint responsibility | Acceptance reference | Test category | Approval status |
| --- | --- | --- | --- | --- | --- | --- |
| ISO-001 | New standalone application; no old CRM connection/change | All workflows | 02 architecture; 03 setup; 48 deployment | AC-ISO-001-01 | DOC, OPS | Pending |
| ISO-002 | Separate development/staging/production; isolated secrets | Cross-cutting | 02 design; 03 setup; 47–48 verification | AC-ISO-002-01 | DOC, OPS | Pending |
| ISO-003 | Production deletion authorization and recovery preparation | Corrections/operations | 04 standards; 45 controls; 47–48 recovery/deployment | AC-ISO-003-01 | DOC, OPS | Pending |
| ACC-001 | Multiple authorized roles per employee | Cross-cutting | 02 design; 10 implementation; 11 administration | AC-ACC-001-01 | INT, DB | Pending; DEC-003 |
| ACC-002 | Action permissions, record scope and revocation | All employee workflows | 02 design; 09–12 foundation; every affected feature; 45 review | AC-ACC-002-01–04 | AUTH, INT, DB | Pending; DEC-003, DEC-013 |
| ACC-003 | Scoped external client access without employee privileges | WF-018–020 | 02 design; 12 storage/access foundation; 29 implementation; 45 review | AC-ACC-003-01–02; AC-DES-APP-001-02 | AUTH, INT, UI | Pending; DEC-004 |

## 3. Business requirement mappings

| Requirement | Required feature coverage | Workflow | Planned sprint responsibility | Acceptance reference | Test category | Approval status |
| --- | --- | --- | --- | --- | --- | --- |
| DASH-001 | Role dashboards; pipeline, sources, quotes, approvals, projects, design, site, stock, procurement, finance, personal work; filters | Relevant source workflows | 07 prototypes; domain sprints supply data; 41 management reporting; earlier functional widget ownership needs GAP-003 | AC-DASH-001-01–03 | UNIT, INT, AUTH, UI, UAT | Pending |
| SAL-001 | Lead/source/contact/property records; qualification; assignment; customer matching; distinct opportunities | WF-001–003, WF-013 | 13 | AC-SAL-001-01, 04, 06 | INT, DB, AUTH | Pending; DEC-010–011 |
| SAL-001 | Kanban/table, configurable stages, search, filters, sorting, pagination and saved views | WF-002–003, WF-012 | 14; protected outcomes in 22 | AC-SAL-001-02–03 | INT, AUTH, UI | Pending |
| SAL-001 | Excel/CSV import, mapping, validation, duplicate handling, import/row history and errors | WF-001, WF-013, WF-037 | 17 | AC-SAL-001-05–06 | INT, DB, UAT | Pending; DEC-011, DEC-028 |
| REQ-001 | Structured and room-wise requirements, partial completion, references, measurements, deliverables and history | WF-004–005 | 15 | AC-REQ-001-01–03 | INT, AUTH, UI | Pending |
| FUP-001 | Calls, meetings, visits, notes, attachments, follow-ups, reminders, schedule/calendar and history | WF-005–006 | 16; delivery dependencies in GAP-002 | AC-FUP-001-01–02 | INT, UI | Pending; DEC-022 |
| QUO-001 | Numbering, room items, quantities, units, pricing, discounts, taxes, totals, terms, milestones and PDF | WF-007 | 18 | AC-QUO-001-01–02 | UNIT, INT, DB | Pending; DEC-012 |
| QUO-001 | Versions, comments, customer status and acceptance evidence | WF-009–010 | 19 | AC-QUO-001-03; AC-QUO-APP-001-02–04 | INT, DB, UAT | Pending; DEC-013–014 |
| QUO-APP-001 | Exact-version PM approval/rejection, revision controls, sending gate and audit | WF-008–010 | 19 | AC-QUO-APP-001-01–04 | AUTH, INT, DB, OPS | Pending; DEC-013 |
| AI-001 | Provider adapter, text generation, reference images, photo redesign, presets and prompt settings | WF-036 | 20 backend; 21 UI | AC-AI-001-04, 06–07 | INT, AUTH, OPS, UI | Pending; DEC-008–009, DEC-021 |
| AI-001 | Variations, linked assets, gallery/history, private storage, jobs, errors/retries and permissions | WF-036 | 20–21 | AC-AI-001-02–04, 07 | INT, AUTH, OPS, UI | Pending |
| AI-001 | Usage, monthly quota, AED 50 budget controls and external-sharing approval | WF-036 | 20 initial enforcement; 21 UI; 45 review; sharing authority in GAP-005 | AC-AI-001-01, 03, 05–06 | UNIT, INT, AUTH, OPS | Pending; DEC-021 |
| CONV-001 | Validated/idempotent/transactional Won conversion, client matching, immediate project, accepted scope, ownership, initial handover and notification | WF-011, WF-013–014 | 22; detailed handover in 26 | AC-CONV-001-01–04 | INT, DB, UAT | Pending; DEC-005–006 |
| CONV-002 | Protected Lost outcome, configured reason and preserved history | WF-012 | 22 | AC-CONV-002-01–02 | INT, UI | Pending; DEC-010 |
| CLI-001 | Directory/profile, contacts, addresses, notes, files, communications, linked records, status and repeat customers | WF-013 | Minimal matching for 13/22; complete workspace in 23 | AC-CLI-001-01–03 | INT, DB, AUTH, UI | Pending; GAP-001 |
| PRJ-001 | Project number/relationships, PM/team, scope, status, dates, documents, comments/activity and permissions | WF-011, WF-014 | Minimal project in 22; workspace in 24 | AC-PRJ-001-01–03; AC-CONV-001-04 | INT, DB, AUTH, UAT | Pending |
| PRJ-001 | Milestones, tasks, dependencies, calendar/timeline, progress and parallel workflows | WF-015, WF-021 | 25; design task extensions in 27 | AC-PRJ-001-01, 04 | INT, UI, UAT | Pending |
| PRJ-001 | Internal handover checklist, scope snapshots, ownership and missing-item tracking | WF-014 | Initiation in 22; full workflow in 26 | AC-PRJ-001-05; AC-CONV-001-03–04 | INT, UI | Pending |
| PRJ-001 | Final handover, closure and controlled reopening policy | WF-034–035 | 34 operational workflow; finance reconciliation in 39–40 requires GAP-004 | AC-PRJ-001-06; AC-SITE-001-06 | INT, AUTH, UAT | Pending; DEC-020 |
| DES-001 | Designer dashboard, Kanban/table, priorities, due dates, assignments, stages and subtasks | WF-015 | 27 | AC-DES-001-02 | INT, UI | Pending |
| DES-001 | Room packages, drawings/renders, references, AI concepts, files, comments, revisions and deliverables | WF-016, WF-019 | 28 | AC-DES-001-01–02; AC-DES-APP-001-04 | INT, DB, UI | Pending |
| DES-APP-001 | PM/client review, secure client access, exact-revision dual approval, rejection and change requests | WF-017–019 | 29 | AC-DES-APP-001-01–02, 04; AC-ACC-003-01–02 | AUTH, INT, DB | Pending; DEC-004, DEC-015 |
| DES-APP-001 | Approved execution release, site handoff, supersession and change tracking | WF-020 | 30 | AC-DES-APP-001-03–04 | INT, DB, UAT | Pending |
| SITE-001 | Mobile tasks, assignment, priorities, progress and blockers | WF-021 | 31 | AC-SITE-001-01, 04 | AUTH, INT, UI | Pending |
| SITE-001 | Daily reports, workforce notes, visits, photos and history | WF-022 | 32 | AC-SITE-001-01, 04 | AUTH, INT, UI | Pending |
| SITE-001 | Inspections, snags, issues, documents and completion evidence | WF-021, WF-033 | 33; final inspection in 34 | AC-SITE-001-02, 05 | INT, UI, UAT | Pending |
| SITE-001 | Material requests and purchasing/stock links | WF-023 | Proposed request capture in 31–32; fulfillment in 35–38; GAP-006 | AC-SITE-001-03 | INT | Pending ownership |
| SITE-001 | Final inspection, final handover and completion | WF-033–034 | 34 | AC-SITE-001-05–06 | INT, UAT | Pending; DEC-020 |
| PUR-001 | Vendor/contact, materials/categories, requests and approval routing | WF-023–024 | 35 | AC-PUR-001-02, 04 | AUTH, INT, UI | Pending; DEC-016 |
| PUR-001 | Supplier quotations/comparison, purchase orders, commercial approval, issue and allocation | WF-025 | 36 | AC-PUR-001-02, 04–05 | AUTH, INT, DB | Pending |
| PUR-001 | Partial deliveries, goods receipts, documents and purchasing history | WF-026 | 36; stock effects in 37; GAP-007 | AC-PUR-001-01, 03 | INT, DB | Pending |
| INV-001 | Warehouse/site locations, SKUs/units, receipts/issues, reservations, ledger and project allocation | WF-023, WF-026–027 | 37 | AC-INV-001-01–03, 05 | UNIT, INT, DB | Pending; DEC-007, DEC-017 |
| INV-001 | Transfers, returns/damage, adjustments, counts, reconciliation, alerts and reports | WF-027–028 | 38 | AC-INV-001-01–05 | UNIT, INT, DB | Pending; DEC-017 |
| FIN-001 | Budgets/categories, invoices/items, milestones and receivables | WF-029 | 39 | AC-FIN-001-01, 04 | UNIT, INT, DB | Pending; DEC-012, DEC-018 |
| FIN-001 | Customer receipts, allocations, partial/excess payments and correction processes | WF-030 | 40 | AC-FIN-001-01, 05, 07 | UNIT, INT, DB | Pending; DEC-018 |
| FIN-001 | Supplier bills, expenses, commitments, actual costs and project allocations | WF-031 | 40; purchasing source links in 36 | AC-FIN-001-03, 05–06 | UNIT, INT, DB | Pending; DEC-019 |
| FIN-001 | Contract/quote/invoice/cash distinctions, balances, profitability and permission-controlled summaries | WF-032 | 40 calculations; 41 reporting | AC-FIN-001-01–04; AC-FIN-001-02 | UNIT, INT, AUTH | Pending; DEC-019 |
| REP-001 | All specified sales, quotation, follow-up, project, design, site, purchasing, stock, finance, management and audit reports | WF-032 and source workflows | 41; domain-specific report foundations in their modules | AC-REP-001-01–04 | DOC, UNIT, INT, AUTH, UAT | Pending |
| ADM-001 | Employees, invitations, profiles, roles, permissions and deactivation | Cross-cutting | 10–11; audit foundation in 12 | AC-ADM-001-01–03, 05 | AUTH, INT | Pending |
| ADM-001 | Company/branding, currency/timezone, numbering, stages/statuses and approval settings | Cross-cutting | Proposed distributed ownership; GAP-008 | AC-ADM-001-01–04 | AUTH, INT, UAT | Pending ownership |
| ADM-001 | Notification/AI/integration/storage settings and audit oversight | WF-036–038 and cross-cutting | 12, 20–21, 42–45; some UI ownership unresolved in GAP-008 | AC-ADM-001-01–04 | AUTH, INT, UAT | Pending |
| COM-001 | Login/recovery/verification email and configured OTP | Authentication operations | 09; email dependency in GAP-002; expansion in 43 | AC-COM-001-04 | AUTH, INT, UI | Pending; DEC-022 |
| COM-001 | In-app/email reminders, approvals, assignments, overdue and failure alerts | WF-006, WF-008, WF-011, WF-017–020, WF-024, WF-038 | Required initial delivery in dependent modules; 43–44 expansion; GAP-002 | AC-COM-001-01–03 | AUTH, INT, OPS | Pending |
| COM-001 | Manual WhatsApp actions and call logging; future optional providers | WF-006 | Manual call logging in 16; WhatsApp actions in 43 | AC-COM-001-05; AC-INT-001-05 | UI, UAT, DOC | Pending |
| INT-001 | Meta verification, retrieval, mapping, deduplication, retries and logs | WF-037 | 42 | AC-INT-001-01–03 | AUTH, INT, DB, OPS | Pending; DEC-023 |
| INT-001 | Provider adapters, optional integration isolation and future accounting architecture | WF-036–038 | 20 AI; 42 Meta; 43 email; 44 automation/accounting boundaries | AC-INT-001-04–05 | DOC, INT, UAT | Pending |
| PLT-001 | Reusable controls, forms, dialogs, table/Kanban, states, keyboard and reduced motion | Cross-cutting | 05–08 foundations; each UI implementation sprint | AC-PLT-001-03–05; AC-NFR-UX-001-01–02 | UI, INT | Pending |
| PLT-001 | Functional global search with authorized results/counts | Cross-cutting | 06 layout only; proposed functional owner unresolved in GAP-009 | AC-PLT-001-01 | AUTH, INT | Pending ownership |
| PLT-001 | Validation, private uploads, comments, activity, audits and notifications | Relevant workflows | 08 UI; 12 access/audit foundations; domain sprints; 43–44 delivery | AC-PLT-001-04–05; AC-NFR-SEC-001-01 | INT, AUTH, UI | Pending |
| PLT-001 | Pagination, sorting, filters, saved views, column visibility, CSV and required print/PDF | Relevant workspaces | 08 reusable UI; 14 sales; domain sprints; 18 quotation PDF; 39 invoice documents; 41 reporting | AC-PLT-001-02, 05; AC-REP-001-01–02 | INT, AUTH, UI | Pending |
| PLT-001 | Consistent formatting, accessible responsive layouts and clear interaction states | All UI workflows | 05–08 foundations; every UI sprint; 47 final review | AC-PLT-001-03–04; AC-NFR-UX-001-01–02 | UI, UAT | Pending |
| PLT-001 | Configurable custom-field scope mentioned in platform inventory | Unresolved | No explicit implementation owner; GAP-010 | AC-ADM-001-04 is insufficient until scope is defined | DOC; later tests TBD | Pending scope/ownership |

## 4. Nonfunctional requirement mappings

| Requirement | Coverage | Workflow | Planned sprint responsibility | Acceptance reference | Test category | Approval status |
| --- | --- | --- | --- | --- | --- | --- |
| NFR-SEC-001 | Validation, server/database authorization, RLS, secrets, private files, transactions and audit | All relevant workflows | 02 design; 09–12 foundations; each feature; 45 final review | AC-NFR-SEC-001-01–02; applicable ACC criteria | AUTH, INT, DB, OPS | Pending |
| NFR-PRIV-001 | Customer/file privacy, external processing authorization, retention and controlled deletion | WF-018, WF-036 and data operations | 02 policy design; 12 files; 20 processing; 29 review; 45/47 review | AC-NFR-PRIV-001-01; AC-AI-001-06; AC-ACC-003-01–02 | DOC, AUTH, OPS | Pending; DEC-008 |
| NFR-UX-001 | Beige design, readable surfaces, responsive layouts, keyboard/focus/contrast and reduced motion | All UI workflows | 04 contract; 05–08 foundation; every UI sprint; 47 review | AC-NFR-UX-001-01–02 | UI, UAT | Pending; DEC-024 |
| NFR-REL-001 | Integrity, retries, duplicate protection, immutable history, backup/restore and rollback | Critical workflows | 02 design; each affected feature; 44 jobs; 46 concurrency; 47–48 recovery | AC-NFR-REL-001-01–03 | INT, DB, OPS | Pending; DEC-009, DEC-026 |
| NFR-PERF-001 | Approved capacity, response and availability targets | Representative workflows | 02 target planning; 45 performance; 47–48 operational validation | AC-NFR-PERF-001-01 | OPS | Pending targets; DEC-002, DEC-026 |
| NFR-MNT-001 | Modular boundaries, provider adapters, reusable components and current documentation | Cross-cutting | 02 architecture; 04 standards; every sprint | AC-NFR-MNT-001-01 | DOC | Pending |
| NFR-QA-001 | Appropriate checks, truthful evidence, failure handling and approval gates | Every sprint | 03 test foundation; 04 strategy; each implementation sprint; 46–48 final validation | AC-NFR-QA-001-01–02; DOC-01 through DOC-10 | DOC and applicable suites | Pending |

## 5. Complete workflow cross-reference

The sprint references below describe planned work, not completion.

| Workflow | Primary requirement | Planned sprint(s) | Primary acceptance references |
| --- | --- | --- | --- |
| WF-001 Lead creation | SAL-001 | 13; imports in 17 | AC-SAL-001-01, 05–06 |
| WF-002 Lead assignment | SAL-001, ACC-002 | 13 | AC-SAL-001-04; AC-ACC-002-01 |
| WF-003 Qualification | SAL-001 | 13 | AC-SAL-001-01 |
| WF-004 Requirements | REQ-001 | 15 | AC-REQ-001-01–03 |
| WF-005 Site visit | FUP-001, REQ-001 | 16 | AC-FUP-001-02; AC-REQ-001-03 |
| WF-006 Follow-up | FUP-001, COM-001 | 16; delivery dependency | AC-FUP-001-01–02; AC-COM-001-02–03 |
| WF-007 Quotation preparation | QUO-001 | 18 | AC-QUO-001-01–02 |
| WF-008 PM quotation approval | QUO-APP-001 | 19 | AC-QUO-APP-001-01, 03 |
| WF-009 Quotation rejection/revision | QUO-APP-001 | 19 | AC-QUO-APP-001-02–03 |
| WF-010 Customer acceptance | QUO-001 | 19 | AC-QUO-001-03 |
| WF-011 Won conversion | CONV-001 | 22 | AC-CONV-001-01–04 |
| WF-012 Lost opportunity | CONV-002 | 22 | AC-CONV-002-01–02 |
| WF-013 Repeat customer | CLI-001 | 13/22 foundations; 23 workspace | AC-CLI-001-01, 03 |
| WF-014 Internal handover | PRJ-001 | 22 initiation; 26 full workflow | AC-PRJ-001-05; AC-CONV-001-03–04 |
| WF-015 Design assignment | DES-001 | 25 task foundation; 27 workspace | AC-DES-001-02 |
| WF-016 Design revision | DES-001 | 28 | AC-DES-001-01–02 |
| WF-017 PM design approval | DES-APP-001 | 29 | AC-DES-APP-001-01, 03–04 |
| WF-018 Client design approval | DES-APP-001, ACC-003 | 29 | AC-DES-APP-001-01–02; AC-ACC-003-01–02 |
| WF-019 Design rejection | DES-APP-001 | 29 | AC-DES-APP-001-04 |
| WF-020 Approved release | DES-APP-001 | 30 | AC-DES-APP-001-01, 03 |
| WF-021 Site execution | SITE-001 | 31 | AC-SITE-001-01, 04 |
| WF-022 Daily reports | SITE-001 | 32 | AC-SITE-001-04 |
| WF-023 Material request | SITE-001, PUR-001 | Request owner unresolved; 35–38 fulfillment | AC-SITE-001-03; GAP-006 |
| WF-024 Purchase approval | PUR-001 | 35 | AC-PUR-001-02, 04 |
| WF-025 Purchase order | PUR-001 | 36 | AC-PUR-001-02, 04–05 |
| WF-026 Goods receipt | PUR-001, INV-001 | 36 receiving; 37 stock integration | AC-PUR-001-01, 03; GAP-007 |
| WF-027 Stock transfer | INV-001 | 38 | AC-INV-001-01–03 |
| WF-028 Stock adjustment | INV-001 | 38 | AC-INV-001-04–05 |
| WF-029 Customer invoice | FIN-001 | 39 | AC-FIN-001-04–05 |
| WF-030 Customer payment | FIN-001 | 40 | AC-FIN-001-01, 05, 07 |
| WF-031 Supplier expense | FIN-001 | 40 | AC-FIN-001-03, 05–06 |
| WF-032 Profitability | FIN-001, REP-001 | 40 calculation; 41 reports | AC-FIN-001-03; AC-REP-001-03 |
| WF-033 Final inspection | SITE-001 | 34 | AC-SITE-001-05 |
| WF-034 Final handover | SITE-001, PRJ-001 | 34; later finance links | AC-SITE-001-06 |
| WF-035 Project closure | PRJ-001, FIN-001 | 34 operational; 39–40 finance; GAP-004 | AC-PRJ-001-06 |
| WF-036 AI generation | AI-001 | 20–21 | AC-AI-001-01–07 |
| WF-037 Meta ingestion | INT-001 | 42 | AC-INT-001-01–03 |
| WF-038 Notification retry | COM-001 | Initial dependent workflows; 43–44 expansion | AC-COM-001-01–03 |

## 6. Roadmap gaps and sequencing issues

### GAP-001 — Early client and project foundations

Issue:
Sales matching and Won conversion occur before the full client/project workspaces.

Required resolution:
Sprint 02 must design the shared entities.
Sprint 13/22 must implement the minimum required customer/project operations
without claiming the full Sprint 23/24 workspaces are complete.

Status:
Dependency identified; detailed implementation boundaries pending approval.

### GAP-002 — Email, notifications and background jobs are needed earlier

Issue:
Authentication in 09, reminders in 16, AI in 20 and conversion in 22
need capabilities whose dedicated expansion appears in 43–44.

Required resolution:
Assign minimum dependable delivery/job foundations to the first consuming
sprints, with explicit scope. Keep 43–44 for later expansion/consolidation.

Do not defer authentication delivery, AI job durability or required cost
controls until late integration sprints.

Status:
Architecture and sprint allocation pending DEC-009 and DEC-022.

### GAP-003 — Functional dashboard delivery

Issue:
Sprint 07 supplies prototypes; Sprint 41 supplies broad reporting.
Earlier domain-specific dashboard behavior needs explicit ownership.

Proposed resolution:
Deliver authorized functional widgets with their relevant domain modules
and consolidate management reporting in 41.

Status:
Proposed allocation; not approved.

### GAP-004 — Closure precedes the finance module

Issue:
Sprint 34 covers site closeout before Finance in 39–40.

Required resolution:
Approve operational versus financial closure policy under DEC-020.
Do not represent unimplemented financial gates as verified in 34.
Integrate/test financial closure conditions once Finance exists.

Status:
Open.

### GAP-005 — AI sharing approval authority

Issue:
Approval before external sharing is required, but eligible approvers and
detailed review behavior are not confirmed.

Required resolution:
Confirm authority and allocate approval enforcement within 20–21.

Status:
Open; no role receives this authority by assumption.

### GAP-006 — Site material-request capture

Issue:
Material requests are required but no individual site sprint explicitly owns
their initial capture UI and workflow.

Proposed resolution:
Assign capture to an approved Sprint 31/32 scope and fulfillment links to 35–38.

Status:
Open ownership; proposed placement is not authorization to expand scope.

### GAP-007 — Goods receipts before inventory

Issue:
Sprint 36 introduces receipts before the stock ledger in 37.

Required resolution:
Specify receipt and stock-posting boundaries.
Integrate and test exactly-once stock effects in 37.
Do not claim physical stock integrity from receipt-record creation alone.

Status:
Open technical boundary.

### GAP-008 — Administration and settings ownership

Issue:
Several settings are required without a single explicit implementation sprint.

Proposed resolution:
Distribute company/global settings, numbering, stages, approval settings,
provider configuration and audit oversight among relevant approved sprints.

The exact allocation must be recorded during Phase 0 reconciliation.

Status:
Open under DEC-027.

### GAP-009 — Functional global search

Issue:
Sprint 06 specifies layout, not a working cross-module search backend.

Required resolution:
Approve a functional implementation owner and per-module integration plan.
Layout completion does not satisfy PLT-001 search behavior.

Status:
Open under DEC-027.

### GAP-010 — Configurable custom fields

Issue:
The platform inventory includes custom fields, but field types, applicable
modules, validation, permissions, reporting and implementation ownership
are undefined.

Required resolution:
Confirm whether configurable custom fields are required for initial launch.
If required, define their acceptance criteria and assign approved work.
If deferred, obtain explicit scope approval.

Status:
Open scope and roadmap gap; not silently omitted.

### GAP-011 — Commercial changes after Won

Issue:
Controlled scope changes are required, but detailed variation/contract-value
behavior is not explicit in a dedicated sprint.

Required resolution:
Resolve DEC-006 and assign commercial change work across quotation,
project/change tracking and Finance sprints as approved.

Status:
Open.

### GAP-012 — Detailed policy and quality targets

Issue:
Tax, approval thresholds, privacy/retention, performance, accessibility
and recovery targets are not yet concrete.

Required resolution:
Resolve the relevant decision before claiming the affected criterion passed.
Keep measurable expectations in the final test specification.

Status:
Open; provisional criteria are not completed tests.

## 7. Coverage conclusion

Every baseline requirement ID has a mapping in this document.

All 38 requested workflows have a planned work and acceptance cross-reference.

Known unassigned or ambiguous feature ownership is explicitly flagged.
This is traceability with visible gaps, not a claim that the roadmap
already resolves every requirement.

All implementation and software test outcomes remain unexecuted.

Sprint 01 approval must either resolve identified gaps or explicitly
accept them as tracked follow-up decisions with their approval deadlines.
Sprint 02 must not finalize an architecture that silently assumes
unapproved answers.