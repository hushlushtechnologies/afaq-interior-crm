# Sprint 10 — Roles and permissions proposal

## Status

Proposed policy awaiting user confirmation.

The role catalogue, permission identifiers, and server data contract are
implemented in Part 1.

Database grants and application enforcement have not been connected yet.

## Approved role names

- Super Admin
- Management / Director
- Sales Executive
- Project Manager
- Interior Designer
- Site Engineer
- Procurement Officer
- Finance Officer

An employee may hold multiple roles.

## Proposed scope

| Role | Scope |
| --- | --- |
| Super Admin | Full administrative access |
| Management / Director | Company-wide read access |
| Sales Executive | Assigned sales records, clients, and quotations |
| Project Manager | Assigned projects and related sales/design work, including project financials |
| Interior Designer | Assigned design/project work |
| Site Engineer | Assigned site/project work |
| Procurement Officer | Company purchasing and inventory |
| Finance Officer | Company financial work and related billing context |

Only Super Admin assigns or removes employee roles under this proposal.

Additional roles supply additional operational capabilities.
Director read access does not automatically grant every write operation.

## Existing business decisions

PM financial visibility remains allowed within permitted project scope.

PMs may approve quotations they authored.

Won conversion requires PM approval and client acceptance of the applicable
quotation version.

An employee permission does not replace a client's approval.

## Scope meanings

- own: ownership determined by trusted database relationships.
- assigned: assignment determined by trusted database relationships.
- company: permitted company-wide access.

A scope label alone is not a record-level authorization check.

Real record checks must use the relevant ownership or assignment
relationships, server-side authorization, and applicable database policies.

## Authority

PostgreSQL role assignments and grants will be authoritative.

Do not derive employee permissions from browser state or user-editable
authentication metadata.

UI visibility is for usability.
It does not authorize a server action, API, or database operation.

## Data contract

AccessSnapshot contains:
- The authenticated user ID.
- Known role keys.
- Known permission grants and their scopes.

Only trusted database query results may be parsed as a snapshot.

Unknown keys, invalid scopes, and mismatched user IDs are rejected.

## Implementation boundary

Part 1 creates identifiers and validates the future database response.

It does not add business actions, create database grants, or enforce
record access.

The remaining Sprint 10 work will connect the database, server guards,
navigation, and tests after the policy is confirmed.