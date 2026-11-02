# Sprint 09 — Local authentication foundation

## Intended architecture

- Next.js App Router.
- Supabase PostgreSQL and Supabase Auth.
- Official @supabase/ssr cookie integration.
- Server-validated identity for protected pages and operations.
- Zod validation.
- Separate development, staging, and production configuration.

The original Sprint 02 architecture document was unavailable.
The user's current stack confirmation is the intended architecture,
subject to checking that original document if it becomes available.

## Scope

Sprint 09 covers authentication, sessions, protected application routes,
password recovery, verification, error handling, and authentication tests.

Full roles and permissions belong to Sprint 10.
Invitations and employee management belong to Sprint 11.
Storage authorization and the remaining RLS/security verification belong
to Sprint 12.

## Local services

Project ID: afaq-interiors-crm-s09-local

- API: http://127.0.0.1:57421
- Studio: http://127.0.0.1:57423
- Email viewer: http://127.0.0.1:57424

The local stack is separate from the previous CRM.
No existing CRM database is linked.

No application database migration is introduced in this part.

## Environment

.env.example contains names and local example URLs.

.env.local contains local runtime values and must remain ignored by Git.

Browser configuration uses only a publishable key or the legacy public
anon key.

Secret and service-role keys must never be placed in NEXT_PUBLIC_
variables.

Do not share complete Supabase status output because it can contain
secret credentials.

## Client helpers

browser.ts provides the official browser SSR client.

server.ts provides:
- createSupabaseServerClient for read-only Server Component use.
- createSupabaseMutationClient for cookie-writing Server Actions and
  Route Handlers.

Server cookie configuration uses a host-only cookie, root path, and
SameSite=Lax. Secure is enabled when APP_URL uses HTTPS.

The official browser SSR integration reads its auth cookies.
This implementation does not claim that those cookies are HttpOnly.

The refresh proxy and protected-route checks are added in Part 2.
The read-only server helper does not persist refreshed cookies itself.

## Connectivity check

Development URL: /dev/auth-setup

A successful health response confirms service connectivity.
It does not authenticate an employee.

The page returns 404 outside development.

## Hosted deployment

No hosted Supabase project or customer-data deployment is authorized
by this local setup.

The project region and applicable residency requirements require user
confirmation before hosted project creation.

Production SMTP is not assumed to be configured.
Local authentication emails are captured by the local email viewer.

## Commands

Start:
npx.cmd supabase start

Inspect locally:
npx.cmd supabase status

Stop this local stack from this project directory:
npx.cmd supabase stop

Do not use db reset or commands affecting other local projects.

## Part 1 validation

- Dependency installation and peer compatibility.
- Formatting.
- ESLint.
- Type checking.
- Existing regression tests.
- Manual authentication service health check.

Assistant execution was unavailable because the cloud environment
was offline. Actual local results are pending.