# Sprint 07 — Dashboard and Leads Prototype

## Delivery status

Implementation supplied for local installation and review.

Assistant execution was unavailable because the cloud environment was offline.
Lint, type checking, production build, browser tests, and visual approval are
pending the user's local results.

## Delivered

- Development-only fictional CRM fixtures and a shared local-state provider.
- Dashboard metrics, charts, date filtering, and sample project summaries.
- Shared simulated loading, empty, and error states.
- Leads table with search, filters, sorting, pagination, and column visibility.
- Leads Kanban with pointer dragging and accessible native stage controls.
- Lead Details with overview, contact previews, assignment, requirements,
  rooms, reference illustrations, notes, activity, attachments, and quotations.
- Navigation context for Lead Details.
- Prototype and production-isolation browser checks.

## Reusable UI and styling

Existing design-system primitives are reused throughout.

New shared pieces include NativeSelect and DetailSection.
Lead cards, badges, stage controls, filters, room references, and charts are
separate reusable components.

Styling uses Tailwind utilities and the existing beige semantic tokens.

## Data and behavior boundaries

Fixtures are supplied only in development.

Stage, owner, requirement, and note changes stay in memory in the current tab.
Navigation within the workspace shares that state.
A refresh or Reset demo restores the fixture data.

Contact actions do not send messages, emails, or calls.
Attachment entries do not represent stored files.
Reference illustrations do not represent client uploads.
Follow-up actions do not schedule reminders.

Won, Lost, and reopening closed leads are blocked in the prototype.
Quotation approval, client acceptance, and project conversion are not connected.

Production Lead Details routes return 404.
The remaining production workspace is still a UI scaffold without real
authentication or business data.

## Validation commands

npm.cmd install
npx.cmd playwright install chromium
npm.cmd run format
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:all

The production test configuration runs the production build before its tests.

## Manual review

Review Dashboard, All leads, Sales pipeline, and Lead Details.

Check desktop and mobile layout, keyboard navigation, simulated states,
local-state changes, blocked outcomes, and beige theme consistency.

## Approval

Sprint 07 requires local test results and UI/UX confirmation.
Sprint 08 has not started.