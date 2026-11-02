# Sprint 05 — Reusable Design Foundation

Status: Implemented in the review copy; awaiting Windows tests and visual approval.

## Direction

Warm beige, ivory, sand and espresso.
The two supplied references inform rounded composition, spacing, floating
surfaces and contrast. Their branding, purple/yellow palettes and imagery
are not copied.

This sprint is the foundation and component preview.
Application navigation and CRM screens remain later authorized work.

## Tailwind architecture

Tailwind 4 is retained with the existing Next.js configuration.

All color values live in src/app/globals.css.
CSS variables are mapped through @theme inline to semantic utilities:
bg-background, bg-card, text-foreground, text-muted-foreground,
bg-primary, text-primary-foreground, border-input and outline-ring.

Components use Tailwind utilities and typed variants.
cn combines clsx with tailwind-merge so consumer class overrides resolve
consistently.

Global CSS contains tokens, minimal element defaults and the shared
glass-panel utility. Components have no separate stylesheets or hardcoded
color values.

## Palette

| Purpose | Token | Value |
| --- | --- | --- |
| Canvas | background | #F5F1EA |
| Card | card | #FFFCF7 |
| Soft surface | muted | #EFE8DF |
| Text | foreground | #302820 |
| Secondary text | muted-foreground | #6B5E52 |
| Sand | secondary | #E7DDD0 |
| Taupe | taupe | #B4A18D |
| Accent decoration | accent | #96775C |
| Accent surface | accent-soft | #F0E2D3 |
| Accent text | accent-foreground | #5B412C |
| Decorative border | border | #DDD3C7 |
| Control boundary | input | #998571 |
| Focus | ring | #78583E |
| Destructive | destructive | #A12C30 |
| Success | success | #245C3B |
| Warning | warning | #795014 |
| Information | info | #334C80 |

The proposed secondary text was darkened from #75685B because it fell
below 4.5:1 on the muted surface.

Accent and taupe are decorative colors, not general small-text colors.
Use the documented foreground/background pairs.

Control border against the card is approximately 3.45:1.
Focus ring against the card is approximately 6.29:1.
Automated tests check the defined body/status text pairs at 4.5:1.

Chart tokens are a tonal palette. Future charts also need labels/patterns
where colors alone cannot distinguish meaning.

## Typography

Self-hosted Manrope Variable via @fontsource-variable/manrope.
License: OFL-1.1.
No external font CDN request.

- Body: readable regular text and relaxed line height.
- Headings: semibold with responsive sizes.
- Inputs: 16px.
- Eyebrow: restrained uppercase section label.
- Numeric values: tabular-nums.
- English is implemented; bilingual localization was not approved here.

## Spacing and shape

Base spacing unit: 4px through Tailwind.
Control radius: 14px.
Card radius: 24px.
Panel radius: 32px.

Buttons have minimum 44px height.
Icon buttons are 48px square.

Use shadow-card, shadow-float and shadow-control sparingly.

## Component inventory

| File in src/components/ui | Public API |
| --- | --- |
| button.tsx | Button, ButtonProps, buttonClassName |
| icon-button.tsx | IconButton |
| input.tsx | Input |
| textarea.tsx | Textarea |
| label.tsx | Label |
| card.tsx | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| badge.tsx | Badge |
| avatar.tsx | Avatar |
| separator.tsx | Separator |
| skeleton.tsx | Skeleton |
| surface.tsx | Surface, GlassPanel |
| page-container.tsx | PageContainer |
| typography.tsx | Heading, Text, Eyebrow |
| icon.tsx | Icon |
| motion-panel.tsx | MotionPanel |

Native props and refs are passed through where the component supports them.

Button:
primary, secondary, outline, ghost, destructive.
Sizes: sm, md, lg.
Loading is disabled and aria-busy.

IconButton:
Requires a label and Lucide icon.
Decorative icons do not duplicate the accessible name.

Input/Textarea:
Use an associated Label, stable IDs and aria-describedby for help/errors.
Use aria-invalid for invalid state.
Do not use placeholder text as the only label.
Native required/disabled behavior is retained.

Card:
Use compound parts for consistent padding.
CardTitle renders h3; maintain correct surrounding heading order.

Badge:
neutral, success, warning, destructive, info, outline.
Status text remains visible; color is not the only meaning.

Avatar:
name is required for accessible identity.
Initials work without external images.
A supplied image falls back on error.
Only use approved/private-access-safe image sources.

Separator:
Decorative by default; decorative=false provides separator semantics.

Skeleton:
Decorative by default. Put a single accessible loading announcement on
the surrounding loading region, not every placeholder.

Surface:
solid, muted, inverse, glass.
Dense forms and financial content use solid surfaces.
Glass has an opaque fallback and @supports-controlled blur.

PageContainer:
Shared max width and responsive horizontal padding.

Heading:
Semantic h1–h4 and hero/xl/lg/md visual sizes.
Use one primary page heading.

## Motion

MotionConfig uses the user's reduced-motion setting.
The shared preference hook uses useSyncExternalStore with a conservative
server snapshot to avoid hydration mismatch.

MotionPanel provides a small hover lift.
The preview demonstrates an explicit state transition.
Spatial animation and skeleton pulsing stop for reduced-motion users.

This sprint does not implement future dialogs, drawers, Kanban or navigation.

## Icons

Lucide React is the primary library.
Icon defaults: 20px, 1.75 stroke.
Available wrapper sizes: 16px, 20px, 24px.

React Icons is not needed for this initial set.

## Lottie

No justified approved animation asset was supplied.
No Lottie dependency or unlicensed animation was added.

Add a reusable adapter when an approved asset and use case exist.
This follows Sprint 05's conditional Lottie requirement.

## Preview

Development route:
http://localhost:3000/dev/design-system

Run npm.cmd run dev to see it.

Production build:
The preview returns 404.
No environment flag enables it in production.

The home page retains its starter role and links to the preview only
in development.

The specimen header is not the Sprint 06 application navigation.

## Usage examples

~~~tsx
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Plus } from "lucide-react";

export function ActionsExample() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit">Save draft</Button>
      <Button variant="outline">Cancel</Button>
      <IconButton label="Add item" icon={Plus} variant="secondary" />
    </div>
  );
}
~~~

~~~tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FieldExample() {
  return (
    <div className="space-y-2">
      <Label htmlFor="example-name" required>Name</Label>
      <Input id="example-name" name="name" required aria-describedby="example-help" />
      <p id="example-help" className="text-sm text-muted-foreground">
        Enter a demonstration name.
      </p>
    </div>
  );
}
~~~

Use event handlers within a Client Component.
Do not nest a button inside a link. For links, reuse buttonClassName.

## Verification

- npm.cmd run format:check
- npm.cmd run lint
- npm.cmd run typecheck
- npm.cmd test
- npm.cmd run test:design

Production suite builds the app and verifies preview isolation.
Design suite uses a separate development server on port 3101.
Do not run those suites concurrently against the same .next directory.

Automated accessibility checks do not certify complete accessibility.
Manual keyboard, zoom, assistive-technology and visual checks remain required.