# Sprint 09 — Login and sessions

## Authentication

Employees sign in using Supabase Auth email/password authentication.

Public registration remains disabled in the local Supabase configuration.

The local test user is created in Supabase Studio with a confirmed email.
This is development bootstrap, not the employee invitation workflow.

## Structure

- schemas.ts: shared input validation.
- service.ts: Supabase authentication operations.
- actions.ts: Server Action validation, results, and redirects.
- session.ts: server-validated identity and the reusable authentication guard.
- supabase/proxy.ts: session refresh and workspace request protection.
- src/proxy.ts: Next.js 16 proxy entry point.

## Sessions

The official Supabase SSR cookie integration manages session storage.

All clients use the afaq-interiors-crm-auth storage and cookie name.

Cookies use root path, SameSite=Lax, and Secure when APP_URL uses HTTPS.
The browser SSR integration reads its auth cookies; these are not described
as HttpOnly cookies.

Supabase getUser validates identity.
Client role values or getSession results are not used as authorization.

Authenticated responses use private, no-store cache directives.

## Protected workspaces

The proxy recognizes workspace roots from shared navigation configuration.
The workspace layout independently verifies identity before rendering.

Authentication service failures do not render workspace content.

Every future protected business data service, action, or API must also
validate identity at its own boundary. A layout is not an API authorization
boundary.

requireAuthenticatedUser is available for server-side data and operations.

## Identity and scope

The shell receives the verified account email.
The demo employee is no longer supplied by the workspace layout.

Any confirmed email account in this separate Supabase project can access
the current authenticated prototype workspaces.

Role and permission restrictions belong to Sprint 10.
Employee activation and invitation management belong to Sprint 11.

## Login and logout

Login input is validated on both client and server.
Passwords are not trimmed or returned in action results.

Successful login goes to Dashboard.
Failed credential checks use a generic message.

Logout ends the current session and returns to login.

Recovery and verification flows are delivered in Part 3.

## Browser tests

A shared setup signs in through the actual login page and records the
browser's native storage state.

No authentication bypass or custom token injection is used.

Workspace suites load that state.
Authentication tests explicitly begin with an empty browser state.

Local credentials come from E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD.
Generated state is ignored by Git.

Keep local auth state and any sensitive test artifacts private.

## Validation status

Implementation supplied for local validation.

The assistant could not execute checks because the cloud workspace
was offline.