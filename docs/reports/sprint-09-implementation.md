# Sprint 09 — Authentication

## Delivery status

Authentication implementation delivered.

The user reported successful local checks for:
- Supabase Auth connectivity.
- Login and logout.
- Password recovery.
- Verification links.
- Verification codes.

Final automated results and UI/UX approval are pending.

The assistant could not execute the project because the managed cloud
environment was unavailable.

## Implemented

- Official Supabase SSR browser and server clients.
- App-specific authentication cookies.
- Employee email/password login.
- Current-session logout.
- Session refresh through the Next.js 16 proxy.
- Server-validated identity.
- Protected workspace requests and layout.
- Client and server input validation.
- Password recovery through local email.
- Explicit confirmation before consuming email-link tokens.
- Password update for the verified current account.
- Verification emails for existing accounts.
- Six-digit email code verification.
- Generic account-request responses.
- Authentication error handling.
- Development-only setup page.
- Authentication integration and regression checks.

## Architecture

Supabase owns authentication and session credentials.

The application does not implement a separate JWT store or OTP database.

Identity is validated with Supabase getUser.
Client metadata and cached user objects are not authorization.

Authenticated content renders at request time.
Private responses use no-store cache directives.

Future protected business data and operations must independently call
the server authentication guard. A layout does not authorize an API.

## Cookie model

All clients use the afaq-interiors-crm-auth cookie and storage name.

Cookies use root path and SameSite=Lax.
Secure is enabled when APP_URL uses HTTPS.

The official browser SSR integration reads its cookies.
These cookies are not described as HttpOnly.

Local HTTP tests do not validate a future hosted HTTPS deployment.

## Email flows

Recovery and confirmation templates are separate.

Email token hashes travel in URL fragments and are submitted only after
the employee selects Continue.

Redirect destinations are fixed internal paths.

OTP values remain strings.
Supabase enforces token expiry, single use, and verification rate limits.

Unknown or ineligible accounts receive neutral request responses.
A neutral response does not prove delivery.

## Password updates

The service verifies identity independently.
Only the current account can be updated.

After a successful update, global sign-out is requested.

If sign-out fails after the update, the UI reports that the password was
updated and provides sign-out again.

Already-issued access tokens may remain valid until expiry after refresh
sessions are revoked. Immediate invalidation of all access tokens is not
claimed.

## Final test coverage

Production-build checks include:
- Anonymous access to workspace roots and nested routes.
- Forged session rejection.
- Disabled public registration.
- Unconfirmed account rejection.
- Isolation between two authenticated browser contexts.
- Private response caching and cookie attributes.
- Actual recovery email, password update, and old-password rejection.
- Actual verification link and single-use behaviour.
- External next-URL rejection.
- Actual verification code and single-use behaviour.
- Development-only routes unavailable in production.

Earlier suites cover login, logout, validation, error states, responsive
UI, accessibility, and application-shell regressions.

## Local fixture safety

The Node-side integration helper requires a test-only local secret key.

It checks the local Supabase origin, dedicated port, and project ID.

It creates uniquely named temporary accounts and records their IDs.
Cleanup verifies the expected email and deletes only those recorded IDs.

It does not enumerate or modify existing employee accounts.

Browser traces, screenshots, and videos are disabled for the integration
tests that handle live credentials and email tokens.

The local email viewer must expose the Mailpit-compatible API.

## Remaining assigned work

Sprint 10:
- Full roles and permissions.

Sprint 11:
- Employee invitations, activation/deactivation, and user management.

Sprint 12:
- Remaining RLS, private storage authorization, and audit/security checks.

Hosted project region and residency requirements remain unconfirmed.
Production SMTP and hosted deployment remain pending.

## Validation commands

npm.cmd run format
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:all

Record actual local results before approving the sprint.

## Approval

Sprint 09 requires final test results and UI/UX confirmation.
Sprint 10 has not started.