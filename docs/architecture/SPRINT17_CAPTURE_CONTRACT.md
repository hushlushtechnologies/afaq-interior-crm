# Sprint 17 — lead-capture verification contract

Status: locally tested protocol foundation only. No public capture route, inbox,
worker, provider retrieval, production credential or database write is enabled.
Date reviewed: 2026-11-12 (Asia/Dubai).

## Trusted use

Import functions from src/features/lead-capture/server.ts in server code only.
Pass configuration from trusted active credential bindings, never request data.
Secrets require 32–256 printable non-space ASCII characters; this length check
is not an entropy guarantee. Provision random secrets through approved server
configuration. Fixture secrets are not deployment configuration.

The verification module reads no environment variables, makes no network calls,
persists nothing and logs nothing. A null result means rejection, not acceptance.

## Meta

Checked official references:
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving

GET verification requires exactly one hub.mode, hub.verify_token and hub.challenge.
Mode must be subscribe. A matching configured token returns only the numeric
challenge. A future adapter must respond as plain text, never HTML.

POST verification reads X-Hub-Signature-256 and verifies sha256=<64 hex digits>
against the original request bytes using the App Secret. Do not JSON-decode,
reserialize or otherwise transform the body before signature verification.
Limit the body to 64 KiB and 100 total leadgen changes.

Only Page leadgen notifications for approved Page/form pairs are supported.
entry.id and value.page_id must agree. String IDs preserve full precision.
Numeric tokens must be canonical safe integers: fractional, exponent and unsafe
numeric encodings are rejected before JSON.parse can round them. Unsupported
objects, fields, pairs or conflicting repeated contexts reject the entire batch.
Unknown extra provider fields are ignored and are not returned.

Returned notices contain Page ID, form ID, leadgen ID, provider creation time and
meta:leadgen:<leadgen ID>. Repeated notices in one payload share one descriptor.
This does not consume events or prevent cross-request replays. A durable inbox
must enforce uniqueness on trusted connection ID plus event key. Compare canonical
Page/form context on collisions; provider delivery timestamps may vary on retries.

A Page notification alone does not establish Facebook versus Instagram source.
Actual source attribution requires approved form/platform mapping and retrieval
validation. No Graph API version, access token, approved account list, app review
or production permission is assumed or configured by this delivery.

## Website

This is a server-to-server contract. Never put a signing secret in a website's
browser JavaScript. The reserved path below is NOT registered in this app yet:

POST /api/integrations/website/leads

Future headers map to these verifier properties:
- X-Afaq-Key-Id -> keyId: lowercase active key identifier, up to 40 characters.
- X-Afaq-Request-Id -> requestId: canonical lowercase UUID retained during retries.
- X-Afaq-Timestamp -> timestamp: canonical decimal Unix seconds.
- X-Afaq-Signature -> signature: v1=<64 hexadecimal HMAC-SHA256 digits>.

Build the exact UTF-8 signing input by joining these seven lines with LF, with no
trailing LF:

1. Literal AFAQ-WEBSITE-LEAD-V1.
2. Literal POST.
3. Literal /api/integrations/website/leads.
4. The exact keyId header value.
5. The exact requestId header value.
6. The exact timestamp header value.
7. The lowercase SHA-256 hex digest of the original body bytes.

The verifier receives actual method/path and a trusted server clock in context.
The path must include any query string, so unexpected queries are rejected.
Reject duplicate headers/query parameters in the future HTTP adapter. Both past
and future clock skew are limited to 300 seconds. A timestamp is not replay
protection. Limit the body to 16 KiB and parse strict UTF-8 JSON only after HMAC.

Body: customer_name is required. Optional nullable fields are email, phone,
alternate_phone, property_type, location, budget (AED decimal string),
expected_start_on (ISO calendar date) and description. Existing lead validation
applies. Missing optional information becomes null. Owner, actor, source, stage,
company and other protected fields cannot be supplied. No country/currency is guessed.

Returned website:request:<request UUID> is stable across key rotation. Resolve the
key to an approved active trusted connection before verification. Durable inbox
uniqueness must use connection ID plus event key. Store/compare bodyHash: exact
retries return the prior receipt; changed bodies under the same event key conflict.
The current verifier intentionally does not consume requests or provide a ledger.

## Activation dependencies

Before exposing either route:
1. Approve accounts/forms, mapping, website connection and source/assignment rules.
2. Provision and test server credentials without exposing them in chat or logs.
3. Approve private external-payload retention and restricted durable inbox RLS.
4. Reconcile the documented service principal/delegation model with actual schema.
   crm_save_lead currently requires an eligible employee. Do not impersonate an
   employee or grant broad service-role access to bypass this boundary.
5. Obtain explicit approval before changing Phase 2 authorization dependencies.
6. Approve the durable worker, bounded retries, failure review and operational limits.
   DEC-009's existing local reminder cron approval does not authorize capture jobs.
7. Atomically persist an authenticated accepted event before acknowledging it.
   An unavailable inbox must not produce a success acknowledgement or silent drop.
8. Use a fixed HTTPS Meta adapter with an explicitly verified supported API version,
   authorized minimum fields, secure token binding and no caller-supplied URLs.
9. Test permissions, revoked access, duplicate races, worker restart, failures and
   real end-to-end retrieval before claiming live ingestion works.

No reliable rate limiting, queue, backoff scheduler, delivery acknowledgement,
service authority or lead conversion is claimed by these helpers. Do not expose
an endpoint until those controls exist. Manual leads/imports remain independent.
The Phase 3 plan includes this foundation; historical traceability still places
full Meta integration in Sprint 42. Do not silently renumber that later sprint.