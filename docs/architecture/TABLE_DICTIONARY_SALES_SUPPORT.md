# Afaq Al Manzel Interiors CRM — Sales Support Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed physical design

## 1. Scope and conventions

This file extends TABLE_DICTIONARY_CORE.md.

Common Mutable Columns and Archive Columns include the complete columns
defined in DATABASE_CONVENTIONS.md.

Default — means no database default.

References to file_assets point to a planned platform table that must be
defined before migrations are generated.

All names, types and lifecycle labels remain proposed until Sprint 02 approval.

No tables or migrations are created by this document.

## 2. Employee invitations

### 2.1 employee_invitations

Purpose:
Track authorized employee invitation intent without storing authentication secrets.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| employee_id | uuid | NN, FK employees.id | — |
| invited_email | text | NN | — |
| invitation_status | text | NN | 'pending' |
| expires_at | timestamptz | NN | — |
| accepted_at | timestamptz | Nullable | — |
| revoked_at | timestamptz | Nullable | — |
| provider_reference | text | Nullable | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
pending, accepted, revoked.
Expiry is evaluated from expires_at and state.

Rules:
- Only an authorized administrator may invite an employee.
- Invitation email must agree with the intended employee identity.
- Acceptance must verify the identity through the approved authentication flow.
- provider_reference must be a non-secret identifier.
- Do not store raw invitation links, passwords or authentication tokens.
- Role assignments are separate authorized operations.
- A pending invitation does not grant application access.
- Duplicate invitation retries must not create uncontrolled duplicate effects.
- Reissuing an invitation must follow the approved expiry/revocation design.

Open:
Invitation lifetime and resend/rate-limit policy.

## 3. Customer notes

### 3.1 client_notes

Purpose:
Maintain internal notes for an existing client.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| client_id | uuid | NN, FK clients.id | — |
| title | text | Nullable | — |
| body | text | NN | — |

Rules:
- Access follows client scope and note permissions.
- Do not expose internal notes to external design reviewers.
- Editing and archiving preserve the required change history.
- A client note does not automatically become a project instruction
  or an approved commercial scope change.

## 4. Activities and follow-ups

### 4.1 sales_activities

Purpose:
Record calls, meetings, site visits and other permitted activity.

Despite its name, this shared activity record may relate to an opportunity,
lead or project, including project site visits.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| lead_id | uuid | Nullable, FK leads.id | — |
| opportunity_id | uuid | Nullable, FK opportunities.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| activity_kind | text | NN | — |
| title | text | NN | — |
| assigned_employee_id | uuid | Nullable, FK employees.id | — |
| scheduled_start_at | timestamptz | Nullable | — |
| scheduled_end_at | timestamptz | Nullable | — |
| occurred_at | timestamptz | Nullable | — |
| location_description | text | Nullable | — |
| activity_status | text | NN | 'planned' |
| notes | text | Nullable | — |
| outcome_summary | text | Nullable | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed activity kinds:
call, meeting, site_visit, note.

Proposed states:
planned, completed, cancelled.

Rules:
- Exactly one of lead_id, opportunity_id or project_id is populated.
- Access follows that selected context.
- A project activity does not grant access to unrelated sales records.
- End time must not precede start time.
- Completing an activity requires the applicable outcome/time information.
- Repeated submission with the same key cannot create another activity.
- Dates, outcomes and significant changes are auditable.
- Manual call logging does not imply integrated telephony.

### 4.2 activity_participants

Purpose:
Record eligible internal participants in an activity.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| activity_id | uuid | NN, FK sales_activities.id | — |
| employee_id | uuid | NN, FK employees.id | — |
| added_at | timestamptz | NN | now() |
| added_by | uuid | NN, FK employees.id | — |

Primary key:
(activity_id, employee_id).

Rules:
- Participation does not override record access.
- Validate eligibility before assigning or notifying participants.
- Customer attendance details are recorded through permitted activity
  information; clients are not inserted as employees.

### 4.3 activity_files

Purpose:
Attach authorized evidence to an activity.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| activity_id | uuid | NN, FK sales_activities.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Primary key:
(activity_id, file_asset_id).

Rules:
- The actor must be allowed to use the file and edit the activity.
- File downloads require activity-context authorization.
- Linking a file must not broaden unrelated access to it.

### 4.4 follow_ups

Purpose:
Track scheduled next actions independently of completed activity records.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| lead_id | uuid | Nullable, FK leads.id | — |
| opportunity_id | uuid | Nullable, FK opportunities.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| assigned_employee_id | uuid | NN, FK employees.id | — |
| title | text | NN | — |
| description | text | Nullable | — |
| due_at | timestamptz | NN | — |
| follow_up_status | text | NN | 'open' |
| completed_at | timestamptz | Nullable | — |
| completed_activity_id | uuid | Nullable, FK sales_activities.id | — |
| completion_notes | text | Nullable | — |

Proposed states:
open, completed, cancelled.

Rules:
- Exactly one lead/opportunity/project context is populated.
- A linked completion activity must have the same context.
- Overdue is derived from due_at and current state.
- Rescheduling is audited.
- Deactivated assignees require explicit reassignment handling.
- Reminder jobs reference this record; they do not replace it.
- Notification failure does not erase the follow-up.

## 5. Requirements detail

### 5.1 requirement_checklist_items

Purpose:
Track requirement questions/deliverables and partial completion.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| opportunity_id | uuid | NN, FK opportunities.id | — |
| opportunity_room_id | uuid | Nullable, FK opportunity_rooms.id | — |
| title | text | NN | — |
| description | text | Nullable | — |
| sort_order | integer | NN | 0 |
| completion_state | text | NN | 'pending' |
| response_text | text | Nullable | — |
| completed_at | timestamptz | Nullable | — |
| completed_by | uuid | Nullable, FK employees.id | — |

Proposed states:
pending, in_progress, completed, not_applicable.

Rules:
- Room must belong to the same opportunity.
- Not applicable is distinct from completed.
- Partial collection is allowed.
- Mandatory-item rules remain a business decision.
- Completion does not certify engineering measurements.
- Reopening an item must preserve history.

### 5.2 opportunity_reference_files

Purpose:
Link private customer reference images/documents to an opportunity
and optionally a room.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| opportunity_id | uuid | NN, FK opportunities.id | — |
| opportunity_room_id | uuid | Nullable, FK opportunity_rooms.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| caption | text | Nullable | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Rules:
- Room/opportunity relationships must agree.
- Prevent duplicate equivalent links.
- Access to the opportunity does not authorize external AI processing.
- External processing authorization is recorded separately.
- File availability does not imply permission to share outside the CRM.

### 5.3 requirement_change_events

Purpose:
Preserve meaningful requirements changes without overwriting history.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| opportunity_id | uuid | NN, FK opportunities.id | — |
| requirement_record_id | uuid | Nullable, FK opportunity_requirements.id | — |
| room_id | uuid | Nullable, FK opportunity_rooms.id | — |
| checklist_item_id | uuid | Nullable, FK requirement_checklist_items.id | — |
| change_kind | text | NN | — |
| changed_fields | jsonb | NN | — |
| changed_by | uuid | NN, FK employees.id | — |
| changed_at | timestamptz | NN | now() |

Rules:
- Exactly one detailed target is populated.
- Detailed target must belong to opportunity_id.
- changed_fields uses a bounded validated before/after representation.
- Do not store credentials or unrelated records in JSON.
- Append only through controlled requirements operations.
- This user-facing history does not replace protected audit records.

## 6. Import staging

### 6.1 lead_import_batches

Purpose:
Track an authorized uploaded import and its processing outcome.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| source_file_asset_id | uuid | NN, FK file_assets.id | — |
| source_id | uuid | NN, FK lead_sources.id | — |
| batch_status | text | NN | 'uploaded' |
| mapping_configuration | jsonb | Nullable | — |
| total_rows | integer | NN | 0 |
| processed_rows | integer | NN | 0 |
| succeeded_rows | integer | NN | 0 |
| rejected_rows | integer | NN | 0 |
| review_rows | integer | NN | 0 |
| started_at | timestamptz | Nullable | — |
| finished_at | timestamptz | Nullable | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
uploaded, validating, awaiting_review, processing, completed, failed.

Rules:
- Nonnegative counters.
- Counters reconcile with row outcomes under the defined processing model.
- Do not mark a batch completed while rows remain unresolved.
- Validate mapping before applying writes.
- Source file is private.
- Retry must not re-create successful rows.
- Allowed Excel formats, parser limits and file policies require definition.

### 6.2 lead_import_rows

Purpose:
Record row-level validation, matching and application results.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| batch_id | uuid | NN, FK lead_import_batches.id | — |
| row_number | integer | NN | — |
| normalized_input | jsonb | NN | — |
| row_status | text | NN | 'pending' |
| validation_errors | jsonb | NN | '[]' |
| duplicate_candidates | jsonb | NN | '[]' |
| resulting_lead_id | uuid | Nullable, FK leads.id | — |
| reviewed_by | uuid | Nullable, FK employees.id | — |
| reviewed_at | timestamptz | Nullable | — |
| review_resolution | text | Nullable | — |
| processed_at | timestamptz | Nullable | — |

Uniqueness:
(batch_id, row_number).

Proposed states:
pending, invalid, review_required, applied, skipped, failed.

Rules:
- Row numbers are positive.
- JSON schemas are bounded and validated.
- Matching candidates exposed to reviewers must be within their scope.
- Applying the same row again cannot create another lead.
- A resulting lead is assigned only after a successful controlled write.
- Retention of uploaded/raw customer data requires approved policy.
- Diagnostic errors must not expose unrelated customer information.

## 7. Automation attribution boundary

The current core Common Mutable Columns require employee actors.

Before automated ingestion is implemented, the complete platform design
must specify the integration/service actor and required core adjustments.

Do not:
- Invent an employee to represent a machine.
- Allow arbitrary caller-supplied created_by values.
- Make every actor field nullable without a controlled provenance model.
- Claim the ingestion design is migration-ready before this is reconciled.

Human-confirmed imports may preserve their real initiating employee,
but background service identity must also remain traceable.

## 8. Required constraints and indexes

The later constraints document must cover:
- Invitation idempotency and lifecycle consistency.
- Exactly-one context constraints.
- Context equality for linked completion activities.
- Room/opportunity consistency.
- Import row uniqueness and safe replay.
- File-link uniqueness.
- Actor eligibility.
- Relevant parent foreign-key indexes.
- Assignee/due-date indexes for open follow-ups.
- Import batch/status retrieval.

No index or constraint has been executed.

## 9. Current status

Delivered:
Proposed sales/support schema.

Pending:
Platform file/actor definitions, final constraints, RLS, implementation
and policy decisions.

No application or database tests have run for this document.