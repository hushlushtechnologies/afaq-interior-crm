# Sprint 18 Part 3A — Private database pricing

Status: delivered for local verification. Sprint 18 is still in progress.

## Scope

Migration 20261113000300 creates crm_quotes and five private functions:
exact_keys, decimal_value, discount_value, money_text and calculate.
There are no public RPCs, business tables, tax defaults or customer operations.
Existing records, permissions, roles, RLS and final-Super-Admin protections are
unchanged. No production project, email service or external integration is used.

The PostgreSQL numeric calculation matches the Part 2 TypeScript bigint policy:
rounded line subtotal, line discount, allocated overall discount, then line VAT.
Monetary output is two-decimal text. Allocation uses integer-cent div/mod and
stable item IDs for ties, avoiding precision loss at large allocation boundaries.
Strict object keys and decimal strings reject supplied totals and malformed input.

This helper accepts explicit mathematical tax inputs, not an approved tax catalog.
It does not authorize access to leads, validate room ownership, verify VAT numbers
or establish qualification. Future protected saves must perform those checks and
enforce the approved company tax configuration. No rate is inserted by default.
The server contract will normalize text before invoking the database helper.

## Local migration safety

Verified the local project afaq-interiors-crm-s09-local, Docker database container
supabase_db_afaq-interiors-crm-s09-local and published database port 57422.
Created a private full local pg_dump archive outside the repository; verified
its directory using pg_restore --list. A restore drill was not performed.
Reviewed the additive SQL and applied it with supabase migration up --local.
Migration history confirms version 20261113000300; crm_quotes contains five
functions and zero tables. No destructive command was executed.

## Verification

- Quotation unit selection: 31 tests passed.
- Dedicated quotation database selection: 3 tests passed.
- SQL fixtures: 36 assertions plus actual anon/authenticated/service_role denials.
- TypeScript/PostgreSQL comparisons: 500 deterministic synthetic quotations and
  5 large-value/minimum-value boundary cases; every output line and total matches.
- TypeScript, ESLint, new TypeScript/config formatting and git diff --check pass.
- All database fixtures use transactions and rollback; no fixture records remain.

An initial fixture failed because to_jsonb needed an explicit text cast.
The fixture was corrected and the complete database selection passed afterward.
The existing NO_COLOR/FORCE_COLOR test-runner warning remains nonblocking.
Windows commands and a full production build were not executed in this part.
No new browser UI exists here. Quotation business RBAC/RLS, concurrent saves,
numbering, retry receipts, audit and browser workflows remain pending.

## Next delivery and checkpoint

Part 3B will add protected quotation records, server numbering, authoritative
draft saves, authorization, RLS, audit, optimistic versions and retry receipts.
Then connect the builder, list and Lead Details within Sprint 18.
Do not claim Sprint 18 completed or start Sprint 19 without explicit approval.
If this migration has been applied, preserve it; use a later additive repair
migration for any correction rather than editing history or dropping the schema.