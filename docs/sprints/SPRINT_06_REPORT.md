# Sprint 06 — Application Shell and Navigation

Phase: 1
Sprint: 06
Status: Implementation delivered; execution and visual approval pending.

## Scope

- Shared navigation configuration.
- Primary module icon rail.
- Expandable contextual navigation.
- Responsive mobile/tablet drawer.
- Header and breadcrumbs.
- Navigation-only search and keyboard shortcut.
- Notification/profile preview controls.
- Reusable page header and toolbar.
- Contextual details panel.
- Whitelisted placeholder routes.
- Loading state.
- Reduced-motion styling.
- Shell and production regression tests.

## Reuse

Uses the approved Sprint 05 tokens, typography, icons, buttons, avatar,
surfaces, skeletons and class-merging utility.

Radix primitives provide dialog, menu and tooltip interaction behavior.

Navigation data is shared by routes, rail, contextual links, breadcrumbs
and search.

No module implementation is duplicated per route.

## Preview boundaries

- Search covers navigation pages only.
- Future modules are explicitly labeled UI placeholders.
- No customer records, financial totals or operational figures.
- No authentication or permission implementation.
- No fake login/logout operation.
- Development user fixture is server-gated to development.
- Production receives no development employee fixture.
- The design-system preview remains development-only.

## Database and services

No database changes or migrations.
No external integration activation.
No paid service.
No production credentials required.

## Verification status

The cloud environment failed before Sprint 06 execution.

Not executed by the assistant:
- Dependency installation.
- TypeScript.
- ESLint.
- Formatting.
- Production build.
- Browser tests.
- Accessibility scans.

The supplied tests are specifications awaiting execution, not passed results.

Expected test definitions:
- Production: 8 cases across existing desktop/mobile projects.
- Design foundation: existing 12 cases.
- Shell development suite: 15 cases.

## User verification

Run all checks sequentially with other app servers stopped.

Review:
- Desktop rail and contextual panel.
- Collapse/expand behavior.
- Tablet rail and drawer.
- Mobile drawer and focus restoration.
- Active links and breadcrumbs.
- Ctrl+K search.
- Profile/notification navigation.
- Contextual details panel.
- Reduced motion.
- Desktop/mobile screenshots.
- Unknown-route behavior.
- Absence of fake authentication claims.

Automated accessibility checks do not certify complete accessibility.

## Outstanding issues

No runtime outcome is known yet.
Reported failures must be resolved within Sprint 06.

Phase 0 deferred database/production obligations remain unchanged.

## Approval gate

Await Windows check results and visual confirmation.

Do not start Sprint 07 until explicitly approved.