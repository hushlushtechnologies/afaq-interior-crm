# Afaq Al Manzel Interiors CRM — Core Table Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed design — Part 2A

## 1. Scope

This file defines core proposed physical tables for:
- Employee access.
- Customers.
- Sales.
- Quotations.
- Initial project identity.

It is not the complete CRM schema.

Design/site, procurement/inventory, Finance, AI, storage, events and
other platform tables will be delivered in subsequent dictionary files.

Common Mutable Columns and Archive Columns are defined completely in
DATABASE_CONVENTIONS.md. A declaration includes those columns in full.

Column defaults shown as — mean no database default.

Tables must not be created from this document before the complete design
and unresolved policies are reviewed.

## 2. Open modeling choices

The following are explicit proposals, not previously confirmed business rules:

- A lead may originate more than one opportunity.
- An opportunity may be created from a lead or for an existing client.
- An opportunity's client relationship may remain empty until matching/conversion.
- Sales ownership is represented separately from project membership.
- Customer acceptance evidence may be recorded by an authorized employee;
  the final acceptable evidence policy is still open.
- Company records may have multiple named contacts.

These choices support the supplied scope but require review before
final schema approval.

The proposed schema must not be interpreted as permission to bypass
any confirmed conversion or approval prerequisite.

## 3. Identity and permissions

### 3.1 employees

Purpose:
Application employee profile linked to managed authentication.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| auth_user_id | uuid | Nullable, FK auth.users.id, UQ | — |
| display_name | text | NN | — |
| work_email | text | NN | — |
| phone | text | Nullable | — |
| employment_status | text | NN | 'invited' |
| created_at | timestamptz | NN | now() |
| updated_at | timestamptz | NN | now() |
| deactivated_at | timestamptz | Nullable | — |

Proposed status values:
invited, active, inactive.

Rules:
- An active employee requires an authenticated identity.
- Invitation lifecycle is not itself permission to sign in.
- Use normalized, case-insensitive uniqueness for work_email.
- Do not store passwords or session tokens here.
- Deactivation preserves historical authorship.
- Profile creation and authentication linkage are controlled operations.

Initial indexes:
Unique auth identity; normalized email uniqueness; employment status as needed.

### 3.2 roles

Purpose:
Named bundles of permissions.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| code | text | NN, UQ | — |
| name | text | NN | — |
| description | text | Nullable | — |
| is_active | boolean | NN | true |
| created_at | timestamptz | NN | now() |
| updated_at | timestamptz | NN | now() |

Rules:
- Seed the eight approved role identities through reviewed setup.
- Changing display names does not change stable role codes.
- Role eligibility is not determined by a freely editable name.
- Role definition changes require configuration permission and audit.

### 3.3 permissions

Purpose:
Stable action permissions checked by the application/database.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| code | text | NN, UQ | — |
| domain | text | NN | — |
| action | text | NN | — |
| description | text | NN | — |

Rules:
- Permission codes are controlled configuration, not user input.
- Business-sensitive actions receive distinct permissions.
- View, export, approve, send, post, convert and configure are not equivalent.
- Final catalog and conflict behavior belong in the authorization specification.

### 3.4 role_permissions

Purpose:
Assign permissions to roles.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| role_id | uuid | NN, FK roles.id | — |
| permission_id | uuid | NN, FK permissions.id | — |
| granted_at | timestamptz | NN | now() |
| granted_by | uuid | NN, FK employees.id | — |

Primary key:
(role_id, permission_id).

Rules:
- No duplicate role/permission pair.
- Grant/revoke changes are audited.
- Initial bootstrap uses a separately controlled setup operation.

### 3.5 employee_roles

Purpose:
Support multiple roles per employee.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| employee_id | uuid | NN, FK employees.id | — |
| role_id | uuid | NN, FK roles.id | — |
| granted_at | timestamptz | NN | now() |
| granted_by | uuid | NN, FK employees.id | — |

Primary key:
(employee_id, role_id).

Rules:
- No duplicate current assignment.
- Revocation removes current authority but not audit history.
- Do not permit employees to assign themselves roles.
- Role combination does not bypass exact-version or state prerequisites.

## 4. Customers

### 4.1 clients

Purpose:
Shared customer identity across opportunities and projects.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| client_number | text | NN, UQ | — |
| client_type | text | NN | — |
| display_name | text | NN | — |
| legal_name | text | Nullable | — |
| tax_registration_number | text | Nullable | — |
| notes_summary | text | Nullable | — |

Proposed client_type:
person, organization.

Rules:
- Do not use name, phone or email alone as a globally unique customer identity.
- Use approved matching rules and explicit review.
- Tax details are optional until applicable policy requires them.
- Private notes and financial history need their own access scope.
- Archiving must not break active linked projects.

### 4.2 client_contacts

Purpose:
Named contacts for a customer.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| client_id | uuid | NN, FK clients.id | — |
| full_name | text | NN | — |
| email | text | Nullable | — |
| phone | text | Nullable | — |
| job_title | text | Nullable | — |
| is_primary | boolean | NN | false |

Rules:
- Permit shared phone/email when legitimate.
- At most one active primary contact per client under this proposal.
- A contact does not automatically have external approval authority.
- Cross-client contact substitution must be rejected.

### 4.3 client_addresses

Purpose:
Multiple shared customer addresses.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| client_id | uuid | NN, FK clients.id | — |
| label | text | NN | — |
| address_line_1 | text | NN | — |
| address_line_2 | text | Nullable | — |
| locality | text | Nullable | — |
| city | text | NN | — |
| emirate_or_region | text | Nullable | — |
| country_code | text | NN | 'AE' |
| postal_code | text | Nullable | — |

Rules:
- Project/site address snapshots may differ from shared client addresses.
- Updating a client address must not rewrite issued-document address snapshots.
- Country/address validation must not invent a mandatory UAE postal code.

## 5. Sales configuration

### 5.1 lead_sources

Purpose:
Controlled lead-source attribution.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| description | text | Nullable | — |

Rules:
- Historical source references survive archival.
- External source IDs belong in integration provenance, not secret fields.

### 5.2 sales_pipelines

Purpose:
Configurable sales stage collections.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| is_default | boolean | NN | false |

Rules:
- At most one active default pipeline.
- Do not delete a pipeline referenced by historical opportunities.

### 5.3 sales_pipeline_stages

Purpose:
Ordered working stages within a pipeline.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| pipeline_id | uuid | NN, FK sales_pipelines.id | — |
| code | text | NN | — |
| name | text | NN | — |
| sort_order | integer | NN | — |

Uniqueness:
(pipeline_id, code).

Rules:
- Stage ordering is configurable.
- Protected Won/Lost outcomes are not ordinary stage labels.
- Changing stage configuration must preserve history and valid references.

### 5.4 lost_reasons

Purpose:
Configured reasons for Lost outcomes.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| description | text | Nullable | — |

Rules:
A Lost operation requires an active eligible reason.
Historical outcomes retain their reason reference after archival.

## 6. Sales records

### 6.1 leads

Purpose:
Incoming inquiry and source information.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| lead_number | text | NN, UQ | — |
| source_id | uuid | NN, FK lead_sources.id | — |
| assigned_sales_id | uuid | Nullable, FK employees.id | — |
| matched_client_id | uuid | Nullable, FK clients.id | — |
| contact_name | text | NN | — |
| contact_email | text | Nullable | — |
| contact_phone | text | Nullable | — |
| inquiry_summary | text | Nullable | — |
| property_type | text | Nullable | — |
| location_summary | text | Nullable | — |
| budget_estimate | numeric(18,2) | Nullable | — |
| qualification_status | text | NN | 'unreviewed' |

Proposed qualification labels:
unreviewed, reviewing, qualified, not_qualified.

Rules:
- Contact requirements and qualification transitions require business confirmation.
- Phone/email are not automatically unique.
- Budget must be nonnegative if provided.
- Customer matching must use the approved review policy.
- External ingestion provenance will be defined in the platform dictionary.

### 6.2 opportunities

Purpose:
One potential project/deal.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| opportunity_number | text | NN, UQ | — |
| originating_lead_id | uuid | Nullable, FK leads.id | — |
| client_id | uuid | Nullable, FK clients.id | — |
| title | text | NN | — |
| assigned_sales_id | uuid | NN, FK employees.id | — |
| pipeline_id | uuid | NN, FK sales_pipelines.id | — |
| stage_id | uuid | NN, FK sales_pipeline_stages.id | — |
| outcome | text | NN | 'open' |
| lost_reason_id | uuid | Nullable, FK lost_reasons.id | — |
| outcome_notes | text | Nullable | — |
| outcome_at | timestamptz | Nullable | — |
| expected_close_date | date | Nullable | — |
| estimated_value | numeric(18,2) | Nullable | — |

Protected outcomes:
open, won, lost.

Rules:
- stage_id must belong to pipeline_id.
- Require a valid inquiry/customer basis under the final creation policy.
- Lost requires a valid reason and outcome timestamp.
- Open must not carry a current Lost reason.
- Won is changed only through controlled conversion.
- Accepted quotation and resulting project relationships are enforced
  through the conversion/project records.
- No public generic update may bypass conversion.
- Reopening/correction policy remains open.

### 6.3 opportunity_requirements

Purpose:
Structured opportunity-level requirements.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| opportunity_id | uuid | NN, FK opportunities.id, UQ | — |
| project_type | text | Nullable | — |
| property_type | text | Nullable | — |
| location_description | text | Nullable | — |
| estimated_area | numeric(18,4) | Nullable | — |
| area_unit_code | text | Nullable | — |
| style_preferences | text | Nullable | — |
| material_preferences | text | Nullable | — |
| furniture_preferences | text | Nullable | — |
| color_preferences | text | Nullable | — |
| budget_estimate | numeric(18,2) | Nullable | — |
| desired_start_date | date | Nullable | — |
| desired_completion_date | date | Nullable | — |
| special_instructions | text | Nullable | — |
| completion_state | text | NN | 'in_progress' |

Rules:
- Partial collection is allowed.
- Area and unit must be provided consistently.
- Start/completion ordering must be valid when both exist.
- Final unit catalogue and completion rules remain open.
- Edits require history/audit, defined in the platform design.

### 6.4 opportunity_rooms

Purpose:
Room/space-specific requirements.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| opportunity_id | uuid | NN, FK opportunities.id | — |
| name | text | NN | — |
| room_type | text | Nullable | — |
| sort_order | integer | NN | 0 |
| estimated_area | numeric(18,4) | Nullable | — |
| area_unit_code | text | Nullable | — |
| requirements_notes | text | Nullable | — |
| measurement_notes | text | Nullable | — |
| deliverables_notes | text | Nullable | — |

Rules:
- Room references must remain within the same opportunity.
- Measurements are not automatically verified technical facts.
- Repeated room names may be legitimate; use IDs for identity.

## 7. Quotations

### 7.1 quotations

Purpose:
Stable quotation identity across versions.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| quotation_number | text | NN, UQ | — |
| opportunity_id | uuid | NN, FK opportunities.id | — |
| title | text | NN | — |

Rules:
- A quotation has versions; it is not itself the version content.
- Do not store mutable current totals as the only financial evidence.
- Numbering is generated through a controlled numbering mechanism.
- Archive must not erase sent/accepted history.

### 7.2 quotation_versions

Purpose:
Commercial content for one identifiable version.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| quotation_id | uuid | NN, FK quotations.id | — |
| version_number | integer | NN | — |
| preparation_state | text | NN | 'draft' |
| currency_code | text | NN | 'AED' |
| customer_name_snapshot | text | NN | — |
| customer_address_snapshot | text | Nullable | — |
| customer_tax_number_snapshot | text | Nullable | — |
| scope_summary | text | Nullable | — |
| terms_text | text | Nullable | — |
| valid_until | date | Nullable | — |
| subtotal_amount | numeric(18,2) | NN | 0 |
| discount_amount | numeric(18,2) | NN | 0 |
| tax_amount | numeric(18,2) | NN | 0 |
| total_amount | numeric(18,2) | NN | 0 |
| calculation_policy_snapshot | jsonb | NN | — |
| submitted_at | timestamptz | Nullable | — |
| submitted_by | uuid | Nullable, FK employees.id | — |

Uniqueness:
(quotation_id, version_number).

Proposed preparation states:
draft, submitted, withdrawn.

Rules:
- Positive version_number.
- AED only initially.
- Snapshot schema must be validated and contain no secrets.
- No external sending from draft/unapproved content.
- Submitted content/items are frozen.
- Editing rejected/submitted commercial content creates a new version.
- Approval, acceptance and delivery are separate records.
- Totals are calculated by the controlled server/database operation.
- Final financial formula and rounding policy remain open.

### 7.3 quotation_version_items

Purpose:
Room-wise commercial lines for a version.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| quotation_version_id | uuid | NN, FK quotation_versions.id | — |
| opportunity_room_id | uuid | Nullable, FK opportunity_rooms.id | — |
| line_number | integer | NN | — |
| item_type | text | NN | — |
| description | text | NN | — |
| quantity | numeric(18,4) | NN | — |
| unit_code | text | NN | — |
| unit_price | numeric(18,6) | NN | — |
| discount_amount | numeric(18,2) | NN | 0 |
| tax_rate | numeric(9,6) | Nullable | — |
| tax_amount | numeric(18,2) | NN | 0 |
| line_total_amount | numeric(18,2) | NN | — |

Uniqueness:
(quotation_version_id, line_number).

Proposed item types:
material, service.

Rules:
- Room must belong to the quotation's opportunity.
- Unit is a controlled catalogue reference in the completed design.
- Quantity/price/discount/tax rules follow approved policy.
- Do not hardcode a tax rate.
- Frozen version lines cannot be edited or deleted through ordinary updates.

### 7.4 quotation_payment_milestones

Purpose:
Version-specific proposed payment schedule.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| quotation_version_id | uuid | NN, FK quotation_versions.id | — |
| sequence_number | integer | NN | — |
| title | text | NN | — |
| trigger_description | text | NN | — |
| amount | numeric(18,2) | NN | — |
| due_date | date | Nullable | — |

Uniqueness:
(quotation_version_id, sequence_number).

Rules:
- Amount-based storage avoids silently mixing percentage and amount modes.
- A percentage-based editor may be added only with approved calculation rules.
- Final schedule reconciliation rules need confirmation.
- Milestones are not invoices or proof of received payment.
- Frozen schedules follow version immutability.

### 7.5 quotation_approval_decisions

Purpose:
Append-only PM decisions against exact versions.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| quotation_version_id | uuid | NN, FK quotation_versions.id | — |
| decision | text | NN | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decided_at | timestamptz | NN | now() |
| reason | text | Nullable | — |

Proposed decisions:
approved, rejected.

Rules:
- Reviewer must be an eligible authorized PM.
- Self-approval is permitted.
- Do not use an arbitrary latest timestamp to resolve conflicting decisions.
- Decision supersession/revocation, if allowed, needs an explicit operation.
- Review state must be serialized against version changes.
- Audit and decision evidence remain append-only.

### 7.6 quotation_client_acceptances

Purpose:
Attributable acceptance of an exact approved version.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| quotation_version_id | uuid | NN, FK quotation_versions.id | — |
| client_contact_id | uuid | Nullable, FK client_contacts.id | — |
| accepting_person_name | text | NN | — |
| accepting_person_contact_snapshot | text | NN | — |
| acceptance_method | text | NN | — |
| accepted_at | timestamptz | NN | — |
| recorded_by | uuid | NN, FK employees.id | — |
| recorded_at | timestamptz | NN | now() |
| evidence_summary | text | NN | — |

Rules:
- Final evidence methods are not approved yet.
- Acceptance must reference an eligible PM-approved version.
- Existing contact references must match the relevant client.
- Prospect acceptance may precede creation of the client record.
- Attached evidence uses explicit file links delivered in the storage schema.
- Revocation/correction cannot silently overwrite this record.
- Existence of a row is not sufficient unless the controlled operation
  validated the approved evidence policy.

### 7.7 quotation_sends

Purpose:
Authorized external sending intent for a specific version.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| quotation_version_id | uuid | NN, FK quotation_versions.id | — |
| requested_by | uuid | NN, FK employees.id | — |
| requested_at | timestamptz | NN | now() |
| channel | text | NN | — |
| recipient_snapshot | text | NN | — |
| send_status | text | NN | 'pending' |
| idempotency_key | uuid | NN, UQ | — |

Proposed statuses:
pending, dispatched, failed.

Rules:
- Creation requires current send authority and eligible PM approval.
- Delivery attempts belong in the platform delivery schema.
- Dispatch is not proof the person read the quotation.
- Manual contact actions must not falsely claim verified automated delivery.
- Provider secrets do not belong in this table.

## 8. Projects and conversion

### 8.1 projects

Purpose:
Confirmed work created through controlled Won conversion.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_number | text | NN, UQ | — |
| name | text | NN | — |
| client_id | uuid | NN, FK clients.id | — |
| originating_opportunity_id | uuid | NN, FK opportunities.id, UQ | — |
| accepted_quotation_version_id | uuid | NN, FK quotation_versions.id | — |
| quotation_acceptance_id | uuid | NN, FK quotation_client_acceptances.id | — |
| project_manager_id | uuid | NN, FK employees.id | — |
| operational_status | text | NN | 'planned' |
| start_date | date | Nullable | — |
| target_completion_date | date | Nullable | — |
| site_address_snapshot | text | Nullable | — |
| scope_summary_snapshot | text | NN | — |
| closed_at | timestamptz | Nullable | — |
| closed_by | uuid | Nullable, FK employees.id | — |

Proposed operational labels:
planned, active, on_hold, completed, closed.

Rules:
- Unique originating opportunity prevents duplicate converted projects.
- Accepted version must belong to the originating opportunity.
- Acceptance must reference that same version.
- Client relationship must agree with conversion.
- Selected PM must be eligible at conversion.
- Payment and handover completion are not prerequisites.
- Scope changes do not overwrite accepted commercial history.
- Closure and reopening gates remain open.
- No unrestricted manual project-creation route is authorized by this design.

### 8.2 project_members

Purpose:
Explicit project participation.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| employee_id | uuid | NN, FK employees.id | — |
| assigned_at | timestamptz | NN | now() |
| assigned_by | uuid | NN, FK employees.id | — |

Primary key:
(project_id, employee_id).

Rules:
- Membership is not itself a role or general finance grant.
- PM ownership and membership consistency are enforced by controlled operations.
- Removal revokes applicable subsequent access but preserves audit history.
- Inactive employees cannot gain new active assignments.

### 8.3 opportunity_conversions

Purpose:
Durable identity and provenance for successful Won conversion.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| opportunity_id | uuid | NN, FK opportunities.id, UQ | — |
| project_id | uuid | NN, FK projects.id, UQ | — |
| converted_by | uuid | NN, FK employees.id | — |
| converted_at | timestamptz | NN | now() |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Project/opportunity pair must agree with projects.originating_opportunity_id.
- Required conversion records commit consistently.
- The same opportunity cannot convert into a second project under another key.
- Retry after uncertain response must return the existing authorized result.
- Background notification failure does not roll back committed conversion.
- Idempotency-key reuse with different input must be rejected.

## 9. Relationships enforced beyond simple foreign keys

The constraints/transaction documents must specify:

- Pipeline/stage consistency.
- Opportunity-room/quotation consistency.
- Client/contact consistency.
- Quotation/opportunity/project consistency.
- Acceptance/exact-version consistency.
- Current eligible PM approval at sending and conversion.
- PM eligibility and membership.
- Atomic opportunity outcome/project/conversion updates.
- Frozen quotation content.
- Authoritative totals and actor fields.
- Current authorization and archive-state checks.

A comment in a dictionary is not an implemented constraint.

## 10. Explicit remaining coverage

Subsequent dictionary deliveries must include:
- Invitations and assignment/history support.
- Client notes and communication relationships.
- Requirements checklist/history and reference files.
- Follow-ups, activities, visits and import records.
- Project scheduling, dependencies, scope changes and handover.
- Design packages, revisions, review access and releases.
- Site reports, inspections, snags and material requests.
- Procurement and stock.
- Finance.
- AI.
- Files, audit, notifications, settings and integration/jobs.

None of these is treated as complete by this core dictionary.

## 11. Review and validation status

Delivered:
A proposed core physical dictionary.

Not delivered here:
Final constraints/indexes, SQL migrations, RLS, storage policies,
complete supporting schema or automated schema validation.

Not executed:
Database creation, migrations, application tests or provider verification.

Review required:
Business assumptions, exact decimal policies, status transitions,
acceptance evidence and the complete architecture before implementation.