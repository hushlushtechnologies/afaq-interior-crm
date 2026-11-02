# Password recovery

## Request

The employee submits an email address on /forgot-password.

Input is validated on the client and server.
Supabase Auth handles the recovery request.

Unknown or ineligible accounts receive the same neutral public response.
The page does not claim that an email was delivered.

Production SMTP must be configured separately.
Local emails are captured at http://127.0.0.1:57424.

## Email template

The local recovery template directs the browser to /auth/confirm.

The one-time token hash and flow type are carried in the URL fragment.
The browser does not send that fragment with the initial page request.

Email templates use inline styling because email clients do not load the
application's Tailwind stylesheet.

## Confirmation

Opening the page does not verify or consume the token.

The employee selects Continue.
The client reads the fragment during that event and sends the values
to a Server Action.

The server validates the values and calls Supabase verifyOtp.
Successful recovery verification creates the official Supabase SSR session.

Redirect destinations are fixed internal paths.
No user-supplied next URL is accepted.

Invalid, expired, and already-used links receive a clear error.

## Password update

/auth/update-password checks identity at request time.

The password-update service independently verifies identity again.
The operation updates only the account represented by that session.

A currently authenticated employee can also change their own password.
Supabase may require fresh verification for an older session.

The new password and its confirmation must match.
Passwords are not trimmed or included in action results.

## Completion

After a successful update, the service requests global sign-out for
that account and returns to login.

Existing access tokens can remain valid until their expiry even after
refresh sessions are revoked. Do not describe global sign-out as
instant revocation of every already-issued access token.

If password update succeeds but sign-out fails, the UI reports the
password update accurately and offers sign-out again.

## Local review

Use a separate confirmed local account for manual recovery testing so
the main E2E account password remains unchanged.

If the E2E account password is changed, update E2E_AUTH_PASSWORD privately.

Do not share recovery links, token hashes, passwords, or email contents
containing active links.

## Tests

Automated checks cover request validation, neutral unknown-account
responses, missing sessions, explicit confirmation, invalid tokens,
and password confirmation.

A real local-email recovery round trip requires manual validation in
this part. Further authentication coverage is completed in Part 4.

Assistant execution was unavailable because the cloud environment
was offline.