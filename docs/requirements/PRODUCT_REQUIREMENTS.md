# Afaq Al Manzel Interiors CRM — Product Requirements

Status: Draft — awaiting business review
Document version: 0.1
Phase: 0
Sprint: 01
Source: User-supplied Phase 0 master development prompt

## 1. Document authority

This document records the supplied product requirements.

Explicit requirements from the supplied plan are recorded as baseline
requirements. They have not yet passed the Sprint 01 review gate.

Recommendations, proposed permissions and unresolved business policies
must remain clearly identified until approved.

Open decisions are maintained in OPEN_DECISIONS.md.

Requirement identifiers in this document remain stable. More detailed
requirements may extend these identifiers without changing their meaning.

## 2. Product vision

Provide a standalone internal CRM connecting Sales, Interior Design,
Project Management, Site Operations, Procurement, Inventory, Finance
and Management.

Maintain a controlled record of the customer journey from initial
inquiry through project completion and closure.

## 3. Business goals

- Reduce fragmented spreadsheets, messages and duplicated records.
- Preserve customer, commercial, design and execution history.
- Make ownership, pending work and approvals visible.
- Prevent unauthorized quotation sharing and design release.
- Track materials across the central warehouse and project sites.
- Distinguish contractual, invoiced, received and cost amounts.
- Provide permission-controlled operational and management reporting.
- Support future integrations without requiring them for core operation.

## 4. Project boundaries

ISO-001:
Use a new standalone application, repository identity, Supabase project
and environment configuration. Do not modify or connect to the previous
AFAQ Enterprise CRM.

ISO-002:
Keep development, staging and production environments separate.
Do not reuse secrets from another application.

ISO-003:
Do not perform production data deletion or destructive changes without
explicit approval and an appropriate recovery plan.

## 5. Business entities

Lead:
An incoming inquiry.

Opportunity:
A specific potential interior project or deal.

Client:
The customer, with shared contact and address information.

Project:
Confirmed work with its own scope, team, schedule and operational records.

Quotation version:
A particular commercial proposal whose approval references that version.

Design revision:
A particular design submission whose approvals reference that revision.

A lead, opportunity, client and project are distinct concepts.
A client may have multiple opportunities and projects.

## 6. Users

The application supports eight employee roles:

- Super Admin.
- Management / Director.
- Sales Executive.
- Project Manager.
- Interior Designer.
- Site Engineer.
- Procurement Officer.
- Finance Officer.

ACC-001:
An employee may hold multiple authorized roles.

ACC-002:
Permissions must be configurable and enforced at the server and database
levels. Hiding a button does not constitute authorization.

ACC-003:
External clients receive only scoped access to designated design
revisions. They do not receive ordinary employee access.

Detailed permission proposals belong in ROLE_PERMISSION_MATRIX.md.
Unresolved access boundaries must not be treated as approved grants.

## 7. Functional scope

### DASH-001 — Dashboards

Provide permission-scoped role dashboards covering sales, quotations,
approvals, projects, design, site progress, purchasing, inventory,
finance, follow-ups, overdue work, activity and notifications.

Support relevant date and status filters.

### SAL-001 — Leads and opportunities

Support lead sources, lead records, opportunities, assignment,
qualification, duplicate detection, imports, activity history, search,
filters, sorting, pagination, exports and saved views.

Provide configurable Kanban and table views.

Separate configurable sales stages from protected Won/Lost outcomes.

### REQ-001 — Requirements collection

Capture project/property information, location, area, rooms, style,
materials, furniture, colors, budget, timeline, reference images,
measurements, site notes, special instructions and deliverables.

Allow partial completion and authorized changes with history.

### FUP-001 — Activities and follow-ups

Record calls, meetings, site visits, notes and attachments.
Support schedules, reminders, overdue work and activity history.

### QUO-001 — Quotations

Provide numbered quotations linked to the customer and opportunity.

Support room-wise items, materials/services, quantities, units, prices,
discounts, configurable taxes, totals, terms, payment milestones,
drafts, versions, PDFs, comments and customer status.

### QUO-APP-001 — Quotation approval

Require Project Manager approval of the exact quotation version before
customer-facing sending is permitted.

Changes to approved commercial content require a new version and the
applicable approval process.

Preserve approval and rejection history.

### AI-001 — AI Interior Studio

Support text-to-image concepts, reference images, room-photo redesign,
presets, prompt building, variations, history, private assets and links
to relevant business records.

Provide provider abstraction, asynchronous status, retry/error handling,
permissions, usage tracking, quotas and cost controls.

Preferred initial provider: OpenAI, subject to verification and approval.
Initial operating budget: AED 50/month.
Approximately 50 images/month is a target, not a guaranteed entitlement.

Generated concepts are not construction-ready drawings or verified
architectural measurements.

### CONV-001 — Won conversion

A successful Won operation must immediately create one linked project,
without waiting for payment.

Validate authorization and conversion prerequisites, identify or create
the client, preserve the accepted quotation and scope, handle Project
Manager ownership according to approved rules, initiate handover,
notify authorized employees and record the audit event.

The operation must be transactional and safe to repeat without creating
duplicate projects.

### CONV-002 — Lost outcome

Require a configured Lost reason.
Retain opportunity, quotation and communication history.

### CLI-001 — Client management

Provide client profiles, contacts, multiple addresses, communication
history, notes, documents, status, search and linked business records.

Support multiple projects per client without unnecessarily duplicating
shared client information.

Financial visibility remains permission-controlled.

### PRJ-001 — Project management

Provide project numbering, client/opportunity/quotation relationships,
scope, Project Manager, team, status, dates, milestones, tasks,
dependencies, documents, calendars, timelines, progress, comments,
activity, notifications, handover and closure.

Project existence, handover readiness and execution status are separate.
Allow valid parallel design, site, procurement and finance activities.

### DES-001 — Designer workspace

Provide designer dashboards, Kanban/table views, priorities, due dates,
assignments, room-wise packages, drawings, renders, references, AI
concepts, revisions, comments, reviews and deliverables.

### DES-APP-001 — Design approval and release

Require both Client and Project Manager approval of the same revision
before that revision is released as an approved execution reference.

Never combine approvals from different revisions.

Preserve who approved, when and which revision was approved.
Changed approved content requires a new revision and approval process.

### SITE-001 — Site operations

Provide mobile-friendly task views, daily reports, workforce notes,
visits, photos, issues, inspections, snags, material requests, blockers,
documents, completion evidence, final inspection and handover.

Restrict access to authorized projects and files.

### PUR-001 — Procurement

Provide vendors, contacts, materials, categories, purchase requests,
supplier quotations/comparisons, approval routing, purchase orders,
partial deliveries, goods receipts, documents, status and project
cost allocation.

Approval thresholds and purchasing authority require business approval.

### INV-001 — Inventory

Support central warehouse and project-site locations, material SKUs,
units, receipts, issues, transfers, reservations, adjustments, physical
counts, alerts, history, project allocation and reports.

Use a reliable transactional stock ledger or validated balance mechanism.

Preserve transfer quantity integrity and prevent unauthorized negative
stock. Define returns, damage and adjustment policies before implementation.

### FIN-001 — Internal financial tracking

Provide project budgets/categories, customer invoices/items, milestones,
receipts, payment allocations, supplier bills, expenses, purchase
commitments, balances, profitability and financial reports.

Distinguish quoted value, contract value, invoiced amount, received
amount, committed costs, actual costs, outstanding receivables and
estimated margin.

Use precise monetary arithmetic.
Confirm calculation, tax, rounding and correction policies before coding.

### REP-001 — Reports

Provide sales/source/conversion, quotation, follow-up, project, design,
site, procurement, inventory, budget, invoice, receipt, receivable,
profitability, management and audit reports.

Apply authorization to report data and exports.
Protect spreadsheet exports against unsafe formula content.

### ADM-001 — Administration

Provide employee, role, permission, company profile, branding, currency,
timezone, numbering, pipeline, task status, approval, notification,
AI, integration, storage, audit, saved-view and system settings.

AED and Asia/Dubai are suggested configurable defaults.

### COM-001 — Notifications and communication

Provide in-app and email notifications, configured verification/OTP,
follow-up reminders, approval requests, overdue alerts, assignment
alerts and integration failure alerts.

Initially support manual WhatsApp contact actions and call logging.
Keep future messaging and telephony integrations optional.

### INT-001 — Integrations

Support authorized Meta Lead Ads ingestion with verification,
deduplication, retries and logs.

Provide adapters for AI, email and future accounting integration.
An unconfigured optional integration must not prevent core CRM use.

### PLT-001 — Shared platform features

Provide permission-scoped global search, reusable forms, validation,
private uploads, comments, activity, audits, notifications, pagination,
sorting, filters, saved views, column visibility, CSV exports and
required print/PDF output.

Include loading, empty, error, success and permission-denied states.

## 8. Nonfunctional requirements

### NFR-SEC-001 — Security

- Validate inputs on the server.
- Enforce authorization on the server and database.
- Apply appropriate Row Level Security.
- Keep privileged keys out of browser code.
- Protect files with authorization-aware access.
- Use transactions for critical operations.
- Record critical changes and decisions in the audit trail.
- Apply security controls during feature development, not only at final review.

### NFR-PRIV-001 — Privacy

- Keep customer records and files private to authorized users.
- Obtain appropriate authorization before sending customer photos to AI services.
- Do not expose internal records through client approval access.
- Confirm retention, deletion, hosting and external-processing policies.
- Keep credentials out of source control, documentation and chat.

### NFR-UX-001 — Usability and accessibility

Use the approved beige glassmorphism direction with reusable components,
readable dense-data surfaces and responsive desktop/tablet/mobile layouts.

Support keyboard operation, visible focus, sufficient contrast,
reduced motion and clear interaction states.

Color tokens and detailed visual references remain provisional until
the relevant design review.

### NFR-REL-001 — Reliability and integrity

- Prevent duplicate conversion and integration processing.
- Preserve approved commercial and design history.
- Handle failed background operations visibly.
- Keep retries from duplicating business effects.
- Verify backup and restore before production.
- Provide migration and deployment rollback plans.

### NFR-PERF-001 — Performance

Confirm expected employees, concurrent use, record counts, file volumes,
response-time targets and availability expectations.

Do not invent guaranteed response times or service levels.
Select representative performance checks after targets are approved.

### NFR-MNT-001 — Maintainability

Prefer a modular monolith with clear domain boundaries.
Use consistent validation, reusable components and provider adapters.

Keep requirements, architecture decisions, migrations, setup instructions,
known issues and test evidence current.

Package choices and versions require validation during later Phase 0 work.

### NFR-QA-001 — Verification

For implementation sprints, perform appropriate type checks, linting,
automated tests, production builds and relevant database, permission,
browser, responsive and regression checks.

Document actual results and unexecuted checks separately.

Sprint 01 is documentation-only. Application builds and software tests
are not applicable to this sprint.

## 9. Out of scope

- Changes to the previous AFAQ Enterprise CRM.
- A full general ledger or unnecessary paid accounting subscription module.
- General internal CRM access for external clients.
- Treating AI images as construction-ready technical designs.
- Mandatory WhatsApp API or telephony integration at initial operation.
- Features outside the approved scope without review.

Future accounting, messaging and telephony adapters do not imply that
their external provider implementations are currently authorized.

## 10. Integration and technology assumptions

Next.js, React, TypeScript, Tailwind, Supabase and Vercel form the proposed
stack, not a record of installed or fully approved dependencies.

Transactional email provider, background processing, client approval
access and production service plans remain open decisions.

No API account, paid subscription or production credential is assumed
to exist.

## 11. Product success criteria

- Required modules and workflows are traceable to planned implementation.
- Unauthorized users cannot access protected operations or records.
- Unapproved quotations cannot be sent through controlled CRM channels.
- Repeated Won requests cannot create duplicate projects.
- Only a revision approved by both required parties can be released.
- Stock movements reconcile across warehouse and site locations.
- Financial reports use approved definitions and consistent calculations.
- Optional integrations can fail without breaking unrelated core work.
- Critical workflows pass documented tests and user acceptance.
- Backup, restore and deployment recovery are verified before launch.

Quantitative adoption, performance and business improvement targets
remain subject to approval.

## 12. Current status

This is a requirements draft.

No application code, database tables, migrations or integrations have
been implemented by this document.

Sprint 01 approval requires all eight documentation deliverables and
explicit user review.