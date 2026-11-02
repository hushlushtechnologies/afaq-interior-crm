# Dialogs, drawers, confirmations, and tabs

## Shared foundation

OverlayDialog provides the common behaviour for Dialog and Drawer.

It uses the existing Radix Dialog dependency for modal semantics, focus trapping,
background scroll locking, and focus restoration.

All styling uses Tailwind and the existing semantic theme tokens.

## Dialog

Import Dialog from "@/components/ui/dialog".

Required props:
- open
- onOpenChange
- title
- description

Optional props include trigger, children, footer, initialFocusRef,
returnFocusRef, closeLabel, dismissible, dismissOnOutsideClick, and className.

Pass a native button or the shared Button as the trigger.

Use initialFocusRef to select the first focused element.
Without it, Radix chooses the initial focus target.

Focus normally returns to the trigger.
Use returnFocusRef when an action removes the trigger.

For a footer submit button outside its form element, connect it with the
native form attribute and the form's ID.

## Drawer

Import Drawer from "@/components/ui/drawer".

Drawer supports the Dialog props plus side: "left" or "right".
The default side is right.

A drawer remains a modal dialog. It is not a navigation landmark.

## ConfirmationDialog

Import ConfirmationDialog from "@/components/ui/confirmation-dialog".

Required props include open, onOpenChange, title, description,
confirmLabel, and onConfirm.

Cancel receives initial focus.
Outside clicks do not dismiss the confirmation.
Escape cancels when pending is false.

The parent owns the operation and its result.

For an asynchronous operation:
- Set pending while the operation runs.
- Handle failures in the parent and pass the error text.
- Close the dialog after the operation succeeds.
- Clear pending when the operation finishes.

The component does not execute API requests or automatically declare success.

Use tone="destructive" when appropriate.

## Tabs

Import Tabs and TabItem from "@/components/ui/tabs".

Required props:
- label: accessible name for the tab list
- items: unique IDs, labels, content, and optional disabled flags
- value: selected tab ID
- onValueChange: updates the selected ID

Tabs activate automatically when keyboard focus moves with arrow keys.
Home selects the first enabled tab.
End selects the last enabled tab.
Disabled tabs are skipped.

Panels remain mounted to preserve their local values.
Inactive panels are hidden and inert.

## Preview

Development URL: /dev/component-library

The examples use fictional information and local state.
No record is saved, deleted, or transmitted.

## Validation status

Browser tests cover focus trapping and restoration, cancellation, local
validation, drawer drafts, tab keyboard behaviour, retained tab content,
reduced motion, responsive bounds, and automated accessibility checks.

Execution results must be recorded from the local test run.
Automated accessibility checks also need manual keyboard and visual review.