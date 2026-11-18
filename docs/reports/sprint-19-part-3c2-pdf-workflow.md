# Sprint 19 Part 3C2 — local draft PDF workflow

## Delivered

Connects the Part 3A model, Part 3B renderer and Part 3C1 storage gateway.
New server actions accept only quotation/version/request IDs or a document ID.
The server verifies getUser(), existing quotation permission and current database
resource visibility. Browser totals, actor identities and Storage paths are not accepted.

ENABLE_LOCAL_QUOTATION_PDFS=true enables the local UI and server workflow.
The Supabase endpoint is pinned to http://127.0.0.1:57421, the application must
use a local HTTP origin, and the checked project ID is afaq-interiors-crm-s09-local.
The existing SUPABASE_LOCAL_TEST_SECRET_KEY stays server-only. No dependencies added.
Default hosted behavior remains disabled; no hosted settings or data were changed.

Uploads never overwrite objects. Matching retry bytes are checked with SHA-256.
The UI retains request IDs in sessionStorage when available, with an in-memory
fallback. Confirmed failed requests require a new ID. Unknown outcomes retain the
same retry ID and keep private objects until their state can be reconciled.
Cleanup fails pending metadata before deleting an object; ready artifacts are retained.

Download URLs last 60 seconds and use download disposition. Current access and the
issuance audit are checked before a URL is returned. The UI clears expired links;
Storage enforces expiry independently. Already issued bearer links can remain usable
until expiry after permission revocation. No link is emailed or delivered to a client.

## Migration and verification

No new SQL beyond Part 3C1. Its reviewed 20261116000100 migration was the only
pending local migration. A private local backup was created before local application.
The new bucket remains private, PDF-only and capped at 10 MiB. No destructive reset.

Nine workflow unit tests passed, including ambiguous outcomes and audit rejection.
Two browser tests passed on desktop/mobile using isolated accounts and actual local
Storage. They cover concurrent generation retries, direct-access denial, downloads,
fault-injected truncated-upload cleanup, revoked access and UI expiry. Desktop also
verifies actual HTTP rejection after signed expiry. Focused axe scans and overflow
checks passed. The browser configuration runs a production build before starting.

TypeScript, ESLint and production build passed. Existing quotation browser
regressions passed all eight desktop/mobile cases. PDF/model tests passed 21,
Storage SQL tests passed one and existing quotation unit tests passed 40.
Together with the nine workflow and two PDF browser tests, 81 cases passed.
Cleanup verified one baseline Auth user and zero leads, quotations, PDF metadata,
PDF events or PDF Storage objects. The immutable audit trigger remains enabled.
An initial missing Playwright browser was resolved using installed cloud Chromium.
Windows can install Chromium using npx.cmd playwright install chromium.
Next.js emitted a non-failing MaxListenersExceededWarning during browser checks;
the warning was not suppressed. Long-running memory behavior was not assessed.

## Manual checkpoint and remaining work

Save a local synthetic quotation, prepare its saved draft PDF, create a download
link and inspect the draft. Verify retry behavior, expiry and denied access.
Unsaved builder changes are not included. English/WinAnsi limitations remain.
No official approval, PDF issuance for client delivery, or AI generation is claimed.

Owner Windows verification remains pending. AI asset management and final Sprint 19
validation remain separate work. Sprint 20 has not started.