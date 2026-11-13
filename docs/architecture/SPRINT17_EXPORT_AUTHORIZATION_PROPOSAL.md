# Sprint 17 — Approved lead export authorization

Status: approved by the project owner on 2026-11-13; implemented locally in Sprint 17 Part 6B.

The owner approved adding the missing Phase 2 export grant. View permission alone does not authorize export.

| Existing role | Approved leads.export scope |
| --- | --- |
| super_admin | company |
| management_director | company |
| sales_executive | assigned |
| Other roles | No grant |

Every row must satisfy BOTH leads.export and leads.view under existing owner/creator relationships. Existing role keys, memberships, other grants and final-Super-Admin protections remain intact.

Migration: 20261113000100_sprint17_lead_exports.sql. Apply only to the authorized local environment after review and backup; no production approval is implied.

The protected snapshot function returns only the fixed 19-column lead intake projection. It uses existing lead-table filter/sort semantics, including inquiry_on date filters and explicit active/archive selection. It ignores pagination and rejects more than 1000 matching rows. The CSV formatter rejects files exceeding 4 MiB and invalid values rather than silently truncating.

Private export_events records actor, timestamp, applied filters and row count when the database issues a snapshot to the application. It retains no row payload or CSV. Filters can contain confidential search terms. Rate limit: five snapshots per employee per minute. Revoked access is rechecked before every snapshot, including direct RPC calls.

A snapshot may be audited even if later CSV formatting or network delivery fails. Neither this event nor the browser status proves that a file was saved. Each explicit retry requests a new snapshot and consumes quota if issued; there is no automatic retry.

Internal notes, descriptions, activities, attachments, employee login emails and credentials are excluded. Intake budget is not revenue. CSV quoting and formula-prefix escaping are applied to every cell. Spreadsheet type inference and apostrophe display vary by viewer; import reference and budget columns as text when exact display is required. Original lead/history records are unchanged.

This approval does not enable live Meta/website ingestion, production deployment or Phase 4.