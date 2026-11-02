# Workspace page access

## Server authority

Workspace pages load the current account's database-backed access snapshot.

The catch-all workspace route checks the module capability before
rendering its content.

The explicit development Lead Details route performs its own check.
Its metadata also avoids exposing sample record details without demo access.

Client navigation visibility is a separate usability layer.

## Missing roles

A confirmed account without employee roles receives Access not configured.

It remains authenticated and can sign out.
It is not redirected repeatedly through login.

## Denied capability

A known workspace without the required capability renders Access not available.

This is a server-rendered permission notice, not an HTTP 403 page response.

Server operations and database RPCs independently enforce permission
denials. UI content gates do not authorize APIs.

## Unavailable access service

Invalid or unavailable access information fails closed.
The application offers a retry rather than showing workspace content.

Framework redirects are not swallowed by access-error handling.

## Demo records

The existing editable company-wide record demo requires company-wide
lead viewing, updating, assignment, and project-financial read access.

Accounts without this full set do not receive that fictional dataset.

They receive their permitted workspace landing and placeholder pages.

These placeholders do not implement assigned-record queries.

Real ownership, assignment, financial-field filtering, and record RLS
must be implemented with the relevant business data services.

## UI context

AccessProvider receives a validated server snapshot.

It supplies visible modules, visible search links, and path checks
for navigation integration in Part 3B.

A client-modified snapshot cannot authorize a server operation.

## Tests

Temporary authentication accounts now receive Sales by default.

Tests can request another role or role null.
Only test-created account IDs are cleaned up.

Production checks cover missing roles, direct URL denial for Sales
and Designer, and PM financial module availability.

No role assignment UI or employee invitation workflow is introduced
in Part 3A.

## Validation status

Implementation supplied for local checks.
The cloud environment was unavailable for execution.