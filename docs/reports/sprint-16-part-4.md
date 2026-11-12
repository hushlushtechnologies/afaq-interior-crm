# Sprint 16 Part 4 — daily follow-up workspace

Connects /leads/follow-ups to existing protected follow-up reads. No new
migration, dependency, role grant or production setting change. Defaults to
My Follow-ups / Today using trusted server time and Asia/Dubai display.

Views: all statuses, open, today, overdue, upcoming, completed and cancelled.
My tasks require current lead visibility. Team appears only for company-wide
leads.view; the RPC independently rejects forged team reads from scoped Sales.
20-row pagination, outcome/cancellation evidence, owner-review/read-only flags,
loading/error/empty states and explicit refresh are provided. Today and overdue
can overlap. Status changes continue in the existing Lead Details controls.

Lead Details now performs an authorized archived lookup when an active lookup
returns no rows. Historical task links can open archived leads read-only. This
does not restore records or relax server-side write guards. Existing roles and
final-Super-Admin protection are unchanged.

Verification: four desktop/mobile browser checks passed, covering scoped Sales,
forged team RPC denial, filters, pagination, empty Today state, authorized
Management Team view, active links and archived history links. TypeScript,
ESLint, project/runner formatting, whitespace checks and production build passed.
An initial new-test locator declaration error was corrected before the passing
run. Generated fixture accounts/tasks were absent after cleanup. Bounded scan
of 40 client files and one log found no configured secret matches.

No database changes were made; SQL suites and the full browser regression
matrix were not rerun. Existing nonfatal Next listener-count/NO_COLOR warnings
remain. View/filter state is local to the mounted workspace, not URL-persisted.
Times and counts update on explicit reload; no critical browser timer is used.

Files: src/components/leads/follow-up-workspace.tsx; workspace catch-all route;
lead details route; tests/e2e/daily-follow-ups.spec.ts;
playwright.daily-follow-ups.config.ts; this report.

Manual checkpoint: verify My/Team views, filters, pagination and historical links
using local synthetic records. Reliable reminders still require DEC-009, followed
by final integrated Sprint 16 QA and owner acceptance. No email, SMS or WhatsApp
service was connected. Sprint 17 and Phase 4 are not started.