# Afaq Al Manzel Interiors CRM — Project Operations Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed physical design

## 1. Scope

Defines proposed records for:
- Planning and tasks.
- Scope changes.
- Internal and final handover.
- Design packages/revisions/reviews/releases.
- Site reporting/inspection/material requests.

Uses the complete Common Mutable Columns and Archive Columns defined
in DATABASE_CONVENTIONS.md.

Default — means no database default.

Planned referenced tables:
- file_assets: platform/private-file dictionary.
- materials: procurement/inventory dictionary.
- units: procurement/inventory dictionary.

No migrations are authorized by this document.

## 2. Shared planning

### 2.1 task_statuses

Purpose:
Configurable display stages for project, design and site task workspaces.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| task_domain | text | NN | — |
| code | text | NN | — |
| name | text | NN | — |
| state_category | text | NN | — |
| sort_order | integer | NN | 0 |

Proposed domains:
project, design, site.

Proposed categories:
open, in_progress, blocked, completed, cancelled.

Uniqueness:
(task_domain, code).
Additional composite uniqueness supports domain-consistent references.

Rules:
- Labels are configurable; protected completion behavior is not arbitrary.
- Reclassifying a status must not silently rewrite completion evidence.
- A completed-looking column does not bypass required approval/evidence.
- Archive must preserve referenced history.

### 2.2 project_milestones

Purpose:
Project-level targets and completion tracking.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| title | text | NN | — |
| description | text | Nullable | — |
| target_date | date | Nullable | — |
| milestone_status | text | NN | 'planned' |
| completed_at | timestamptz | Nullable | — |
| completed_by | uuid | Nullable, FK employees.id | — |
| sort_order | integer | NN | 0 |

Proposed states:
planned, in_progress, completed, cancelled.

Rules:
- Completion authority/evidence follows approved business policy.
- Milestones are not automatically invoice events.
- Financial billing milestones remain separate, explicitly linked where needed.

### 2.3 project_tasks

Purpose:
Shared tasks used by project planning, design and site workspaces.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| milestone_id | uuid | Nullable, FK project_milestones.id | — |
| parent_task_id | uuid | Nullable, FK project_tasks.id | — |
| task_domain | text | NN | — |
| status_id | uuid | NN, FK task_statuses.id | — |
| title | text | NN | — |
| description | text | Nullable | — |
| assigned_employee_id | uuid | Nullable, FK employees.id | — |
| priority | text | NN | 'normal' |
| planned_start_at | timestamptz | Nullable | — |
| due_at | timestamptz | Nullable | — |
| completed_at | timestamptz | Nullable | — |
| completed_by | uuid | Nullable, FK employees.id | — |
| blocker_summary | text | Nullable | — |
| sort_order | integer | NN | 0 |

Proposed priorities:
low, normal, high, urgent.

Rules:
- Status domain must equal task_domain.
- Parent and milestone must belong to the same project.
- Parent nesting cannot contain a cycle or self-reference.
- Assigned employee must be eligible and appropriately authorized.
- Due time cannot precede planned start where both are supplied.
- Final completion requires applicable domain prerequisites.
- Tasks do not directly represent design approval or project closure.
- Site and design task lists are filtered views of this table.

### 2.4 project_task_dependencies

Purpose:
Explicit task prerequisites.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| task_id | uuid | NN, FK project_tasks.id | — |
| prerequisite_task_id | uuid | NN, FK project_tasks.id | — |
| created_at | timestamptz | NN | now() |
| created_by | uuid | NN, FK employees.id | — |

Primary key:
(task_id, prerequisite_task_id).

Rules:
- No self-dependency.
- Both tasks belong to the same project under the initial proposal.
- Reject dependency cycles, including concurrent attempts.
- Exact blocking/completion behavior must follow approved task rules.

### 2.5 project_task_files

Purpose:
Task evidence and working attachments.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| task_id | uuid | NN, FK project_tasks.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Primary key:
(task_id, file_asset_id).

Rules:
- Validate task and file access independently.
- A working attachment is not an approved execution release.

### 2.6 project_comments

Purpose:
Internal project discussion, optionally linked to a task.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| task_id | uuid | Nullable, FK project_tasks.id | — |
| body | text | NN | — |

Rules:
- Task must belong to project_id.
- Internal only.
- External design reviewers cannot retrieve these comments.
- Editing retains required history.

### 2.7 project_documents

Purpose:
Explicit project-context document links.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| project_id | uuid | NN, FK projects.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| document_category | text | NN | — |
| title | text | NN | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Rules:
- Prevent duplicate equivalent links.
- Category does not itself grant access.
- Finance documents require finance permission.
- Approved execution references come from design releases.
- Client visibility is granted through explicit review/handover mechanisms,
  not by granting access to this entire collection.

## 3. Scope changes and handover

### 3.1 project_scope_changes

Purpose:
Record proposed and authorized changes after initial accepted scope.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| sequence_number | integer | NN | — |
| title | text | NN | — |
| change_description | text | NN | — |
| reason | text | NN | — |
| commercial_effect_summary | text | Nullable | — |
| related_quotation_version_id | uuid | Nullable, FK quotation_versions.id | — |
| change_status | text | NN | 'draft' |
| decided_at | timestamptz | Nullable | — |
| decided_by | uuid | Nullable, FK employees.id | — |

Uniqueness:
(project_id, sequence_number).

Proposed states:
draft, submitted, approved, rejected, withdrawn.

Rules:
- Original accepted scope remains unchanged.
- Related quotation must have the approved relationship to the project.
- Commercial changes require approved customer/internal evidence.
- This record alone cannot alter contract value or issue invoices.
- Approval authority, customer acceptance and financial effects remain
  open under DEC-006.
- Do not implement an arbitrary employee approval as sufficient.
- Additional commercial decision/evidence records may be required once
  policy is confirmed; reconcile before final schema approval.

### 3.2 project_handover_items

Purpose:
Checklists for internal Sales-to-Project and final client handover.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| handover_kind | text | NN | — |
| title | text | NN | — |
| description | text | Nullable | — |
| assigned_employee_id | uuid | Nullable, FK employees.id | — |
| item_status | text | NN | 'pending' |
| sort_order | integer | NN | 0 |
| completed_at | timestamptz | Nullable | — |
| completed_by | uuid | Nullable, FK employees.id | — |
| completion_notes | text | Nullable | — |

Proposed kinds:
sales_to_project, final_client.

Proposed states:
pending, in_progress, completed, not_applicable.

Rules:
- Internal handover is separate from final handover.
- Incomplete internal handover does not prevent project existence.
- Checklist completion is not proof of client acceptance.
- Mandatory items and acceptance authority require approved policy.

### 3.3 project_handover_files

Purpose:
Evidence for a handover checklist item.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| handover_item_id | uuid | NN, FK project_handover_items.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Primary key:
(handover_item_id, file_asset_id).

Rules:
Validate item/project and file access.
A final client document must be explicitly eligible for external disclosure.

### 3.4 project_handover_events

Purpose:
Preserve attributable handover review/receipt evidence.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| project_id | uuid | NN, FK projects.id | — |
| handover_kind | text | NN | — |
| event_kind | text | NN | — |
| recorded_by | uuid | NN, FK employees.id | — |
| occurred_at | timestamptz | NN | — |
| recorded_at | timestamptz | NN | now() |
| recipient_name_snapshot | text | Nullable | — |
| client_contact_id | uuid | Nullable, FK client_contacts.id | — |
| evidence_summary | text | NN | — |

Rules:
- Contact must belong to the project's client.
- Event categories and sufficient acceptance evidence require approval.
- Final receipt evidence does not automatically prove all obligations
  completed or all invoices paid.
- Append corrections rather than silently replacing evidence.

## 4. Design content

### 4.1 design_packages

Purpose:
A room-wise or otherwise defined collection of design deliverables.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| package_number | text | NN | — |
| title | text | NN | — |
| room_label | text | Nullable | — |
| description | text | Nullable | — |
| assigned_designer_id | uuid | Nullable, FK employees.id | — |
| primary_task_id | uuid | Nullable, FK project_tasks.id | — |

Uniqueness:
(project_id, package_number).

Rules:
- Linked task must be a compatible task in the same project.
- Multiple tasks may support a package through explicit links defined
  if required; do not duplicate the package for each task.
- Archiving cannot delete submitted revision history.

### 4.2 design_revisions

Purpose:
Identifiable design content submitted for review.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| package_id | uuid | NN, FK design_packages.id | — |
| revision_number | integer | NN | — |
| previous_revision_id | uuid | Nullable, FK design_revisions.id | — |
| preparation_state | text | NN | 'draft' |
| change_summary | text | Nullable | — |
| submitted_at | timestamptz | Nullable | — |
| submitted_by | uuid | Nullable, FK employees.id | — |
| content_digest | text | Nullable | — |

Uniqueness:
(package_id, revision_number).

Proposed preparation states:
draft, submitted, withdrawn.

Rules:
- Revision number is positive.
- Predecessor belongs to the same package.
- Submitted content and included file manifest are frozen.
- Submitted content_digest is required.
- The technical design must define deterministic manifest hashing.
- The digest supports integrity; it is not an authorization mechanism.
- Changed submitted content requires a new revision.
- Approval and release state are separate records.

### 4.3 design_revision_files

Purpose:
Exact files included in a revision.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| revision_id | uuid | NN, FK design_revisions.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| file_category | text | NN | — |
| title | text | NN | — |
| client_visible | boolean | NN | false |
| sort_order | integer | NN | 0 |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Uniqueness:
(revision_id, file_asset_id).

Proposed categories:
drawing, render, reference, ai_concept, other.

Rules:
- File bytes/object identity must remain immutable after submission.
- Prevent replacing an object behind an approved file reference.
- client_visible alone does not create a review grant.
- Submitted manifest cannot be changed through ordinary updates.

### 4.4 design_internal_comments

Purpose:
Internal discussion that external reviewers must not access.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| revision_id | uuid | NN, FK design_revisions.id | — |
| body | text | NN | — |

Rules:
Internal employee access only.
Do not mix these records into client-visible review queries.

## 5. Design review and external access

The tables below define access boundaries without selecting an
unapproved email/WhatsApp identity-verification mechanism.

### 5.1 design_review_rounds

Purpose:
Explicit review cycle for one submitted revision.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| revision_id | uuid | NN, FK design_revisions.id | — |
| round_number | integer | NN | — |
| round_status | text | NN | 'open' |
| closed_at | timestamptz | Nullable | — |
| closure_reason | text | Nullable | — |

Uniqueness:
(revision_id, round_number).

Proposed states:
open, closed, revoked.

Rules:
- Only submitted immutable content can enter review.
- Review ordering and reopening rules require DEC-015.
- Do not infer release eligibility from the most recent timestamp alone.
- Review rounds do not permit changing the underlying revision.

### 5.2 design_review_grants

Purpose:
Limit a designated external contact to a review submission.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| review_round_id | uuid | NN, FK design_review_rounds.id | — |
| client_contact_id | uuid | NN, FK client_contacts.id | — |
| expires_at | timestamptz | NN | — |
| revoked_at | timestamptz | Nullable | — |
| granted_capabilities | jsonb | NN | — |

Rules:
- Contact belongs to the project's client.
- Capabilities use a validated allowlist.
- Grant does not confer employee access.
- No raw access token is stored here.
- Delivery channel is separate from verification.
- Expiry, revocation and multiple-representative policy remain open.
- Download permission must be explicit where applicable.

### 5.3 design_review_sessions

Purpose:
Record a scoped externally verified session without selecting the
final verification provider.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| grant_id | uuid | NN, FK design_review_grants.id | — |
| verification_method | text | NN | — |
| verified_at | timestamptz | NN | — |
| expires_at | timestamptz | NN | — |
| revoked_at | timestamptz | Nullable | — |
| verifier_reference | text | Nullable | — |

Rules:
- Created only by the approved server verification flow.
- verifier_reference is non-secret.
- Raw OTP, session bearer token and invitation secrets are not stored.
- Session expiry cannot extend effective access beyond grant expiry.
- Revoking grant/session prevents subsequent protected actions.
- Final session credential storage and token hashing will be specified
  with the selected verification mechanism.
- These columns do not imply that identity verification is already solved.

### 5.4 design_review_comments

Purpose:
Explicit client-visible review conversation.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| review_round_id | uuid | NN, FK design_review_rounds.id | — |
| employee_author_id | uuid | Nullable, FK employees.id | — |
| external_session_id | uuid | Nullable, FK design_review_sessions.id | — |
| body | text | NN | — |
| created_at | timestamptz | NN | now() |

Rules:
- Exactly one author type is present.
- External session must authorize this review round.
- Employee author requires permission to post client-visible content.
- Internal comments are stored separately.
- Correction/moderation rules must preserve required evidence.

### 5.5 design_review_decisions

Purpose:
Append-only PM/client decisions for a precise revision and review round.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| review_round_id | uuid | NN, FK design_review_rounds.id | — |
| reviewer_kind | text | NN | — |
| employee_reviewer_id | uuid | Nullable, FK employees.id | — |
| external_session_id | uuid | Nullable, FK design_review_sessions.id | — |
| decision | text | NN | — |
| reason | text | Nullable | — |
| decided_at | timestamptz | NN | now() |
| idempotency_key | uuid | NN, UQ | — |

Proposed reviewer kinds:
pm, client.

Proposed decisions:
approved, rejected, changes_requested.

Rules:
- PM kind requires an authorized employee reviewer and no external session.
- Client kind requires an eligible external session and no employee reviewer.
- The external session must authorize this review round.
- Decisions refer to the immutable revision through the review round.
- Concurrent conflicting decisions require serialized handling.
- Do not allow arbitrary repeated decisions to redefine approval silently.
- Final uniqueness/supersession rules depend on multiple-reviewer and
  revocation policy.
- One person's PM decision cannot replace the client decision.

### 5.6 design_releases

Purpose:
Immutable record of an execution release supported by exact approvals.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| revision_id | uuid | NN, FK design_revisions.id | — |
| review_round_id | uuid | NN, FK design_review_rounds.id | — |
| pm_decision_id | uuid | NN, FK design_review_decisions.id | — |
| client_decision_id | uuid | NN, FK design_review_decisions.id | — |
| released_by | uuid | NN, FK employees.id | — |
| released_at | timestamptz | NN | now() |
| supersedes_release_id | uuid | Nullable, FK design_releases.id | — |
| release_notes | text | Nullable | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Both decisions must be valid approvals for the specified round/revision.
- Reviewer kinds must match their columns.
- Release authority is checked at execution time.
- Mixed revisions cannot authorize release.
- Superseding release must relate to the same package.
- A controlled mechanism identifies the current release without deleting history.
- Revocation/withdrawal behavior needs the approved policy.
- Do not use one broad boolean such as is_approved to replace these checks.

## 6. Site daily reporting

### 6.1 site_reports

Purpose:
Stable report identity and submission deduplication.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| report_date | date | NN | — |
| title | text | NN | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Report date is a business calendar date.
- No unapproved one-report-per-project/day restriction is imposed.
- A repeat submission key cannot create another report.
- Content revisions are stored separately.

### 6.2 site_report_versions

Purpose:
Preserve daily report content and corrections.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| site_report_id | uuid | NN, FK site_reports.id | — |
| version_number | integer | NN | — |
| report_state | text | NN | 'draft' |
| work_summary | text | NN | — |
| workforce_notes | text | Nullable | — |
| progress_notes | text | Nullable | — |
| blockers | text | Nullable | — |
| next_actions | text | Nullable | — |
| correction_reason | text | Nullable | — |
| submitted_at | timestamptz | Nullable | — |
| submitted_by | uuid | Nullable, FK employees.id | — |

Uniqueness:
(site_report_id, version_number).

Proposed states:
draft, submitted, withdrawn.

Rules:
- Submitted versions are frozen.
- Corrections create a new version with a reason.
- Workforce notes must not collect unnecessary personal information.
- Reported progress is distinct from accepted completion.
- Current visible version is determined by the controlled publication rule.

### 6.3 site_report_photos

Purpose:
Photos/evidence belonging to an exact report version.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| report_version_id | uuid | NN, FK site_report_versions.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| caption | text | Nullable | — |
| captured_at | timestamptz | Nullable | — |
| sort_order | integer | NN | 0 |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Rules:
- Prevent duplicate equivalent links.
- Submitted report photo manifests are frozen.
- File access follows the project and report policy.
- Capture metadata is not assumed to prove when or where work occurred.

## 7. Inspections and snags

### 7.1 site_inspections

Purpose:
An attributable inspection of project work.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| inspection_kind | text | NN | — |
| title | text | NN | — |
| assigned_inspector_id | uuid | Nullable, FK employees.id | — |
| scheduled_at | timestamptz | Nullable | — |
| performed_at | timestamptz | Nullable | — |
| inspection_state | text | NN | 'planned' |
| summary | text | Nullable | — |
| acceptance_recorded_by | uuid | Nullable, FK employees.id | — |
| acceptance_recorded_at | timestamptz | Nullable | — |

Proposed kinds:
interim, final.

Proposed states:
planned, in_progress, submitted, accepted, rejected.

Rules:
- Inspection acceptance authority remains to be approved.
- Acceptance must validate required checklist/evidence and blocking snags.
- Conditional acceptance is not assumed permitted.
- Final inspection does not automatically close the project.

### 7.2 site_inspection_items

Purpose:
Preserve the actual checklist used for an inspection.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| inspection_id | uuid | NN, FK site_inspections.id | — |
| title | text | NN | — |
| criterion_text | text | NN | — |
| sort_order | integer | NN | 0 |
| result | text | NN | 'not_checked' |
| findings | text | Nullable | — |
| checked_by | uuid | Nullable, FK employees.id | — |
| checked_at | timestamptz | Nullable | — |

Proposed results:
not_checked, passed, failed, not_applicable.

Rules:
- Preserve the checklist wording used at inspection time.
- Accepted inspection evidence cannot be silently rewritten.
- Correcting accepted results requires a traceable approved process.
- Not applicable is distinct from passed.

### 7.3 snag_items

Purpose:
Track defects/issues and their resolution.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| inspection_id | uuid | Nullable, FK site_inspections.id | — |
| inspection_item_id | uuid | Nullable, FK site_inspection_items.id | — |
| related_task_id | uuid | Nullable, FK project_tasks.id | — |
| title | text | NN | — |
| description | text | NN | — |
| location_description | text | Nullable | — |
| severity | text | NN | 'normal' |
| assigned_employee_id | uuid | Nullable, FK employees.id | — |
| snag_status | text | NN | 'open' |
| due_at | timestamptz | Nullable | — |
| resolution_notes | text | Nullable | — |
| resolved_at | timestamptz | Nullable | — |
| resolved_by | uuid | Nullable, FK employees.id | — |

Proposed states:
open, in_progress, resolved, reopened.

Rules:
- Related inspection/task belongs to the same project.
- Inspection item belongs to the selected inspection.
- Resolution evidence and history are retained.
- Severity and blocking-closure rules require business approval.
- Archiving cannot hide an unresolved blocking defect.

### 7.4 site_evidence_files

Purpose:
Typed evidence links for inspections, inspection items or snags.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| inspection_id | uuid | Nullable, FK site_inspections.id | — |
| inspection_item_id | uuid | Nullable, FK site_inspection_items.id | — |
| snag_item_id | uuid | Nullable, FK snag_items.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| caption | text | Nullable | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Rules:
- Exactly one evidence target is populated.
- All targets are enforceable foreign keys, not arbitrary IDs.
- Prevent duplicate target/file links.
- Parent authorization applies to downloads.
- Accepted evidence cannot be silently replaced behind an unchanged file ID.

## 8. Site material requests

### 8.1 site_material_requests

Purpose:
Capture a site's material need before stock movement or purchasing.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| request_number | text | NN, UQ | — |
| destination_description | text | NN | — |
| required_by | date | Nullable | — |
| request_status | text | NN | 'draft' |
| justification | text | Nullable | — |
| submitted_at | timestamptz | Nullable | — |
| submitted_by | uuid | Nullable, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, submitted, under_review, partially_fulfilled, fulfilled, cancelled.

Rules:
- Destination must later resolve to an authorized stock/site location
  before stock fulfillment.
- Submitted request is not spending approval.
- Fulfillment derives from explicit purchasing/stock links.
- Partial fulfillment must not be represented as complete.
- Fulfillment integration ownership remains a tracked roadmap gap.

### 8.2 site_material_request_items

Purpose:
Requested quantities and item descriptions.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| request_id | uuid | NN, FK site_material_requests.id | — |
| line_number | integer | NN | — |
| material_id | uuid | Nullable, FK materials.id | — |
| description | text | NN | — |
| quantity | numeric(18,4) | NN | — |
| unit_code | text | NN, FK units.code | — |
| notes | text | Nullable | — |

Uniqueness:
(request_id, line_number).

Rules:
- Requested quantity must be positive.
- An uncatalogued description may be captured for review.
- A real compatible material/unit is required before stock movement.
- No automatic unit conversion.
- Stock availability, reservations and purchasing are separate facts.
- Do not maintain a freely editable fulfilled quantity as the only evidence.
  It must reconcile with actual linked fulfillment records.

## 9. Required follow-up definitions

The subsequent constraints/transaction documents must specify:
- Same-project consistency.
- Parent/dependency cycle protection.
- Status/domain consistency.
- Revision immutability.
- Review/session/grant consistency.
- Same-revision decision matching.
- Current-release selection and supersession.
- Evidence immutability.
- Report-version identity.
- Material request fulfillment reconciliation.
- Exactly-one typed-context checks.
- Idempotency and concurrency behavior.

## 10. Remaining policy dependencies

Not resolved by this schema proposal:
- Client verification mechanism.
- Client reviewer multiplicity.
- Review order and decision revocation.
- Scope-change commercial approvals.
- Inspection/final acceptance authority.
- Closure/reopening gates.
- Exact progress calculations.
- Material substitution, cancellation and fulfillment exceptions.

These must be resolved or explicitly bounded before final implementation.

## 11. Current status

Delivered:
Proposed project, design and site table dictionary.

Not delivered by this file:
Complete procurement, inventory, Finance, AI or platform schema;
final constraints; RLS; migrations.

No database or application tests have been executed.