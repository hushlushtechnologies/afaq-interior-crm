# Afaq Al Manzel Interiors CRM — Role Permission Matrix

Status: Proposal — NOT approved or implemented
Document version: 0.1
Phase: 0
Sprint: 01

## 1. Authority and interpretation

This document proposes a starting permission model.

The source plan confirms eight roles and configurable permissions.
It does not approve the detailed grants in these tables.

Every nonempty entry below is a proposal requiring business review.
A dash means no grant is proposed; it is not a finalized business decision.

No permission takes effect by saving this document.

The final model must be enforced at the server and database levels.
UI visibility is only a reflection of permissions.

Open decisions:
- DEC-003: record scope and combined-role behavior.
- DEC-004: external client access.
- DEC-005: conversion authority and PM ownership.
- DEC-013: approval delegation and self-approval.
- DEC-016: procurement authority.
- DEC-017: stock posting and exceptions.
- DEC-018 and DEC-019: financial controls.

## 2. Roles

| Code | Role |
| --- | --- |
| SA | Super Admin |
| MD | Management / Director |
| SE | Sales Executive |
| PM | Project Manager |
| ID | Interior Designer |
| SI | Site Engineer |
| PO | Procurement Officer |
| FO | Finance Officer |

Employees may hold multiple authorized roles.

Clients are external contacts, not a ninth employee role.

## 3. Permission categories

| Code | Category | Meaning |
| --- | --- | --- |
| V | View | Read the authorized record or screen. |
| C | Create | Create an authorized record or draft. |
| E | Edit | Change permitted fields in an editable state. |
| A | Archive | Archive eligible records while preserving history. |
| S | Assign | Assign an eligible owner, member or responsible employee. |
| P | Approve | Perform the specific approved business decision. |
| X | Export | Export or print the permitted data where supported. |
| G | Configure | Change the explicitly permitted configuration. |

Important distinctions:

- A means archive, not hard delete.
- P means approve, not merely view an approval.
- S does not permit assigning arbitrary employee roles.
- G applies only to the named configuration domain.
- V does not automatically include X.
- E does not permit editing immutable versions or posted transactions.
- C does not automatically permit posting, sending, converting or releasing.
- A module grant never removes the record-scope restriction.
- Codes written together represent a set: VCE means View, Create and Edit.

Additional sensitive operations are listed separately in Section 8.
They require their own explicit permission.

## 4. Proposed record scopes

| Role | Proposed scope |
| --- | --- |
| SA | Technical administration and authorized audit oversight. No automatic unrestricted business-data access. |
| MD | Organization-wide access only within explicitly approved business domains. |
| SE | Own or assigned leads/opportunities and related permitted customer records. |
| PM | Assigned projects/opportunities and authorized project-team records. |
| ID | Assigned design work and the minimum related project/customer context. |
| SI | Assigned site/project work and relevant approved execution references. |
| PO | Authorized purchasing/stock operations and minimum linked project context. |
| FO | Authorized organization financial records and necessary commercial references. |

Scope decisions remain Open under DEC-003.

A role's scope must be checked on each record.
Knowing a record identifier is not authorization.

## 5. Proposed business-module matrix

All cells in this section are proposed grants.

### 5.1 Sales and customer operations

| Module or record | SA | MD | SE | PM | ID | SI | PO | FO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Role dashboard | V | V | V | V | V | V | V | V |
| Leads | - | VSX | VCEAX | VS | - | - | - | - |
| Opportunities | - | VSX | VCEAX | VS | - | - | - | V |
| Structured requirements | - | V | VCE | VCE | V | - | - | - |
| Sales activities/follow-ups | - | V | VCEAS | VCES | - | - | - | - |
| Quotations and versions | - | VX | VCEX | VPX | - | - | - | VX |
| Clients and contacts | - | VX | VCEAX | VCE | - | - | - | V |
| Client financial history | - | VX | - | - | - | - | - | VX |

Notes:
- Sales assignment by SE is not proposed in the lead/opportunity rows.
- MD/PM assignment authority remains subject to scope and DEC-003.
- Draft quotation editing by Sales does not allow editing approved content.
- PM quotation approval is subject to DEC-013.
- Sales sees its permitted quotation commercial values; this does not grant
  access to invoices, receipts, costs or profit.
- FO opportunity access is limited to necessary commercial context.
- Designers and site staff receive minimum customer/site context through
  authorized workspaces, not unrestricted client-directory access.
- Archiving linked customers/opportunities must preserve valid history.
- Won/Lost and external sending require Section 8 permissions.

### 5.2 Projects, design and site

| Module or record | SA | MD | SE | PM | ID | SI | PO | FO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Project overview and approved scope | - | VX | V | VCESX | V | V | V | V |
| Project team assignment | - | VS | - | VS | - | - | - | - |
| Milestones/scheduling/dependencies | - | VX | V | VCESX | V | V | V | V |
| Sales-to-project handover | - | V | VCE | VCES | V | V | - | - |
| Design tasks and packages | - | VX | - | VCESPX | VCEAX | V | - | - |
| Design revision decisions | - | V | - | VP | V | V | - | - |
| Approved design releases | - | VX | - | VX | VX | VX | V | - |
| Site tasks | - | VX | - | VCESX | V | VCEX | - | - |
| Site daily reports/photos | - | VX | - | VX | - | VCEX | - | - |
| Inspections/snags | - | VX | - | VCESX | V | VCEX | - | - |
| Material requests | - | V | - | VCES | - | VCE | V | - |
| Operational handover/closure | - | V | - | VCE | - | VCE | - | - |

Notes:
- Project creation through Won conversion is a protected operation.
  The project row does not grant unrestricted manual project creation.
- PM project editing must preserve accepted scope and its change history.
- ID archiving applies only to eligible drafts/tasks.
  It does not delete submitted or approved revision evidence.
- PM design P is only the internal PM decision.
  It cannot impersonate or replace the external client decision.
- SI may prepare completion evidence; final acceptance/closure authority
  remains unresolved under DEC-020.
- Viewing a project does not grant access to all documents attached to it.
- Technical design files and procurement execution extracts may have
  different access scopes.
- Actual release, inspection acceptance and closure require Section 8.

### 5.3 Procurement, inventory and finance

| Module or record | SA | MD | SE | PM | ID | SI | PO | FO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vendors and contacts | - | VX | - | V | - | - | VCEAX | V |
| Materials/catalogue | - | VX | - | V | V | V | VCEAX | V |
| Purchase requests | - | VX | - | VCE | - | VCE | VCESX | V |
| Supplier quotations/comparison | - | VX | - | V | - | - | VCEX | VX |
| Purchase orders | - | VX | - | V | - | - | VCEX | VX |
| Goods receipts | - | VX | - | V | - | V | VCEX | V |
| Stock balances/movements | - | VX | - | V | - | V | VCEX | VX |
| Stock reservations | - | V | - | V | - | V | VCE | - |
| Transfers/adjustments/counts | - | VX | - | V | - | V | VCEX | VX |
| Project budgets | - | VX | - | - | - | - | - | VCEX |
| Customer invoices | - | VX | - | - | - | - | - | VCEX |
| Customer payments/allocations | - | VX | - | - | - | - | - | VCEX |
| Supplier bills/project expenses | - | VX | - | - | - | - | - | VCEX |
| Financial commitments/margins | - | VX | - | - | - | - | - | VX |

Notes:
- No purchase approval authority is granted by this proposal.
  Monetary thresholds and approvers remain Open under DEC-016.
- PO creation/editing of orders or receipts may prepare drafts only until
  the relevant issue/posting authority is approved.
- SI purchase requests represent site requests, not authorization to order.
- PO stock C/E does not authorize silent changes to posted movements.
- Stock posting and adjustment approval remain Open under DEC-017.
- Procurement commercial amounts are visible only to authorized purchasing
  participants; this does not grant general project finance access.
- PM budget/cost visibility requires an explicit business decision.
- FO record creation/editing does not bypass invoice issuance, payment
  posting, correction or approval policies.
- No hard deletion of posted financial records is proposed.

### 5.4 AI, reporting and shared features

| Module or action | SA | MD | SE | PM | ID | SI | PO | FO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI generation/history | - | V | VCE | VCE | VCE | - | - | - |
| AI usage oversight | VG | V | - | - | - | - | - | - |
| Operational reports | - | VX | VX | VX | VX | VX | VX | VX |
| Financial reports | - | VX | - | - | - | - | - | VX |
| Authorized attachments/comments | - | VCE | VCE | VCE | VCE | VCE | VCE | VCE |
| Personal saved views/columns | VCEAG | VCEAG | VCEAG | VCEAG | VCEAG | VCEAG | VCEAG | VCEAG |
| Global search | V | V | V | V | V | V | V | V |
| Personal notifications | VE | VE | VE | VE | VE | VE | VE | VE |

Notes:
- Operational report scope follows the role's authorized domain.
  This row does not grant every report to every role.
- Search results must follow existing grants; SA search is limited to
  its authorized administration scope.
- A saved view changes presentation, not permissions.
- Attachment/comment access inherits the relevant record and file policy.
- AI asset E applies to editable metadata/drafts, not fabricated changes
  to historical provider results.
- AI generation requires an explicit generation permission and budget check.
- MD oversight does not automatically grant AI external-sharing approval.
- An export is permitted only where the underlying record, report or
  file type supports it and the role has the applicable X permission.

## 6. Proposed administration matrix

| Administration area | SA | MD | SE | PM | ID | SI | PO | FO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Employee directory/profile administration | VCEAS | V | - | - | - | - | - | - |
| Invitations and deactivation | VCES | - | - | - | - | - | - | - |
| Roles and permissions | VG | V | - | - | - | - | - | - |
| Company profile/branding | VG | V | - | - | - | - | - | - |
| Sales pipeline configuration | VG | V | - | - | - | - | - | - |
| Task status configuration | VG | V | - | - | - | - | - | - |
| Currency/timezone/numbering | VG | V | - | - | - | - | - | V |
| Approval-rule configuration | VG | V | - | - | - | - | - | - |
| Notification delivery configuration | VG | - | - | - | - | - | - | - |
| AI provider/quota configuration | VG | V | - | - | - | - | - | - |
| Integration configuration | VG | - | - | - | - | - | - | - |
| File/storage policy configuration | VG | - | - | - | - | - | - | - |
| Audit oversight | VX | V | - | - | - | - | - | - |
| Delivery/integration failure oversight | V | - | - | - | - | - | - | - |

Administration restrictions:
- SA configuration records an approved business policy; it does not
  authorize SA to invent purchasing, tax or approval rules.
- Role assignment S is limited to explicitly authorized administrators
  and approved eligibility rules.
- No self-escalation or final-administrator removal behavior is assumed.
- Technical configuration visibility must never reveal secret values.
- Audit export requires privacy review and appropriate redaction.
- Audit visibility does not automatically reveal all attached customer
  files or unrestricted record contents.
- User deactivation must preserve historical authorship and approval evidence.
- Personal profile/preference editing is separate from administration.

## 7. Personal actions

Proposed for all active employees:
- View and edit permitted personal profile fields.
- Manage allowed personal notification preferences.
- Manage their own saved views and column visibility.
- Read and mark their own notifications.
- Use authentication/session controls provided by the approved design.

These actions do not permit changing one's own roles, finance access,
approval authority or organization configuration.

Mandatory/security notification rules may override personal preferences
under the approved business policy.

## 8. Sensitive operations requiring explicit permissions

These are separate from general module Create/Edit permissions.

| Operation | Proposed authority or unresolved decision |
| --- | --- |
| Mark opportunity Won | Proposed authorized Sales; final authority and prerequisites require DEC-005. |
| Mark opportunity Lost | Proposed authorized Sales; configured reason and DEC-010 apply. |
| Reopen/correct a Won or Lost outcome | Not granted; requires approved correction policy. |
| Approve/reject quotation version | Authorized PM; delegation/self-approval require DEC-013. |
| Send quotation externally | Authorized Sales, only for an eligible PM-approved version. |
| Record client quotation acceptance | Authorized operator under the evidence policy in DEC-014. |
| Generate AI image | Explicitly enabled SE/PM/ID users, subject to processing authorization and quota. |
| Approve AI concept for external sharing | Not granted; business must name eligible approvers. |
| Share approved AI concept externally | Authorized sender after the required sharing approval. |
| Approve/reject design as PM | Assigned/authorized PM for that exact revision. |
| Approve/reject design as client | Authorized external reviewer for that exact revision. |
| Release design for execution | Proposed authorized PM after both approvals for the same revision. |
| Accept inspection/site completion | Not granted; business must confirm authority. |
| Approve purchase request/order | Not granted until DEC-016 defines authority and thresholds. |
| Issue approved purchase order | Proposed PO after applicable approval and explicit issue permission. |
| Post goods receipt | Not granted until receiving authority and exception rules are approved. |
| Post stock issue/receipt/transfer | Not granted until DEC-017 defines authority. |
| Approve/post stock adjustment | Not granted until DEC-017 defines authority and controls. |
| Issue invoice | Proposed FO under approved numbering, tax and issuance policy. |
| Post payment/allocation | Proposed FO under approved receipt/allocation controls. |
| Void/credit/refund/correct financial record | Not granted until DEC-018 defines permitted operations. |
| Close/reopen project | Not granted until DEC-020 defines gates and authority. |
| Retry failed external operation | Explicit authorized operator under bounded retry and duplicate-protection rules. |
| Change approval/finance policy | Record only an explicitly approved business decision; audit the change. |
| Export protected data | Applicable X grant plus source-record access and export safeguards. |

The final permission catalog may use implementation identifiers later.
This document specifies business capabilities, not database permission names.

## 9. External client access

External clients do not receive any employee role from Section 2.

Proposed permitted capabilities:
- Open a valid review session for a designated design submission.
- View only the submitted revision and approved client-visible files.
- Read client-visible review comments.
- Submit an allowed comment or revision request.
- Approve or reject that exact revision when authorized.

Not permitted:
- Browse employee directories or internal navigation.
- Search internal CRM records.
- Access another client, project or revision outside the grant.
- Read internal comments, audit oversight or financial information.
- Approve on behalf of the PM.
- Treat approval of one revision as approval of later revisions.
- Upload arbitrary files unless explicitly included in the approved design.

Authentication method, link expiry, identity verification, revocation,
download policy and multiple-reviewer behavior remain Open under DEC-004.

Client access must be scoped and validated on every relevant request.

## 10. Multi-role employees

The supplied plan requires support for multiple roles.

Unresolved:
- Whether grants combine by union.
- Whether explicit denials override grants.
- Whether conflicting duties may be combined.
- Whether one person may author and approve the same record.
- Whether organization-wide access overrides assigned-record scope.

Recommendation for review:
- Grant each role explicitly.
- Evaluate action, record scope, current state and business prerequisites.
- Treat separation-of-duty rules independently of role combinations.
- Do not use multiple roles to bypass approval prerequisites.
- Recheck access after deactivation, membership change or role revocation.

This recommendation is not an approved authorization algorithm.
DEC-003 and DEC-013 must be resolved before final implementation.

## 11. Archive and deletion policy

No routine hard-delete permission is proposed.

Archive may apply to eligible:
- Leads.
- Opportunities.
- Clients.
- Vendors.
- Catalogue entries.
- Personal saved views.
- Editable design drafts/tasks where permitted.

Archive must not:
- Remove required commercial or operational evidence.
- Break references used by active records.
- Erase approvals or audit events.
- Delete posted financial or stock history.
- Conceal a protected outcome change.

Submitted/approved revisions and posted financial/stock records require
approved correction or supersession processes.

Retention, legal deletion and controlled cleanup require DEC-008.
Any production deletion requires explicit authorization.

## 12. Permission acceptance checks

ACC-001 — Multi-role support:
An employee can receive multiple authorized roles without duplicating identity.

ACC-002 — Enforcement:
Calling an operation directly must not bypass server/database permissions.

ACC-003 — External isolation:
A client review session cannot obtain ordinary employee access.

Additional proposed verification:
- Own/assigned access does not return another employee's restricted records.
- Project membership does not imply unrestricted finance access.
- Search, dashboard counts and reports obey record scope.
- Export permission is checked independently of screen visibility.
- Private file download is checked independently of knowing the URL.
- Revoked membership prevents subsequent protected requests.
- Editing a request cannot substitute another project or revision.
- SA technical administration does not silently bypass PM/client approvals.
- Combined roles cannot bypass a required business-state prerequisite.
- Audit history records permission and sensitive configuration changes.

Detailed acceptance IDs and test mappings will be maintained in the
acceptance and traceability documents.

## 13. Review checklist

Business owner to review:
- Each role's record scope.
- Sales assignment and conversion authority.
- PM access to commercial and financial data.
- Management's organization-wide visibility.
- Super Admin business-data access, if any.
- Quotation self-approval and delegation.
- AI sharing approval authority.
- Purchase approval thresholds and delegation.
- Goods receipt and stock-posting authority.
- Finance issuance, posting and correction controls.
- Site acceptance and project closure authority.
- Multi-role conflicts and explicit-denial behavior.
- Export restrictions and audit visibility.
- External reviewer identity and scope.

## 14. Current status

All eight employee roles are represented.

All eight requested permission categories are defined:
View, Create, Edit, Archive, Assign, Approve, Export and Configure.

No detailed permission proposal is confirmed by this document.
No access-control implementation or permission tests have been executed.