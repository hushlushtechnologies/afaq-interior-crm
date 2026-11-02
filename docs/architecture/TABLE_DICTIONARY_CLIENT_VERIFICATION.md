# Afaq Al Manzel Interiors CRM — Client Verification Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed implementation design for accepted verification direction

## 1. Accepted direction

1. An authorized employee prepares a designated client review.
2. The employee manually sends an invitation through WhatsApp.
3. The recipient requests email verification.
4. The CRM sends an OTP to the designated contact email.
5. Successful verification creates a scoped external review session.
6. The client may perform only the permitted review actions.

This is not ordinary employee login.

Official WhatsApp API integration is not required.

## 2. Existing related records

Defined in TABLE_DICTIONARY_PROJECT_OPERATIONS.md:
- design_review_rounds.
- design_review_grants.
- design_review_sessions.
- design_review_comments.
- design_review_decisions.
- design_releases.

Defined in the platform dictionary:
- operation_executions.
- file_assets.
- background_jobs and attempts.
- integration_connections.
- message delivery metadata.

This file adds verification-specific records.

No authentication secrets belong in ordinary notification/job payloads.

## 3. Conventions

Default — means no database default.

These tables are server-controlled.
External clients must not receive direct table-write access.

Time/attempt values below are proposed security settings, not a claim
that they have been implemented or tested.

## 4. Invitation records

### 4.1 client_review_invitations

Purpose:
Bind a secret invitation link to an existing scoped review grant.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| review_grant_id | uuid | NN, FK design_review_grants.id | — |
| invitation_token_digest | text | NN, UQ | — |
| contact_email_snapshot | text | NN | — |
| created_by | uuid | NN, FK employees.id | — |
| created_execution_id | uuid | NN, FK operation_executions.id | — |
| created_at | timestamptz | NN | now() |
| expires_at | timestamptz | NN | — |
| revoked_at | timestamptz | Nullable | — |
| manual_delivery_recorded_at | timestamptz | Nullable | — |

Rules:
- Generate a cryptographically random high-entropy invitation secret.
- Store its digest, not the raw secret.
- Do not log the raw invitation URL.
- Email snapshot must match the intended eligible contact.
- Invitation expiry cannot extend effective grant access.
- Changing the designated verification email requires controlled
  revocation/reissue; do not silently redirect an existing invitation.
- Manual delivery recorded means an employee recorded the action.
  It does not prove WhatsApp delivery or reading.
- Forwarded invitation alone cannot authorize a design decision.
- Do not reveal protected submission details before required verification.

## 5. OTP challenges

### 5.1 client_review_verification_challenges

Purpose:
Record a bounded one-time verification attempt for an invitation.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| invitation_id | uuid | NN, FK client_review_invitations.id | — |
| otp_verifier | text | NN | — |
| verifier_key_version | text | NN | — |
| challenge_state | text | NN | 'pending' |
| failed_attempt_count | integer | NN | 0 |
| maximum_attempts | integer | NN | — |
| created_at | timestamptz | NN | now() |
| expires_at | timestamptz | NN | — |
| verified_at | timestamptz | Nullable | — |
| invalidated_at | timestamptz | Nullable | — |
| provider_message_reference | text | Nullable | — |

Proposed states:
pending, verified, locked, invalidated.

Expiry is also checked against expires_at.

Rules:
- Never store the plaintext OTP.
- A simple unsalted hash of a short numeric code is insufficient.
- Use an approved keyed verification construction with its secret held
  outside the database.
- Bind the verifier to this challenge and invitation.
- Compare verifiers safely.
- Failed-attempt increments and successful consumption are atomic.
- Expired, locked, invalidated or consumed challenges cannot be reused.
- Resending creates a new challenge and invalidates the prior active one.
- Limit requests and verification attempts across relevant identities
  and abuse-control dimensions.
- Avoid responses that reveal whether arbitrary customer emails exist.
- Send only to contact_email_snapshot; do not accept a replacement email
  from the public requester.
- Provider reference is a non-secret identifier.

Delivery:
Generate/send OTP through the dedicated trusted verification flow.
Do not place plaintext OTP into ordinary persisted job payloads,
notification bodies, audit events or diagnostics.

Unknown delivery outcome:
Do not claim email delivery succeeded.
A new permitted resend uses a new challenge and invalidates the old one.

## 6. Session credentials

### 6.1 client_review_session_credentials

Purpose:
Bind a successfully verified challenge to an opaque scoped session credential.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| review_session_id | uuid | NN, FK design_review_sessions.id, UQ | — |
| verification_challenge_id | uuid | NN, FK client_review_verification_challenges.id, UQ | — |
| session_token_digest | text | NN, UQ | — |
| created_at | timestamptz | NN | now() |
| expires_at | timestamptz | NN | — |
| revoked_at | timestamptz | Nullable | — |

Rules:
- Create only after successful atomic OTP verification.
- Challenge, invitation, grant and session must identify the same review.
- One challenge cannot create multiple independent sessions.
- Generate a high-entropy opaque session secret.
- Store only its digest.
- Deliver the browser credential using secure session handling.
- Use Secure, HttpOnly and appropriate SameSite cookie controls.
- Enforce origin/CSRF protections for state-changing review requests.
- Effective expiry is no later than the session, invitation and grant limits.
- Revoking a grant/invitation/session invalidates subsequent access.
- Credential rotation creates a controlled replacement session and revokes
  the old one; do not silently reuse a consumed challenge.

## 7. Relationship requirements

A successful verification transaction must establish:

challenge
→ invitation
→ review grant
→ review round
→ submitted revision
→ design package
→ project
→ client

The designated contact belongs to that client.

design_review_sessions.verification_method must identify email OTP for
this accepted flow.

Its verifier reference may identify the challenge as non-secret provenance.
The credential table provides an enforceable challenge relationship.

No request may substitute another grant, contact, session or revision.

## 8. Review authorization

Every protected request checks:
- Valid opaque session credential.
- Session not expired/revoked.
- Invitation/grant not expired/revoked.
- Eligible review round and submitted revision.
- Explicit capability for the requested action.
- Client-visible file/comment restrictions.

A client cannot:
- Browse employees or internal navigation.
- Read internal comments.
- Retrieve another project.
- Change the reviewed content.
- Approve as the PM.
- Release a design directly.
- Apply approval to a later revision.

Approval must identify the exact eligible revision and attributable session.

## 9. Proposed security defaults for later review

Proposed starting values:
- OTP lifetime: 10 minutes.
- Maximum failed attempts per challenge: 5.
- Minimum resend interval: 60 seconds.
- External session absolute lifetime: 30 minutes.

Additional rate limits are required across invitation/contact and
network abuse signals.

These are reviewable technical defaults.
They do not replace:
- Provider verification.
- Abuse testing.
- Accessibility/usability review.
- Final invitation/grant lifetime policy.

Do not expose arbitrary lifetime settings to external callers.

## 10. Privacy and service requirements

- Verify email provider compatibility and approved external processing.
- Keep email content minimal.
- Do not include internal project/financial details.
- Store verification records in the approved environment.
- Minimize abuse-control metadata.
- Define retention before production.
- Do not log OTPs, invitation secrets or session credentials.
- Do not describe this mechanism as a certified electronic signature.

## 11. Failure and recovery

No email access:
Do not bypass verification.
Use an explicitly approved contact correction or alternative process.

Wrong designated email:
Authorized internal correction revokes/reissues affected access.

Expired invitation:
Require eligible reissue.

Repeated incorrect OTP:
Lock the challenge and apply rate limits.

Provider outage:
Report verification unavailable; do not mark the client verified.

Approval request after access revocation:
Reject even if the review page remains open.

Concurrent OTP submissions:
At most one successful challenge consumption/session creation.

## 12. Required tests when implemented

- Forwarded link without email access cannot approve.
- Caller cannot replace the destination email.
- Wrong/expired/reused OTP fails.
- Concurrent verification cannot create duplicate sessions.
- Attempts and resend limits cannot be bypassed.
- Expired/revoked grants deny subsequent actions.
- Session/context substitution fails.
- Client-visible files exclude internal evidence.
- Cookies and state-changing requests receive appropriate protections.
- Logs contain no raw secrets.
- Provider failure does not authenticate the client.
- PM/client design approvals still match the same revision.

No tests have been executed.

## 13. Current status

Verification direction:
Accepted.

Physical/security implementation:
Proposed.

Provider, final rate limits and production readiness:
Not verified.

No emails, OTPs, sessions, tables or migrations have been created.