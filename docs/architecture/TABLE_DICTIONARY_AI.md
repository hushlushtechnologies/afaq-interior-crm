# Afaq Al Manzel Interiors CRM — AI Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed physical design

## 1. Scope

Defines:
- Provider/model configuration.
- Prompt presets.
- Generation jobs and source files.
- External-processing authorization.
- Generated assets.
- Usage reservations and cost evidence.
- Sharing decisions.

Uses DATABASE_CONVENTIONS.md version 0.2.

No provider, model, service plan or API credential is selected here.

OpenAI remains the preferred initial provider, subject to capability,
pricing, privacy and processing approval.

Initial operating budget:
AED 50 per month.

Approximately 50 images per month remains a target, not a guarantee.

## 2. AI configuration

### 2.1 ai_provider_configurations

Purpose:
Approved capability/pricing configuration for an integration.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| integration_connection_id | uuid | NN, FK integration_connections.id | — |
| configuration_code | text | NN, UQ | — |
| model_identifier | text | NN | — |
| supported_operations | jsonb | NN | — |
| parameter_schema | jsonb | NN | — |
| pricing_snapshot | jsonb | NN | — |
| pricing_checked_at | timestamptz | NN | — |
| is_enabled | boolean | NN | false |

Rules:
- Verify model availability and supported generation/edit operations.
- Validate parameters against a controlled schema.
- Pricing evidence records source, billing units and relevant settings.
- AED budget conversion, where needed, uses an approved documented basis.
- No credentials or arbitrary provider endpoints.
- Changed capabilities/pricing must not rewrite historical job snapshots.
- Enabling requires approved external processing and cost controls.

### 2.2 ai_prompt_presets

Purpose:
Reusable room/style/material prompt inputs.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| room_type | text | Nullable | — |
| style_name | text | Nullable | — |
| prompt_template | text | NN | — |
| default_parameters | jsonb | NN | — |

Rules:
- Parameters are validated for the selected provider configuration.
- Prompt templates cannot execute code.
- Presets must not embed private customer data or credentials.
- Jobs preserve their resolved prompt/parameter snapshot.

## 3. Input processing authorization

### 3.1 external_processing_authorizations

Purpose:
Record authorization to send an identified private asset to an identified
external processing connection.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| integration_connection_id | uuid | NN, FK integration_connections.id | — |
| lead_id | uuid | Nullable, FK leads.id | — |
| opportunity_id | uuid | Nullable, FK opportunities.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| processing_purpose | text | NN | — |
| authorization_basis_summary | text | NN | — |
| evidence_file_asset_id | uuid | Nullable, FK file_assets.id | — |
| authorized_by | uuid | NN, FK employees.id | — |
| authorized_at | timestamptz | NN | now() |
| expires_at | timestamptz | Nullable | — |
| revoked_at | timestamptz | Nullable | — |

Rules:
- Exactly one business context.
- File must belong to an accessible compatible context.
- Connection and purpose must match the actual processing.
- Authorization requires the approved policy and eligible authority.
- An employee checkbox does not by itself prove valid customer consent.
- Expiry/revocation is checked immediately before provider submission.
- Stored evidence is private.
- Provider-level processing approval is also required.
- This does not authorize external sharing of the output.
- Text prompts containing customer information also require applicable
  privacy controls; file authorization is not a universal privacy exemption.

## 4. Generation work

### 4.1 ai_generation_jobs

Purpose:
Domain-specific generation request linked to durable execution.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| background_job_id | uuid | NN, FK background_jobs.id, UQ | — |
| provider_configuration_id | uuid | NN, FK ai_provider_configurations.id | — |
| lead_id | uuid | Nullable, FK leads.id | — |
| opportunity_id | uuid | Nullable, FK opportunities.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| design_revision_id | uuid | Nullable, FK design_revisions.id | — |
| requested_by | uuid | NN, FK employees.id | — |
| requested_at | timestamptz | NN | now() |
| operation_kind | text | NN | — |
| resolved_prompt | text | NN | — |
| parameters_snapshot | jsonb | NN | — |
| pricing_snapshot | jsonb | NN | — |
| requested_output_count | integer | NN | — |
| provider_request_reference | text | Nullable | — |
| safe_failure_code | text | Nullable | — |

Rules:
- Exactly one primary lead/opportunity/project/design-revision context.
- Resolve design revision access through its project.
- Requested output count is positive and supported.
- Validate role permission, business context, processing approval and budget.
- Generation outcome follows the linked durable job.
- Provider reference is non-secret.
- Protect private prompt content; do not copy it into ordinary job logs.
- Do not allow an AI worker to edit frozen design content.
- Result linking is separate from approved design release.
- Retry after unknown provider outcome requires reconciliation.

### 4.2 ai_generation_inputs

Purpose:
Exact private files used in a generation request.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| generation_job_id | uuid | NN, FK ai_generation_jobs.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| processing_authorization_id | uuid | NN, FK external_processing_authorizations.id | — |
| input_role | text | NN | — |
| sort_order | integer | NN | 0 |

Primary key:
(generation_job_id, file_asset_id).

Proposed roles:
room_photo, reference_image, edit_source, supported_mask.

Rules:
- Provider must support the input role and file type.
- Authorization matches file, connection, purpose and business context.
- Source file is ready, immutable and accessible.
- Input authorization is rechecked at dispatch.
- Customer photo processing is not authorized by generation permission alone.

## 5. Results

### 5.1 ai_generation_assets

Purpose:
Private output assets with generation provenance.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| generation_job_id | uuid | NN, FK ai_generation_jobs.id | — |
| file_asset_id | uuid | NN, FK file_assets.id, UQ | — |
| output_number | integer | NN | — |
| provider_asset_reference | text | Nullable | — |
| generated_at | timestamptz | Nullable | — |
| stored_at | timestamptz | NN | now() |
| caption | text | Nullable | — |

Uniqueness:
(generation_job_id, output_number).

Rules:
- Store only validated supported outputs.
- Partial success is represented accurately.
- Provider output reference is not exposed as a permanent public URL.
- Private output storage must satisfy the approved UAE policy.
- Design/project/opportunity links use explicit authorized relationships.
- A generated concept is not a construction-ready drawing.
- Output existence is not external-sharing approval.

## 6. Usage policy

### 6.1 ai_usage_policies

Purpose:
Approved company and optional employee usage limits.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| policy_code | text | NN, UQ | — |
| employee_id | uuid | Nullable, FK employees.id | — |
| monthly_budget_aed | numeric(18,2) | NN | — |
| monthly_output_limit | integer | Nullable | — |
| effective_from | date | NN | — |
| effective_until | date | Nullable | — |
| is_enabled | boolean | NN | true |

Rules:
- Null employee means an explicitly configured company-level policy.
- Company budget applies even when employee policies also exist.
- Employee limits do not multiply the company budget.
- Prevent overlapping effective policies for the same intended scope.
- Budget is nonnegative; output limit is positive where supplied.
- Approximately 50 images is not automatically configured as an entitlement.
- Budget changes require explicit configuration authority and audit.
- Billing period uses the approved business timezone.

### 6.2 ai_usage_reservations

Purpose:
Reserve allowed budget capacity before a potentially billable submission.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| generation_job_id | uuid | NN, FK ai_generation_jobs.id | — |
| usage_policy_id | uuid | NN, FK ai_usage_policies.id | — |
| period_start | date | NN | — |
| reserved_amount_aed | numeric(18,2) | NN | — |
| reserved_output_count | integer | NN | — |
| reservation_state | text | NN | 'held' |
| created_at | timestamptz | NN | now() |
| reconciled_at | timestamptz | Nullable | — |

Uniqueness:
(generation_job_id, usage_policy_id).

Proposed states:
held, reconciled, released.

Rules:
- One job may reserve against both company and employee policies.
- These are overlapping limit checks, not two actual charges.
- Admission is atomic against relevant policy/period capacity.
- Reserve a justified supported upper bound for the selected operation.
- If a reliable bound cannot be established, apply approved conservative
  handling or block submission; do not claim an enforceable cap without one.
- Provider timeout does not prove no charge occurred.
- Unknown billable outcome keeps appropriate capacity reserved.
- Reservation expiry cannot automatically erase uncertain external cost.

### 6.3 ai_generation_usage

Purpose:
Append-only provider usage and cost evidence.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| generation_job_id | uuid | NN, FK ai_generation_jobs.id | — |
| job_attempt_id | uuid | Nullable, FK background_job_attempts.id | — |
| usage_event_key | text | NN, UQ | — |
| event_kind | text | NN | — |
| output_count_delta | integer | NN | 0 |
| provider_currency_code | text | Nullable | — |
| provider_amount_delta | numeric(18,6) | Nullable | — |
| amount_aed_delta | numeric(18,6) | Nullable | — |
| cost_evidence_state | text | NN | — |
| conversion_basis_snapshot | jsonb | Nullable | — |
| recorded_at | timestamptz | NN | now() |
| recording_execution_id | uuid | NN, FK operation_executions.id | — |

Proposed event kinds:
output_recorded, charge_recorded, charge_adjustment, provider_refund.

Proposed evidence states:
estimated, confirmed, unresolved.

Rules:
- Unknown cost is not zero.
- Avoid counting estimates and confirmed replacement charges as two costs.
- Settlement/replacement relationships need explicit reconciliation rules.
- Preserve provider billing evidence and approved AED conversion basis.
- Output count and charge events are distinct.
- Retry charges are recorded when incurred, even if no successful image results.
- Ledger deduplication key must follow real provider/local event semantics.
- CRM-wide foreign exchange accounting is not implied.

## 7. External sharing

### 7.1 ai_sharing_decisions

Purpose:
Record approval/rejection of a particular generated asset for external sharing.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| generation_asset_id | uuid | NN, FK ai_generation_assets.id | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decision | text | NN | — |
| intended_purpose | text | NN | — |
| reason | text | Nullable | — |
| decided_at | timestamptz | NN | now() |
| idempotency_key | uuid | NN, UQ | — |

Proposed decisions:
approved, rejected.

Rules:
- Eligible sharing approver remains an open business decision.
- Generate permission does not confer sharing approval.
- Effective-decision/revocation rules must be explicit.
- Approval applies to the identified asset and permitted purpose.
- A later asset does not inherit approval.
- Client quotation/design submission flows must check applicable sharing
  approval before including AI assets.
- Approval does not make the private object permanently public.

## 8. Required cross-domain controls

Before implementation, specify:
- Actual model capabilities and current pricing.
- UAE storage/provider external-processing approval.
- Validated source authorization.
- Atomic budget admission.
- Retry and provider-uncertainty handling.
- Usage estimate-to-confirmed reconciliation.
- Per-user/company overlapping limits.
- Exact asset provenance.
- Approval before external disclosure.
- Private file authorization.
- Safe job diagnostics.
- Request cancellation versus actual provider cancellation.
- Retention of source photos, prompts and generated results.

## 9. Open architecture details

Not selected:
- Model.
- Provider execution region.
- Exact price/rate evidence.
- AED conversion policy for provider billing.
- Sharing approver.
- Authorization evidence policy.
- Retention periods.
- Final usage reconciliation source relationships.
- Budget-period boundary behavior for long-running jobs.

These need concrete resolution before claiming AI cost controls are complete.

## 10. Current status

Delivered:
Proposed AI configuration, input authorization, generation, asset,
usage and sharing records.

Not implemented:
API calls, image generation, budget enforcement, provider accounts,
workers or storage.

No API charges, migrations or software tests have occurred.