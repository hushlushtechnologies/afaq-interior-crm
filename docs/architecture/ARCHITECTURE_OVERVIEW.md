# Afaq Al Manzel Interiors CRM — Architecture Overview

Document version: 0.1
Phase: 0
Sprint: 02
Status: Architecture draft — not implemented or approved as complete

## 1. Purpose

Define a maintainable technical structure for the approved requirements.

Initial operating context:
- One company: Afaq Al Manzel Interiors.
- Approximately 20 employees.
- Approximately 3 concurrently active projects.
- AED-only financial records.
- No automatic unit conversions initially.
- UAE hosting requirement.

These figures are planning inputs, not verified capacity guarantees.

## 2. Approval and implementation state

Sprint 01:
Approved by the user.

Sprint 02:
Authorized and in progress.

Application:
Not initialized by this architecture delivery.

Database:
No tables or migrations created.

Providers:
The proposed stack is accepted for planning, subject to UAE compatibility,
capability, privacy and cost verification.

## 3. Architecture style

Use a modular monolith initially.

Meaning:
One application contains clearly separated business modules rather
than many independently deployed microservices.

Reasons:
- Appropriate initial team and project scale.
- Simpler deployment and troubleshooting.
- Easier consistency across related operations.
- Clear boundaries permit later extraction if justified.

A background worker may run separately where execution duration or
reliability requires it. It remains part of the same product architecture.

## 4. Proposed components

### 4.1 Browser application

Proposed technologies:
- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- Reusable accessible components.

Responsibilities:
- Render authorized screens.
- Capture user input.
- Present loading, empty, error and success states.
- Support desktop, tablet and mobile work.
- Display permissions without acting as the sole enforcement layer.

Restrictions:
- No service-role key.
- No provider credentials.
- No client-authoritative financial totals.
- No authority to bypass approvals or stock rules.

### 4.2 Server application

Proposed implementation:
Next.js server-side functionality and route handlers.

Responsibilities:
- Validate input.
- Authenticate requests.
- Enforce action and record permissions.
- Orchestrate domain operations.
- Request protected database operations.
- Authorize file access.
- Integrate with approved external providers.

The application server must not be assumed to run in the UAE merely
because its database does.

### 4.3 PostgreSQL database

Proposed service:
Supabase PostgreSQL, conditional on UAE compatibility.

Responsibilities:
- Persist business records.
- Enforce relationships and uniqueness.
- Apply appropriate Row Level Security.
- Protect critical state transitions.
- Execute atomic business operations.
- Preserve auditable history.

Database constraints must protect invariants even when two requests
arrive concurrently.

### 4.4 Identity service

Proposed service:
Supabase Auth, conditional on approved deployment and residency.

Responsibilities:
- Employee authentication.
- Session lifecycle.
- Approved verification and recovery mechanisms.

Employee profiles, role assignments and project membership belong to
the CRM's authorization model.

External client approval identity is a separate access problem.
Clients must not receive ordinary employee roles.

### 4.5 Private file storage

Proposed service:
Supabase Storage or another separately approved compatible service.

Responsibilities:
- Private customer references.
- Quotation documents.
- Design files and revisions.
- Site photos and reports.
- Procurement and Finance evidence.
- AI source/result assets.

Files require authorization independently of visible application links.

Storage location, backups, delivery paths and processing must be checked
against the confirmed UAE policy.

### 4.6 Durable background processing

Purpose:
Handle work that may outlive a normal web request.

Examples:
- AI generation.
- Notification delivery.
- Scheduled reminders.
- Integration retrieval and retries.
- Longer-running document generation where required.

Required properties:
- Durable job identity and state.
- Bounded retries.
- Duplicate-effect protection.
- Safe operational visibility.
- Appropriate execution permissions.
- Approved residency and cost.

The mechanism/provider has not been selected or installed.

### 4.7 External provider adapters

Separate adapters for:
- AI generation.
- Transactional email.
- Meta Lead Ads.
- Future approved messaging.
- Future approved telephony.
- Future accounting integration.

An adapter translates between the CRM's domain operations and a
provider-specific API.

Provider failure must not unnecessarily disable unrelated CRM work.

## 5. Domain boundaries

| Domain | Owns |
| --- | --- |
| Identity and access | Employee profiles, roles, permissions, invitations and memberships |
| Sales | Leads, opportunities, pipelines, requirements and follow-ups |
| Customers | Shared client identity, contacts and addresses |
| Quotations | Commercial drafts, versions, items, approvals and documents |
| Projects | Project identity, team, scope references, schedules and handover |
| Design | Packages, revisions, files, reviews and releases |
| Site | Daily reports, execution tasks, inspections, snags and material requests |
| Procurement | Vendors, purchasing requests, supplier offers, orders and receipts |
| Inventory | Locations, stock ledger, reservations, transfers and counts |
| Finance | Budgets, invoices, receipts, allocations, bills, expenses and financial metrics |
| AI | Generation requests, assets, usage and cost-control evidence |
| Platform | Private attachments, notifications, audit, settings, saved views and integration events |

Shared components do not erase domain ownership.

Do not create duplicate generic task, document or comment structures
without a defined purpose and authorization model.

Detailed normalization belongs to the table dictionary.

## 6. Request flow

A protected business action follows this conceptual sequence:

1. Receive the request.
2. Verify identity.
3. Validate the input shape and values.
4. Check action permission and record scope.
5. Read the current business state.
6. Perform the authorized database operation.
7. Commit required business changes consistently.
8. Return the permitted result.
9. Process committed background work separately where applicable.

The database must enforce the constraints needed to survive concurrent
requests. Application checks alone are insufficient.

## 7. Authorization principles

Confirmed:
- Multiple roles are supported.
- Access is limited to authorized domains and records.
- PMs may view financial information for assigned projects.
- PMs may approve quotations they prepared.
- Business approval prerequisites still apply.
- External clients do not receive employee access.

Proposed architecture:
Evaluate action permission, record relationship, current state and
business prerequisites for each protected operation.

Open:
- Detailed role grant combinations.
- Conflict/explicit-denial rules.
- Final permission catalog.
- Exceptional delegation and recovery access.

Technical administration is not an automatic substitute for a PM or
client approval.

## 8. Critical integrity boundaries

### Won conversion

Confirmed:
An eligible PM must be selected before successful conversion.

Required:
- Validate current authority and outcome.
- Resolve the client.
- Preserve accepted commercial scope.
- Create one linked project.
- Record the Won result and required audit/handover initiation consistently.
- Do not require payment.
- Prevent duplicate projects under retries and concurrency.

Open:
Whether a client-accepted, PM-approved quotation is mandatory in every case.

### Quotation approval

- Decision references the exact version.
- PM self-approval is permitted.
- Approved commercial content is not silently overwritten.
- Changed commercial content requires a new version.
- Sending remains restricted to eligible approved versions.

### Design release

- PM and client decisions reference the same revision.
- One party's decision does not replace the other.
- Client review cannot expose internal records.
- New content does not inherit approval automatically.

### Inventory

- Movements preserve quantity integrity.
- Reservations remain separate from physical movements.
- Automatic unit conversions are not supported initially.
- Posting, returns, damage and exceptions need approved policies.

### Finance

- Use precise decimal monetary arithmetic.
- Initial records use AED.
- Separate quotes, contracts, invoices, cash, commitments and actual costs.
- Prevent duplicate posting and double counting.
- PM financial access is project-scoped.
- Tax, rounding, corrections and profitability definitions remain open.

## 9. Hosting and data residency gate

Confirmed business requirement:
UAE hosting.

Unresolved:
Whether the requirement also prohibits external processing outside
the UAE for email, AI, support systems and other services.

Before production provider selection, verify:
- Database region.
- Authentication data and processing.
- File storage and delivery.
- Backups and recovery copies.
- Application compute.
- Background worker compute.
- Logs and monitoring.
- Email and AI processing.
- Relevant provider support/subprocessor arrangements.

Current evidence:
Provider compatibility has not been verified.

Do not:
- Claim the selected stack satisfies UAE residency.
- Choose a nearby foreign region as a substitute.
- Upload real customer data to an unverified service.
- Change the approved stack without explaining the conflict and obtaining
  approval for the required alternative.

Use synthetic development data until the relevant processing is approved.

## 10. Communication and external review

Confirmed preference:
WhatsApp.

Not confirmed:
Official WhatsApp Business API integration.

Initial architecture:
Keep invitation delivery separate from reviewer verification.

A manually delivered WhatsApp link can be a communication mechanism.
It does not by itself prove reviewer identity.

Email verification remains under evaluation.

The final review design must define:
- Reviewer identity.
- Submission scope.
- Expiry and revocation.
- Forwarded-link behavior.
- Decision attribution.
- File access.
- Multiple client representatives.
- Recovery when verification fails.

## 11. Retention and deletion

The business has no existing retention policy.

This does not mean:
- Delete records after an invented period.
- Retain all data forever as an approved policy.
- Apply arbitrary automatic cleanup.

Architecture must distinguish:
- Operational archiving.
- Required commercial/audit history.
- Personal-data retention decisions.
- File lifecycle.
- Backups.
- Approved legal or business deletion.

Production retention configuration remains blocked until policy approval.

## 12. Environment separation

Prepare separate development, staging and production configurations.

No secrets in:
- Browser code.
- Git history.
- Documentation.
- Chat.
- Ordinary diagnostic output.

Exact services, plans, package versions and environment variable names
will be finalized in the relevant later work.

No resources have been provisioned by this document.

## 13. Outstanding architecture gates

- UAE provider compatibility and residency scope.
- External client verification.
- Won quotation prerequisite.
- Detailed role combination and conflict rules.
- Commercial scope-change model.
- Financial policy and stock valuation needs.
- Background execution mechanism.
- Retention and recovery targets.
- Known Sprint 01 roadmap ownership gaps.

## 14. Current status

This is Part 1 of the Sprint 02 design delivery.

It is not the complete schema, RLS specification, storage design
or deployment plan.

No implementation or test results are claimed.