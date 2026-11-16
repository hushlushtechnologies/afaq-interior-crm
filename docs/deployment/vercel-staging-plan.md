# Git audit and Vercel staging plan

## Reviewed source

Repository: hushlushtechnologies/afaq-interior-crm.
Fetched main commit: 6d86641, Migration Bud.
Review and repairs use a separate worktree; earlier local work was preserved.
No commit, push, Vercel deployment or production database change was performed.

## Confirmed repairs

1. 20261114000200_sprint19_revision_creation.sql is empty in the pushed commit.
   Keep that historical file intact. Add 20261114000300_sprint19_revision_repair.sql.
   The forward migration handles a missing revision RPC or its already-correct
   implementation, preserves saved evidence and keeps the migration ledger intact.
2. Existing capture handlers use /api/integration, while signing and worker contracts
   use /api/integrations. Canonical route aliases now reuse the same guarded handlers.
   Existing routes remain available; the website verifier still requires the exact
   canonical signed path. No signature bypass or production enablement was added.
3. Repository preflight detects empty new migrations, duplicate versions and missing
   canonical route files. The known historical empty migration is explicitly allowed
   only alongside the required forward repair. File checks do not prove DB readiness.
4. .env.example explicitly keeps all local-only integrations disabled.

## Verification performed

- All committed unit tests passed: 123 Phase 3 and 40 quotation cases.
- Existing quotation database selection: six passed.
- Quotation/history/repair browser selection: 22 passed across desktop/mobile.
- The strengthened repair-state fixture passed two additional focused cases.
- Full Phase 3 browser selection: 214 passed in one run. Invitation messages stayed
  in the isolated local email viewer; no real email delivery was performed.
- All 28 existing rollback-only SQL fixture files passed.
- Production build, TypeScript, ESLint, changed-file formatting and diff checks passed.
- A bounded scan of 46 built client artifacts and four logs found neither configured
  local admin-key nor test-password values. This is not a comprehensive secret audit.
- Cleanup: original one Auth account, zero test leads/quotations/Storage objects,
  and zero active cron jobs. Numbering counters were not rewound.

File validation tests initially hit sandbox child-process restrictions and passed
with the required local permissions. An explicit runtime export added during the
repair was rejected by the installed Next.js Cache Components configuration; it
was removed before successful builds. Default Node.js runtime remains in use.
Existing Next.js listener-count and NO_COLOR warnings remain nonblocking in these
runs; no production memory/load conclusion is claimed. Windows manual checks,
valid signed live capture and Vercel deployment were not performed.

## Local database safety

The dedicated local project uses API 57421 and PostgreSQL 57422. Before the forward
repair, a private archive was created outside Git and its directory checked. No
restore drill was performed. The repair was applied only locally. Regression tests
reproduce the missing-function state and exercise repeated repair inside a rolled
back transaction. Existing roles and final-Super-Admin protections are preserved.

Never reset the database or delete migration ledger rows to address this issue.
Do not rerun the history-foundation SQL manually after it has been applied. If that
migration is missing, let the ordered local migration command apply it first.

## Release gates before Vercel

- Complete the manual local checks and record their results.
- Use an isolated hosted Supabase staging project with synthetic data first.
- Review the entire migration chain against that staging project. A brand-new
  hosted-project replay and a backup restore drill are still pending.
- Re-run authorization/RLS and browser smoke checks against staging through an
  approved staging test procedure. Existing fixture suites intentionally refuse
  remote databases; do not remove those guards to make them run on staging.
- Confirm the first hosted Super Admin provisioning process. The bootstrap script
  in this repo is local-only; do not weaken it or reuse local fixture credentials.
- Production invitations/email, attachment processing/malware policy, capture
  credentials/workers and reminder scheduling need separate hosting approval.
  Current local-only implementations must remain disabled on Vercel.
- Sprint 19 PDFs/AI and later commercial approval/delivery/conversion remain
  unfinished. A preview is not a completed Phase 4 commercial release.

## Planned Vercel project configuration

Use the GitHub repository root, framework preset Next.js, install command npm ci,
build command npm run build, and the default Next.js output directory. Do not
choose static export. Select Node.js 24.x explicitly to match the locally tested
major version; do not rely on Vercel's changing default. Vercel documents 24.x at
https://vercel.com/docs/functions/runtimes/node-js/node-js-versions.

No vercel.json is required for this app. Keep database migrations out of the Vercel
build command. Review and apply staging migrations as a separate controlled step.

Set these only for the intended staging Preview environment:

- NEXT_PUBLIC_SUPABASE_URL: the hosted staging Supabase HTTPS origin.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: its publishable/anon key, never a secret key.
- APP_URL: the exact stable HTTPS staging application origin, without a path.
- ENABLE_LOCAL_EMPLOYEE_INVITES=false.
- ENABLE_LOCAL_LEAD_ATTACHMENTS=false.
- ENABLE_LOCAL_LEAD_CAPTURE=false.

Do not upload .env.local, local Auth test credentials, SUPABASE_LOCAL_TEST_SECRET_KEY,
local capture fixture files, backups, browser session files or worker credentials.
Do not add a service-role key to NEXT_PUBLIC variables or to ordinary business RPCs.

Configure the matching staging Auth Site URL and exact approved callback URLs for
auth/callback, auth/accept-invitation, auth/confirm and auth/update-password in
Supabase. Use one stable staging origin and scope credentials per environment.
Avoid broad redirect wildcards. Enable available Vercel Deployment Protection.

## Planned Git and deployment sequence

1. If a Vercel project is already connected, check automatic deployment settings
   before pushing. Keep the repair on a branch until the intended preview is approved.
2. Create a repair branch from current main, copy the delivered files and run:

   node scripts/check-repository-readiness.mjs
   npm.cmd run typecheck
   npm.cmd run lint
   npx.cmd playwright test --config=playwright.quotation-unit.config.ts
   npx.cmd playwright test --config=playwright.phase3-unit.config.ts
   npx.cmd playwright test --config=playwright.quotation-database.config.ts
   npx.cmd playwright test --config=playwright.audit.config.ts

3. Review git diff and stage only the repair files. Keep the empty historical
   migration unchanged. Commit and push the branch when ready for Git review.
4. After the staging database and Auth gates pass, authorize a protected Preview
   deployment. Use synthetic data and verify sign-in/out, cookies, denied roles,
   lead CRUD, quotation saves/revisions/history and cache isolation.
5. Do not promote Preview to Production or point it at production data until the
   owner separately approves a live release and the remaining dependencies.

Application rollback and database rollback are different. Retain the previous
Vercel deployment for application rollback; repair schema issues with reviewed
forward migrations. Do not automatically undo business data.