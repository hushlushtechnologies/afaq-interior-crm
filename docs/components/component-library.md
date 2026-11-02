# Afaq component library

## Styling

Use the shared Tailwind semantic tokens for colors, borders, radii,
shadows, typography, and focus indicators.

Reuse existing components before introducing another visual variation.

## Component map

| Need | Component or location |
| --- | --- |
| Buttons and loading buttons | components/ui/button.tsx |
| Icon-only actions | components/ui/icon-button.tsx |
| Text inputs | components/ui/input.tsx |
| Multiline input | components/ui/textarea.tsx |
| Native selection | components/ui/native-select.tsx |
| Password visibility | components/ui/password-input.tsx |
| Labels, descriptions, errors | components/forms/form-field.tsx |
| Checkbox field | components/forms/checkbox-field.tsx |
| Radio group | components/forms/radio-group-field.tsx |
| Switch field | components/forms/switch-field.tsx |
| Form error summary | components/forms/form-error-summary.tsx |
| Modal | components/ui/dialog.tsx |
| Side drawer | components/ui/drawer.tsx |
| Confirmation prompt | components/ui/confirmation-dialog.tsx |
| Shared overlay foundation | components/ui/overlay-dialog.tsx |
| Tabs | components/ui/tabs.tsx |
| Inline feedback | components/ui/inline-notice.tsx |
| Notifications | components/ui/toast-provider.tsx |
| Empty state | components/ui/empty-state.tsx |
| Local file selection | components/files/file-picker.tsx |
| File preview dialog | components/files/file-preview-dialog.tsx |
| Local image rendering | components/files/local-image-preview.tsx |
| Cards, badges, avatars, skeletons | Existing components/ui primitives |
| Page headings and toolbars | components/layout/page-header.tsx |
| Detail sections | components/layout/detail-section.tsx |

## Forms

FormField supplies control IDs, required and disabled state,
aria-describedby, and aria-invalid through its render function.

Spread these props onto the actual native control.

Use field errors beside their controls.
For multi-field validation failures, also show FormErrorSummary and
focus it after submission.

The sample validator is an example. Production writes must also validate
on the server.

## Overlays

See overlays-and-tabs.md for the Dialog, Drawer, ConfirmationDialog,
and Tabs APIs.

Keep validation errors inside their form.
Use notifications after completing and closing an overlay.

## Notifications

ToastProvider is currently installed around the development component library.

useToast returns notify, dismiss, clear, and count.

notify accepts title, optional description, and optional tone:
info, success, warning, or destructive.

Notifications remain until dismissed.
At most three are displayed; newer messages replace the oldest.

Use inline feedback for information users must retain.
Do not rely on a notification as the only place for an important form error.

Messages must reflect the actual result of an operation.
Do not report server persistence from a local preview.

## FilePicker

Required prop:
- label

Optional props:
- id
- description
- maxFiles, default 5
- maxFileBytes, default 10 MiB
- allowedTypes, default PNG, JPEG, WebP, and PDF
- disabled
- onFilesChange

Configure positive file and byte limits.

onFilesChange receives the current File objects after a selection change.
The picker manages its displayed selection internally.

The native input is cleared after selection so the same file can be
selected again. Obtain the current files through onFilesChange rather
than reading the native input's FileList later.

Duplicate detection uses name, size, lastModified, and MIME type.
It is not a content hash.

Valid files remain selected when other files in a batch are rejected.

## Local previews

PNG, JPEG, and WebP files with recognized image MIME types receive local
object URLs.

Images use next/image with unoptimized enabled, so local blobs are not
sent to the image optimizer.

Object URLs are revoked on removal, clearing, and component unmount.

Other accepted files show metadata. PDF content is not embedded.

A file that cannot be decoded as an image displays Preview unavailable.

## Upload boundary

There is no upload endpoint, storage write, background upload, or simulated
upload progress.

Browser checks use file metadata and improve usability.
A future upload service must independently validate actual file content,
size, authorization, and storage policy.

The preview page's limits are example settings.

## Development preview

URL: /dev/component-library

The route returns 404 outside development.
The production isolation test checks this behaviour.

Use fictional form values and sample files during review.

## Validation

Run formatting, lint, type checking, and test:all.

Browser checks cover the existing prototypes plus forms, overlays, tabs,
notifications, file selection, image decoding, resource cleanup,
responsive bounds, and automated accessibility checks.

Also review keyboard behaviour, focus visibility, mobile layout, and
message clarity manually.