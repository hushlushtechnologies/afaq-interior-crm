# Afaq Al Manzel Interiors CRM — Platform Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed physical design

## 1. Scope and conventions

Defines:
- Service identities and delegated execution.
- Private file metadata and typed document links.
- Audit history.
- Durable jobs.
- Integration connections/events.
- Notifications and delivery attempts.
- Settings and saved views.

Use DATABASE_CONVENTIONS.md version 0.2.

Default — means no database default.

No services, tables or jobs are created by this document.

## 2. Service identities and authority

### 2.1 service_principals

Purpose:
Identify an actual application worker/integration executor without
creating a fake employee.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| service_kind | text | NN | — |
| is_active | boolean | NN | true |

Proposed kinds:
integration_worker, scheduled_worker, ai_worker, delivery_worker.

Rules:
- This is application identity metadata, not a credential store.
- Provision service authentication through supported secure configuration.
- A service identity does not itself grant business authority.
- No unrestricted browser access.

### 2.2 automation_delegations

Purpose:
Define explicit bounded authority for automated operations.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| service_principal_id | uuid | NN, FK service_principals.id | — |
| accountable_employee_id | uuid | NN, FK employees.id | — |
| permission_id | uuid | NN, FK permissions.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| integration_connection_id | uuid | Nullable, FK integration_connections.id | — |
| scope_definition | jsonb | NN | — |
| valid_from | timestamptz | NN | — |
| expires_at | timestamptz | Nullable | — |
| revoked_at | timestamptz | Nullable | — |

Rules:
- Scope uses an operation-specific validated allowlist schema.
- No arbitrary SQL, route, role or destination expressions.
- Null project does not automatically mean organization-wide authority.
- Sponsor must currently possess the delegated action/scope.
- Revocation, deactivation and expiry are checked before execution.
- Human-only approvals cannot be delegated to a worker through this table.
- Connection-specific authority cannot be reused for another connection.
- Delegation creation/revocation requires permission and audit.

### 2.3 operation_executions

Purpose:
Identify the actual executor and accountable authority.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| operation_code | text | NN | — |
| executing_employee_id | uuid | Nullable, FK employees.id | — |
| executing_service_principal_id | uuid | Nullable, FK service_principals.id | — |
| accountable_employee_id | uuid | Nullable, FK employees.id | — |
| delegation_id | uuid | Nullable, FK automation_delegations.id | — |
| request_correlation_id | uuid | NN | — |
| started_at | timestamptz | NN | now() |
| finished_at | timestamptz | Nullable | — |
| execution_status | text | NN | 'started' |
| safe_error_code | text | Nullable | — |

Proposed states:
started, succeeded, failed, denied.

Rules:
- Exactly one actual executor type.
- Direct human operation has the appropriate accountable employee.
- Automated business writes require eligible delegation and accountability.
- Untrusted webhook receipt may be staged without an accountable employee;
  that does not authorize downstream business writes.
- Execution creation is trusted server work.
- Authorization is rechecked at the relevant commit boundary.
- Correlation IDs are not authorization tokens.
- A failed database transaction must not falsely record business success.
- Failed/denied telemetry may require a separate durable write boundary.

## 3. Private files

### 3.1 file_assets

Purpose:
Describe immutable private storage objects.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| storage_provider_code | text | NN | — |
| bucket_name | text | NN | — |
| object_key | text | NN | — |
| original_filename | text | NN | — |
| media_type | text | NN | — |
| byte_size | bigint | NN | — |
| sha256_digest | text | Nullable | — |
| asset_state | text | NN | 'pending_upload' |
| uploaded_execution_id | uuid | NN, FK operation_executions.id | — |
| created_at | timestamptz | NN | now() |
| verified_at | timestamptz | Nullable | — |
| storage_region_code | text | NN | — |

Uniqueness:
(storage_provider_code, bucket_name, object_key).

Proposed states:
pending_upload, validating, ready, quarantined, rejected,
deletion_requested, deleted.

Rules:
- Nonnegative validated size; enforce approved upload limits.
- Detect actual supported file type; do not trust extension alone.
- Digest format is validated where present.
- Exact integrity requirements depend on file/document use.
- Immutable object identity after verification.
- Approved content cannot be replaced behind the same key.
- Business links grant contextual access; there is no generic public URL.
- Files are usable only in eligible ready state.
- Core private storage must use verified UAE locations.
- Deletion must respect business references, retention and authorization.
- Quarantine capability and malware controls require provider verification.

### 3.2 quotation_documents

Purpose:
Link generated PDFs to exact quotation versions.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| quotation_version_id | uuid | NN, FK quotation_versions.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| document_role | text | NN | — |
| template_version | text | NN | — |
| source_content_digest | text | NN | — |
| generated_execution_id | uuid | NN, FK operation_executions.id | — |
| generated_at | timestamptz | NN | now() |

Proposed roles:
internal_preview, customer_document.

Rules:
- Internal preview is not permission to send.
- Customer sending still requires exact-version approval.
- Generated bytes must correspond to the recorded source snapshot.
- Regeneration cannot alter approved commercial content silently.

### 3.3 client_files

Purpose:
Explicit private document links for client profiles.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| client_id | uuid | NN, FK clients.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| title | text | NN | — |
| linked_execution_id | uuid | NN, FK operation_executions.id | — |
| linked_at | timestamptz | NN | now() |

Primary key:
(client_id, file_asset_id).

Rules:
- Client visibility does not imply unrestricted Finance visibility.
- An external design reviewer cannot browse these links.
- Validate both source file and destination relationship.

### 3.4 finance_file_links

Purpose:
Explicit supporting/generated file links for Finance contexts not
already covered by dedicated evidence relationships.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| budget_version_id | uuid | Nullable, FK project_budget_versions.id | — |
| invoice_version_id | uuid | Nullable, FK customer_invoice_versions.id | — |
| credit_note_id | uuid | Nullable, FK customer_credit_notes.id | — |
| refund_id | uuid | Nullable, FK customer_refunds.id | — |
| expense_id | uuid | Nullable, FK project_expenses.id | — |
| expense_correction_id | uuid | Nullable, FK project_expense_corrections.id | — |
| cost_reconciliation_id | uuid | Nullable, FK project_cost_entry_reconciliations.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| document_role | text | NN | — |
| linked_execution_id | uuid | NN, FK operation_executions.id | — |
| linked_at | timestamptz | NN | now() |

Rules:
- Exactly one parent context.
- Prevent duplicate equivalent links.
- Dedicated customer_payment_evidence remains the receipt-evidence path.
- Supplier source files retain their specific typed references.
- document_role is validated for the selected context.
- Issued/generated documents preserve source snapshot identity.
- Shared source evidence must not expose another project's amounts.
- Required document-generation metadata must accompany authoritative PDFs;
  final document manifest constraints belong to storage/transaction design.

## 4. Audit history

### 4.1 audit_events

Purpose:
Append-only critical security and business evidence.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| execution_id | uuid | NN, FK operation_executions.id | — |
| event_code | text | NN | — |
| entity_type | text | NN | — |
| entity_id | uuid | Nullable | — |
| project_id | uuid | Nullable, FK projects.id | — |
| outcome | text | NN | — |
| safe_change_summary | jsonb | NN | — |
| occurred_at | timestamptz | NN | now() |

Rules:
- Entity types/codes use a controlled registry.
- Target ID is an audit reference, not permission to read the target.
- No raw tokens, credentials, OTPs or unrestricted payload dumps.
- Sensitive before/after content is minimized and access-controlled.
- Business success audit required by a transaction commits with it.
- Security failure evidence has a separately reliable logging path.
- Ordinary users cannot edit/delete audit history.
- Retention and legal deletion remain subject to approved policy.
- Audit export requires separate authorization.

## 5. Durable jobs

### 5.1 background_jobs

Purpose:
Persist asynchronous work independently of a live web request.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| job_kind | text | NN | — |
| requested_execution_id | uuid | NN, FK operation_executions.id | — |
| delegation_id | uuid | Nullable, FK automation_delegations.id | — |
| job_status | text | NN | 'queued' |
| available_at | timestamptz | NN | now() |
| attempt_limit | integer | NN | — |
| lease_owner | text | Nullable | — |
| lease_expires_at | timestamptz | Nullable | — |
| created_at | timestamptz | NN | now() |
| finished_at | timestamptz | Nullable | — |
| safe_error_code | text | Nullable | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
queued, running, retry_wait, succeeded, failed, cancelled, outcome_unknown.

Rules:
- Domain tables contain typed payload/context references.
- No arbitrary executable commands or unvalidated provider URLs.
- Atomic worker claim with bounded lease and recovery.
- Recheck delegation, permission and current business prerequisites.
- Retry policy is job-specific.
- A timeout does not prove an external action failed.
- outcome_unknown prevents blind repeat of potentially billable/irreversible work.
- A lease alone does not guarantee exactly-once external effects.
- Use provider idempotency where supported and local reconciliation.

### 5.2 background_job_attempts

Purpose:
Record each actual worker attempt.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| job_id | uuid | NN, FK background_jobs.id | — |
| attempt_number | integer | NN | — |
| execution_id | uuid | NN, FK operation_executions.id | — |
| started_at | timestamptz | NN | now() |
| finished_at | timestamptz | Nullable | — |
| outcome | text | Nullable | — |
| safe_error_code | text | Nullable | — |
| provider_request_reference | text | Nullable | — |

Uniqueness:
(job_id, attempt_number).

Rules:
- Positive attempt number.
- Provider reference is a non-secret identifier.
- Do not log request authorization headers or private payload contents.
- Attempts preserve provider ambiguity and terminal outcomes accurately.

## 6. Integrations

### 6.1 integration_connections

Purpose:
Approved non-secret provider configuration and account scope.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| provider_kind | text | NN | — |
| display_name | text | NN | — |
| external_account_reference | text | Nullable | — |
| configuration | jsonb | NN | — |
| credential_binding_name | text | Nullable | — |
| connection_state | text | NN | 'disabled' |
| processing_approval_state | text | NN | 'pending' |

Rules:
- Store credential binding names, never credential values.
- Validate allowed account/form/destination configuration.
- Fixed server adapters control destinations.
- Enabling requires applicable processing/cost approval.
- Metadata claiming a region is not evidence of provider compatibility.
- Revocation prevents subsequent eligible work.
- Meta, AI and email use separate configured connections.

### 6.2 integration_events

Purpose:
Stage validated or rejected external event observations safely.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| connection_id | uuid | NN, FK integration_connections.id | — |
| provider_event_key | text | NN | — |
| event_kind | text | NN | — |
| received_at | timestamptz | NN | now() |
| receiving_execution_id | uuid | NN, FK operation_executions.id | — |
| verification_outcome | text | NN | — |
| safe_event_metadata | jsonb | NN | — |
| event_status | text | NN | 'staged' |
| resulting_lead_id | uuid | Nullable, FK leads.id | — |
| processing_job_id | uuid | Nullable, FK background_jobs.id | — |

Uniqueness:
(connection_id, provider_event_key).

Rules:
- Stable event-key construction must follow provider semantics.
- Invalid signatures cannot authorize business processing.
- Bounded metadata only; no token/header dumps.
- Private payload retention requires explicit policy.
- Valid authority/delegation is required before core business writes.
- Repeated events do not create duplicate leads.
- Lead and event provenance remain linked.
- Manual lead entry must work when integration is disabled.

## 7. In-app notifications

### 7.1 notifications

Purpose:
Employee-specific actionable notices.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| recipient_employee_id | uuid | NN, FK employees.id | — |
| notification_code | text | NN | — |
| opportunity_id | uuid | Nullable, FK opportunities.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| follow_up_id | uuid | Nullable, FK follow_ups.id | — |
| design_review_round_id | uuid | Nullable, FK design_review_rounds.id | — |
| integration_event_id | uuid | Nullable, FK integration_events.id | — |
| safe_title | text | NN | — |
| safe_body | text | Nullable | — |
| created_at | timestamptz | NN | now() |
| read_at | timestamptz | Nullable | — |
| source_execution_id | uuid | NN, FK operation_executions.id | — |
| deduplication_key | text | NN, UQ | — |

Rules:
- Exactly one typed context in this initial proposal.
- Codes/templates determine the permitted context.
- Detailed child references may be resolved through authorized project/context
  operations; do not encode arbitrary external URLs as navigation authority.
- Notification text minimizes sensitive content.
- Access to linked details is checked at opening time.
- Historical notification text must not defeat revoked access.
- Users may mark only their own notifications read.
- Do not use employee notifications for external client access.

## 8. External delivery

### 8.1 message_deliveries

Purpose:
Record a specific permitted communication intent.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| notification_id | uuid | Nullable, FK notifications.id | — |
| quotation_send_id | uuid | Nullable, FK quotation_sends.id | — |
| design_review_grant_id | uuid | Nullable, FK design_review_grants.id | — |
| purchase_order_issue_id | uuid | Nullable, FK purchase_order_issues.id | — |
| invoice_issue_id | uuid | Nullable, FK customer_invoice_issues.id | — |
| recipient_snapshot | text | NN | — |
| channel | text | NN | — |
| template_code | text | NN | — |
| delivery_status | text | NN | 'pending' |
| background_job_id | uuid | Nullable, FK background_jobs.id | — |
| created_execution_id | uuid | NN, FK operation_executions.id | — |
| created_at | timestamptz | NN | now() |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Exactly one source context.
- Recipient and source eligibility are validated.
- Do not place raw client-review credentials in ordinary records/logs.
- Manual WhatsApp actions do not imply an official API or verified delivery.
- Automated channels require an approved configured provider.
- Preserve distinctions between pending, provider-accepted, failed,
  outcome-unknown and manually-recorded actions.
- Delivery failure does not undo invoice issue or another committed event.
- Authentication OTP/recovery remains within the approved Auth flow;
  do not duplicate secret authentication messages here.

### 8.2 message_delivery_attempts

Purpose:
Record safe channel/provider attempt evidence.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| delivery_id | uuid | NN, FK message_deliveries.id | — |
| job_attempt_id | uuid | Nullable, FK background_job_attempts.id | — |
| execution_id | uuid | NN, FK operation_executions.id | — |
| attempted_at | timestamptz | NN | now() |
| provider_message_reference | text | Nullable | — |
| outcome | text | NN | — |
| safe_error_code | text | Nullable | — |

Rules:
- Provider reference is not a credential.
- Provider acceptance is not proof of human reading.
- Uncertain outcomes require provider reconciliation where possible.
- Retry limits and permanent failure handling are explicit.

## 9. Company configuration

### 9.1 company_profile

Purpose:
Single-company identity and approved document-branding configuration.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| singleton_key | boolean | NN, UQ | true |
| legal_name | text | NN | — |
| trading_name | text | Nullable | — |
| address_text | text | Nullable | — |
| tax_registration_number | text | Nullable | — |
| logo_file_asset_id | uuid | Nullable, FK file_assets.id | — |
| currency_code | text | NN | 'AED' |
| timezone_name | text | NN | 'Asia/Dubai' |

Rules:
- singleton_key must be true.
- Initial currency is restricted to AED.
- Company data changes cannot rewrite issued document snapshots.
- Public branding publication needs explicit approved handling;
  a private logo reference does not automatically create a public bucket.
- Tax registration information is not a tax-calculation policy.

### 9.2 system_settings

Purpose:
Validated non-secret configuration with controlled ownership.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| setting_key | text | NN, UQ | — |
| value | jsonb | NN | — |
| schema_version | integer | NN | — |

Rules:
- Keys and value schemas are allowlisted.
- No credentials.
- No arbitrary executable configuration.
- Sensitive business-policy changes require explicit authority and audit.
- Historical approvals/calculations retain relevant policy snapshots.
- This table does not replace typed business records or approval evidence.
- Numbering, policy catalog and custom-field requirements need final
  reconciliation before schema approval.

### 9.3 saved_views

Purpose:
Personal or explicitly authorized shared workspace presentation.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| owner_employee_id | uuid | NN, FK employees.id | — |
| workspace_code | text | NN | — |
| title | text | NN | — |
| visibility_scope | text | NN | 'personal' |
| project_id | uuid | Nullable, FK projects.id | — |
| view_configuration | jsonb | NN | — |

Proposed scopes:
personal, project, organization.

Rules:
- Sharing requires explicit permission.
- Project scope requires an eligible project relationship.
- Filters/sorting/columns use validated allowlists.
- A saved view never expands underlying access.
- Stale configuration receives a clear recoverable validation result.

## 10. Required reconciliation

Before final architecture approval:
- Complete foreign-key creation order for circular configuration/provenance links.
- Reconcile all human-only versus delegated operation actor fields.
- Define notification template/context coverage.
- Define generated-document manifests.
- Resolve numbering configuration design.
- Resolve custom-field scope rather than hiding it in settings JSON.
- Define job execution and deployment mechanism.
- Define client verification and credential lifecycle.
- Verify provider residency and retention.
- Finalize RLS, constraints, indexes and restricted operations.

## 11. Current status

Delivered:
Proposed shared platform records.

Not delivered by this file:
A running queue, configured provider, implemented storage authorization,
validated region compliance or complete final schema.

No migrations or software tests have run.