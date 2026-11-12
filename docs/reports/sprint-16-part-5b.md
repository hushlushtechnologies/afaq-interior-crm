# Sprint 16 Part 5B — reminder bell and actual local scheduling verification

The existing notification bell now opens a personal reminder dialog using Part
5A actions. Includes unread count, generic notices, mark-read, lead navigation,
20-row pagination, refresh, loading/error/empty states and Dubai times. Data is
loaded on opening/refresh, not pushed live. No browser timer schedules delivery.

An actual local pg_cron minute tick was tested, not mocked. The test required
zero existing jobs and follow-ups before generating one synthetic task. A
successful cron.job_run_details entry and exactly one reminder were observed;
a repeated worker invocation did not duplicate it. The job was unscheduled in
finally and all generated business fixtures were removed. Generic successful-run
and cron execution logs remain as test evidence. No production settings/data or
external messages were used. The final local job count is zero.

Verification: one scheduler integration test passed (52.3 seconds); two desktop/
mobile bell tests passed. Bell tests cover generic text, personal list, mark-read,
and removal after rescheduling. TypeScript, lint, formatting and production build
passed. Client/log scan found no configured secret matches. Current jobs,
reminder rows and generated fixture accounts were zero after cleanup.

No new migration/dependency was required. Scheduler test must run alone against
the empty dedicated fixture database; it refuses existing tasks/jobs rather than
resetting data. Browser tests must run after it has unscheduled and cleaned up.
No full regression matrix was rerun for this UI change. Existing nonfatal Next
listener-count/NO_COLOR warnings remain. Additional pagination/access/retry UI
coverage and final integrated Sprint 16 QA remain before sprint closeout.

Files: src/components/shell/follow-up-notifications.tsx;
src/components/shell/workspace-header.tsx;
tests/integration/reminder-scheduler.spec.ts; tests/e2e/reminder-ui.spec.ts;
playwright.reminder-scheduler.config.ts; playwright.reminders-ui.config.ts;
this report.

Delivery batch 2 adds a browser isolation guard: zero jobs and follow-ups are
required before invoking the worker. Both guarded browser cases passed on rerun.
Do not delete/reset existing local records to satisfy this precondition; use an
isolated fixture database. Tests run sequentially with scheduling disabled at
completion. No full regression or scheduler test repeat was needed for the guard.

Stop at manual verification with cron disabled. Sprint 17/Phase 4 are not started.