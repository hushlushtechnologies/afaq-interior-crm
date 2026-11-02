# Email verification

## Scope

Existing employee accounts can request a verification email and verify
using its link or six-digit code.

The application does not create accounts through this flow.
Employee invitations and management belong to Sprint 11.

## Configuration

The local Supabase configuration uses:
- Public registration disabled.
- Email authentication provider enabled.
- Email confirmation required.
- Six-digit email OTPs.
- Ten-minute OTP expiry.
- One-minute email request frequency.

The code-entry schema and Supabase OTP length must agree.

Production email delivery and templates require separate configuration
after hosting and residency decisions.

## Request

/verify-email calls a Server Action that validates the email address.

The service uses Supabase resend with type signup.
This resends account-confirmation messages for existing accounts.

Unknown, already-confirmed, and ineligible accounts receive a neutral
public response.

A neutral response is not proof that email was delivered.

## Link verification

The confirmation template sends token_hash and type=email in the URL
fragment.

The shared /auth/confirm page does not consume the token automatically.
The employee selects Continue.

The existing server action validates the token using Supabase verifyOtp.
Successful verification establishes the official SSR session and
redirects to Dashboard.

No arbitrary redirect destination is accepted.

## Code verification

The employee supplies the matching email address and six-digit code.

Codes remain strings, preserving leading zeroes.
Input is validated on both client and server.

The service uses Supabase verifyOtp with type email.

Supabase handles token expiry, single use, and verification rate limits.
The application does not store its own OTP database.

## Identity

Successful verification must return a Supabase session and a confirmed
email account.

Workspace access is still independently checked on the server.

Role and permission restrictions belong to Sprint 10.

## Logging

Development diagnostics contain stage, error name, code, and status.
They must not include codes, token hashes, passwords, or full email links.

## Local manual validation

Use two separate unconfirmed local accounts:
- One for link verification.
- One for code verification.

Using the link or code consumes that message's one-time credential.
A confirmed account does not need another confirmation email.

Local messages are viewed at http://127.0.0.1:57424.

## Automated validation

Checks cover validation, neutral responses, invalid codes and links,
anonymous access after failure, responsive layout, and accessibility.

Real link and code success paths require local email validation in this
part. Final authentication verification is completed in Part 4.

The assistant could not execute checks because the cloud environment
was unavailable.