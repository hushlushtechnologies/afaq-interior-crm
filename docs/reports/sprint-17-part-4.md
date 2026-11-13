# Sprint 17 Part 4 — lead-capture verification foundation

Status: implemented; owner local verification pending. Live capture is blocked.
This delivery implements verification utilities and a secure integration contract,
not public ingestion. Phase 4 and production activation have not started.

## Delivered

Node-only HMAC/constant-time verification, Meta challenge handling, bounded UTF-8
Page leadgen parsing, approved Page/form allowlists, precision-safe IDs and stable
Meta event keys. Website verification binds actual method/path, configured trusted
key, request UUID, timestamp and exact body digest; existing lead fields are
validated without accepting actor/owner/source/stage/company values. Its stable
event key survives key rotation and exposes a body hash for future replay checks.
A server-only import boundary and detailed activation contract are included.

No new endpoint, credential binding, database migration, dependency, scheduler,
network ingestion, employee impersonation or business-data write is added.
The approved architecture's service-principal/delegation and durable integration
inbox are documented but are absent from current migrations. Existing lead RPCs
require employee authority. Those gaps block automated writes and acknowledgements.
No Phase 2 authentication/authorization code was changed.

## Verification

- Capture protocol tests: 16 passed with synthetic credentials and bodies.
- Existing import tests: 20 passed; existing lead validation: six passed.
- TypeScript, ESLint, formatting and whitespace checks passed.
- Production build passed.
- Configured-secret scan found no client/log matches.
- No database, production or application credential setting was changed.

Official Meta webhook and Lead Ads retrieval documentation was read on 2026-11-12.
No credentialed Graph retrieval or live provider end-to-end test was performed.
No browser, database, RLS or scheduler suite was run for these pure utilities.

## Chat delivery correction

The prior Part 3 chat copy shortened two existing navigation labels. The actual
reviewed source retained Prompt presets and Client documents. Include the full
correct navigation.ts in this delivery so manual copies preserve those labels.
The Import CSV section remains. No other navigation behavior changes in this part.

## Files and checkpoint

New: features/lead-capture/verification.ts and server.ts;
tests/unit/lead-capture.spec.ts; playwright.capture-unit.config.ts;
architecture/SPRINT17_CAPTURE_CONTRACT.md; this report.
The existing complete lib/workspace/navigation.ts is supplied as a chat correction.

Copy complete files and run the Windows checks. No Supabase setup or migration
is needed. Do not configure production webhooks, credentials or public routes.
Stop for local test results. Reports, dashboard metrics, safe CSV export, optional
XLSX and final Phase 3 verification remain pending Sprint 17 work. Do not claim
live Meta/website capture or replay prevention is complete.