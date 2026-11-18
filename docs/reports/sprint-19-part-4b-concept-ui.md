# Sprint 19 Part 4B — private concept reference UI

## Delivered

Connects Part 4A records to the existing quotation page behind the local-only
ENABLE_LOCAL_QUOTATION_CONCEPTS flag. Existing validated lead images can be
registered, associated with a room, selected, deselected and archived. References,
image choices and history have bounded read models. Prompt notes remain internal.
The UI uses existing form controls and design tokens. No redesign or dependency added.

Preview requires quotation and lead visibility, an active reference and an available
source image/room. The server derives attachment identifiers from the reference,
uses the existing local attachment download gateway, then rechecks the reference
and its version before returning a URL. Storage paths and actor IDs are never accepted
from the browser. Preview issuance is recorded by the existing attachment audit.
Private signed images bypass Next.js image optimization and expire in 60 seconds.
UI timers clear previews; Storage validates its signed tokens. Already issued URLs
may remain usable until expiry after permission changes. No URL is logged or emailed.

Archiving changes reference metadata only; the source attachment and history remain.
Unknown command outcomes keep their request ID for a matching retry. Changed inputs
get a new request ID; duplicate constraints and optimistic versions remain authoritative.
Reload or failed authorization clears rendered references and preview URLs.

## Migration and setup

20261116000300_sprint19_concept_context.sql adds read-only context/preview RPCs.
The reviewed pending Part 4A migration 20261116000200 is a prerequisite.
Both were applied only to the dedicated local project after a private local backup.
No hosted Supabase or Vercel settings/data were changed. No destructive reset.
Both ENABLE_LOCAL_QUOTATION_CONCEPTS and ENABLE_LOCAL_LEAD_ATTACHMENTS must be true
for local previews. Existing local-only Supabase configuration and test secret remain.
Do not configure these local operations against hosted Supabase.

## Verification

Two desktop/mobile browser cases passed with actual locally validated PNG/JPEG/WebP
uploads. Checks include real image decoding, lost-response retry without duplicates,
selection, archive/history, source retention, cross-quotation preview denial, token
lifetime, UI expiry, revoked visibility, focused axe and horizontal overflow.
The browser config builds production output before starting the local app.
Passed: two concept browser cases, eight existing quotation browser cases, one
concept database case, 40 quotation unit cases, nine PDF workflow cases, 21 PDF/model
cases and one PDF Storage SQL case: 82 total. TypeScript, ESLint, formatting and
production build passed. Cleanup verified one baseline Auth user and zero leads,
quotations, concept references/events, attachments or private image objects.
The immutable concept audit trigger remains enabled.
The existing Next.js MaxListenersExceededWarning was observed and not suppressed.
Long-running memory behavior has not been assessed in this delivery.

All temporary accounts, business records and image objects are fixture-owned and
cleaned up locally. Immutable event-trigger restoration is atomic in fixture cleanup.
This test-only cleanup is not an application deletion feature or production procedure.

## Checkpoint and remaining scope

Owner Windows/browser verification is pending. Upload a synthetic reference image
through the existing local lead attachment flow, save a quotation, register the image,
preview it, select/deselect it and archive it. Verify the source file is preserved.
No AI service, provider, paid call, generation job or billing ledger is enabled.
Existing images are labelled references; selections grant no client-sharing approval
and do not add images to quotation PDFs. Live AI remains blocked by DEC-021.
Sprint 19 final validation/report and owner approval remain pending.
Sprint 20 has not started.