# Afaq Al Manzel Interiors CRM — Open Decisions

Status: Draft — awaiting review
Document version: 0.1
Phase: 0
Sprint: 01

## How to use this register

Every entry below is Open.

Recommendations are suggestions, not approved decisions.
The business owner or an explicitly authorized delegate must approve
business policies. Technical decisions require project-owner approval
where they affect cost, security, privacy or production operation.

Record the selected answer, approver and date when resolving an entry.
Never record secret values here.

Open decisions do not prevent drafting Sprint 01 documents.
Architecture-affecting decisions must be resolved or explicitly deferred
with documented impact before approving the affected architecture.

## A. Required before finalizing Sprint 02 architecture

### DEC-001 — Technology and hosting

Question:
May architecture planning adopt the proposed Next.js/TypeScript,
Supabase and Vercel stack?

Why it matters:
Determines authentication, database access, deployment and job boundaries.

Options:
Approve the proposed stack; approve it with changes; evaluate alternatives.

Recommendation:
Use the proposed stack as the planning baseline, subject to package,
hosting capability, privacy and cost verification.

Affected sprints:
02–04, 09–12, 20, 44, 48.

Required approval:
Project owner.

Status:
Open.

### DEC-002 — Organization boundary and operating scale

Question:
Is this one company's standalone CRM, and how many employees,
concurrent users, projects and files should initial operation support?

Why it matters:
Affects data boundaries, permissions, capacity and cost.

Options:
One company; one company with branches; multiple organizations.

Recommendation:
Design for the stated standalone company unless business requirements
confirm additional organization boundaries.

Affected sprints:
02, 03, 10, 12, 45, 47, 48.

Required approval:
Business owner.

Status:
Open.

### DEC-003 — Record access and multi-role behavior

Question:
Which roles may view organization-wide, assigned-team or own records?
How should combined roles and explicit restrictions interact?

Why it matters:
Determines server permissions, RLS and information exposure.

Options:
Own/assigned access; department access; organization-wide access;
a documented combination with explicit restrictions.

Recommendation:
Use least privilege and explicit project membership as the starting
proposal. Do not infer finance access from project participation.

Affected sprints:
02, 10–12 and all domain modules.

Required approval:
Business owner and designated security/administration owner.

Status:
Open.

### DEC-004 — External client design approval

Question:
How should a client prove identity and access a designated revision?
Can multiple client representatives approve, and whose decision counts?

Why it matters:
Determines approval identity, links, expiry, revocation and audit evidence.

Options:
Verified email/OTP access; expiring scoped links; dedicated external
accounts with isolated permissions.

Recommendation:
Evaluate verified, expiring access scoped to one submission.
Do not grant ordinary employee access.

Affected sprints:
02, 12, 29, 43, 45.

Required approval:
Business owner.

Status:
Open.

### DEC-005 — Opportunity conversion and Project Manager ownership

Question:
What must exist before Won conversion? Must a PM be assigned first,
or may the new project await assignment? How is client matching confirmed?

Why it matters:
Affects conversion validation and transactional relationships.

Options:
Require PM selection before conversion; create immediately with explicit
pending assignment; apply an approved assignment rule.

Recommendation:
Choose an explicit ownership rule. Preserve immediate project creation
after a successful conversion and do not introduce payment as a prerequisite.

Affected sprints:
02, 13, 19, 22–26.

Required approval:
Sales and Project Management business owners.

Status:
Open.

### DEC-006 — Commercial scope and later changes

Question:
Must Won reference a client-accepted quotation version?
How are post-Won scope changes, revised contract values and approvals recorded?

Why it matters:
Affects commercial history, project scope and future financial accuracy.

Options:
Accepted quotation plus controlled variations; another approved
contract/scope record with controlled variations.

Recommendation:
Preserve the accepted version and record later changes separately.
Do not overwrite historical approved scope.

Affected sprints:
02, 18, 19, 22, 24, 26, 30, 39, 40.

Required approval:
Sales, Project Management and Finance business owners.

Status:
Open.

### DEC-007 — Finance and inventory measurement foundations

Question:
Is initial operation AED-only or multi-currency? What quantity precision,
units and unit conversions are required? Is stock valuation required?

Why it matters:
Affects monetary and quantity models and cross-module calculations.

Options:
AED-only or multi-currency; fixed units or controlled conversions;
quantity-only stock or an approved valuation approach.

Recommendation:
Confirm actual business needs before choosing precision, conversions
or valuation. Do not invent an accounting policy.

Affected sprints:
02, 18, 35–40.

Required approval:
Finance and Procurement business owners.

Status:
Open.

### DEC-008 — Privacy, retention and hosting location

Question:
What hosting regions, retention periods, deletion rules and permissions
for external image processing are required?

Why it matters:
Affects customer data, files, audits, backups and service selection.

Options:
Policies supplied by the business, with legal/privacy advice where needed.

Recommendation:
Document data categories and approved processing before selecting
production regions or sending customer photos externally.

Affected sprints:
02, 03, 12, 20, 29, 45, 47, 48.

Required approval:
Business owner and designated privacy/legal adviser where applicable.

Status:
Open.

### DEC-009 — Background work and delivery guarantees

Question:
Which supported mechanism will run AI work, reminders, notifications,
integration retries and other asynchronous operations?

Why it matters:
Some jobs are required before the dedicated automation sprint.

Options:
Database-backed worker; managed job service; supported scheduled
processing; a justified combination.

Recommendation:
Evaluate durable job state, bounded retries and duplicate protection.
Select providers only after capability and cost review.

Affected sprints:
02, 09, 16, 20, 22, 42–44.

Required approval:
Project owner for architecture and service cost.

Status:
Open.

## B. Required before the relevant module is implemented

| ID | Question | Why it matters | Options | Recommended starting point | Affected sprints | Required approval | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-010 | What are the final sales stages, qualification rules, Lost reasons and reopening rules? | Controls valid sales transitions. | Configurable stages with approved outcome rules. | Keep Won/Lost separate from display columns. | 13–16, 22 | Sales owner | Open |
| DEC-011 | Which duplicate matches block creation, warn or allow an authorized override? | Prevents both duplicates and incorrect customer merges. | Exact matching, reviewed fuzzy matching, controlled override. | Warn on uncertain matches and require review before merging. | 13, 17, 22, 23, 42 | Sales owner | Open |
| DEC-012 | What quotation numbering, discount authority, tax, rounding, terms and payment rules apply? | Determines commercial calculations and approvals. | Business-approved policies. | Obtain actual policies; do not invent rates or thresholds. | 18, 19, 39, 40 | Sales and Finance owners | Open |
| DEC-013 | Who may approve a quotation when the assigned PM is absent or also its author? | Determines delegation and separation of duties. | No delegation; named delegation; approved alternate approver. | Record explicit authority and delegation history. | 10, 19 | Business owner | Open |
| DEC-014 | What client evidence constitutes quotation acceptance and approval revocation? | Controls conversion and accepted scope. | Recorded written acceptance; signed document; approved digital process. | Preserve evidence against the exact version. | 19, 22 | Sales and PM owners | Open |
| DEC-015 | Do PM and client design reviews occur in parallel or in sequence? What happens after rejection or revocation? | Controls revision release and rework. | Parallel review; PM-first review; another approved sequence. | Always require both approvals for the same revision. | 28–30 | Design and PM owners | Open |
| DEC-016 | Who approves purchase requests and orders at each amount or exception? | Controls spending authority. | Business-defined approval bands and delegation. | Obtain actual thresholds before implementation. | 35, 36 | Business and Finance owners | Open |
| DEC-017 | How are returns, damage, reservations, negative-stock exceptions and count differences handled? | Controls physical stock integrity. | Approved movement and exception policies. | Use auditable ledger entries and controlled adjustments. | 37, 38 | Procurement and warehouse owners | Open |
| DEC-018 | How are invoice corrections, credits, refunds, overpayments and receipt allocation handled? | Prevents inaccurate balances and silent financial changes. | Finance-approved correction and allocation policies. | Preserve issued-document history and trace corrections. | 39, 40 | Finance owner | Open |
| DEC-019 | How are committed costs, actual costs, recognized revenue and margin defined? | Prevents double counting and misleading reports. | Approved cash-based or other explicitly defined management reporting. | Label metrics precisely; reconcile commitments and actual costs. | 36, 39–41 | Finance owner | Open |
| DEC-020 | What closes a project, who approves closure, and can it be reopened? | Separates operational completion from financial settlement. | Separate operational/financial gates; approved combined closure policy. | Keep completion and financial status distinguishable. | 24, 34, 39, 40 | PM and Finance owners | Open |
| DEC-021 | Which AI service/model/settings fit the budget, and what happens when usage is exhausted? | Controls cost, privacy and user expectations. | Provider/model options verified at implementation time. | Meter actual usage; approve quota behavior and budget enforcement. | 20, 21, 45 | Business owner | Open |
| DEC-022 | Which email sender/provider and reminder delivery rules apply? | Authentication and notifications need reliable delivery. | Approved transactional email provider and delivery policy. | Configure authentication delivery before Sprint 09 testing. | 09, 16, 43, 44 | Project owner | Open |
| DEC-023 | Which Meta accounts, forms and field mappings are authorized? | Determines integration access and imported data. | Approved account/form list and mapping. | Verify access and webhook processing before activation. | 42 | Sales/integration owner | Open |
| DEC-024 | What branding, language, typography, navigation and final visual references are approved? | Determines UI design acceptance. | Approved references and design review. | Retain the beige direction; treat color tokens as provisional. | 04–08 | Business owner | Open |
| DEC-025 | What file types, sizes, quotas and scanning controls are required? | Affects uploads, storage cost and safe file handling. | Business needs matched to supported controls. | Private storage, explicit limits and authorized downloads. | 12, 15, 20, 28, 32 | Project owner | Open |
| DEC-026 | What availability, backup, recovery-time and recovery-point targets apply? | Determines operational readiness and service plans. | Targets matched to business impact and budget. | Approve realistic targets and test restoration before launch. | 02, 45, 47, 48 | Business owner | Open |
| DEC-027 | Where will global search, settings, custom fields and audit oversight be implemented? | The roadmap lacks explicit ownership for parts of these features. | Assign work to existing sprints or approve roadmap changes. | Flag gaps in traceability; do not silently expand sprints. | 04, 06, 10–14, 41, 44 | Project owner | Open |
| DEC-028 | Which reference data and existing records need importing? | Determines migration scope and data quality checks. | No initial migration; approved import of reviewed records. | Use explicit approved sources; do not connect to the old CRM. | 17, 23, 35, 37, 39, 48 | Relevant business owners | Open |

## C. Optional enhancements

| ID | Question | Why it matters | Options | Recommendation | Affected sprints | Required approval | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-029 | Should official WhatsApp messaging be activated later? | Adds provider cost, permissions and delivery requirements. | Manual contact only; approved provider integration. | Start with the required manual contact actions. | 43 or separately approved work | Business owner | Open |
| DEC-030 | Is integrated telephony required? | Adds provider setup and possible recording/privacy obligations. | Manual activity logs; approved telephony provider. | Start with manual logging. | 43 or separately approved work | Business owner | Open |
| DEC-031 | Which future accounting product, if any, should be connected? | Determines external mappings and synchronization rules. | No provider selected; later approved connector. | Preserve integration boundaries without buying a subscription now. | 44 and later approved work | Business and Finance owners | Open |

## Resolution record template

Decision ID:
Selected answer:
Reason:
Approved by:
Approval date:
Affected documents:
Affected sprints:
Remaining conditions:

## Current conclusion

No decisions in this register have been approved by this document.

Resolve architecture-critical choices before final architecture approval.
Resolve later business policies before their affected implementation.

Do not store credentials or secret values in this register.