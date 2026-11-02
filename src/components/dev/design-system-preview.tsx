'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Bell,
  Check,
  Layers,
  LayoutGrid,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { cn, focusRing } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MotionPanel } from '@/components/ui/motion-panel';
import { PageContainer } from '@/components/ui/page-container';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassPanel, Surface } from '@/components/ui/surface';
import { Textarea } from '@/components/ui/textarea';
import { Eyebrow, Heading, Text } from '@/components/ui/typography';

const swatches = [
  { name: 'Canvas', token: '--background', style: 'bg-background' },
  { name: 'Ivory', token: '--card', style: 'bg-card' },
  { name: 'Soft linen', token: '--muted', style: 'bg-muted' },
  { name: 'Sand', token: '--secondary', style: 'bg-secondary' },
  { name: 'Taupe', token: '--taupe', style: 'bg-taupe' },
  { name: 'Espresso', token: '--primary', style: 'bg-primary' },
  { name: 'Warm accent', token: '--accent', style: 'bg-accent' },
  { name: 'Accent wash', token: '--accent-soft', style: 'bg-accent-soft' },
];

function PreviewSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id + '-title'} className="scroll-mt-8 space-y-6">
      <div className="max-w-2xl space-y-2">
        <Eyebrow>{id.replaceAll('-', ' ')}</Eyebrow>
        <Heading id={id + '-title'}>{title}</Heading>
        <Text tone="muted">{description}</Text>
      </div>
      {children}
    </section>
  );
}

export function DesignSystemPreview() {
  const [message, setMessage] = useState('Interactions are previews; no records are saved.');
  const [motionActive, setMotionActive] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Preview submitted successfully. No information was stored.');
  }

  return (
    <div className="relative isolate min-h-svh bg-linear-to-br from-background via-background to-secondary/60 py-4 sm:py-7">
      <a
        href="#main-content"
        className={cn(
          'sr-only fixed top-3 left-3 z-50 rounded-control bg-primary px-4 py-3 text-sm text-primary-foreground focus:not-sr-only',
          focusRing,
        )}
      >
        Skip to preview content
      </a>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-8 right-0 -z-10 size-72 rounded-full bg-accent-soft/60 blur-3xl"
      />

      <PageContainer>
        <GlassPanel className="overflow-hidden shadow-float">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-control bg-primary text-xl font-semibold text-primary-foreground"
              >
                A
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">AFAQ AL MANZEL</p>
                <p className="text-xs text-muted-foreground">Interiors · Design foundation</p>
              </div>
            </div>
            <nav
              aria-label="Preview sections"
              className="flex max-w-full flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1"
            >
              {[
                ['Overview', '#main-content'],
                ['Palette', '#palette'],
                ['Components', '#components'],
                ['Motion', '#motion'],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className={cn(
                    'rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground motion-reduce:transition-none sm:px-4',
                    focusRing,
                  )}
                >
                  {label}
                </a>
              ))}
            </nav>
            <Badge tone="outline">Sprint 05 · Preview</Badge>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="space-y-14 px-5 py-8 outline-none sm:px-8 sm:py-12 lg:space-y-18"
          >
            <section
              aria-labelledby="preview-title"
              className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]"
            >
              <div className="space-y-6">
                <Badge>
                  <Icon icon={Sparkles} size="sm" />A considered foundation
                </Badge>
                <Heading as="h1" size="hero" id="preview-title">
                  Beige by design.
                  <br />
                  Calm by default.
                </Heading>
                <Text tone="muted" className="max-w-lg text-lg">
                  Warm materials, generous space and precise details. One reusable visual language
                  for the entire Afaq workspace.
                </Text>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() =>
                      document.getElementById('components')?.scrollIntoView({
                        block: 'start',
                        behavior: 'instant',
                      })
                    }
                  >
                    Explore components <Icon icon={ArrowUpRight} />
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon icon={Check} size="sm" /> Responsive foundation
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Development-only specimens · No customer or operational data
                </p>
              </div>

              <Surface tone="inverse" className="relative space-y-6 p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium tracking-widest text-inverse-muted uppercase">
                    Surface study / 01
                  </p>
                  <span className="rounded-full border border-inverse-muted/40 p-2">
                    <Icon icon={Layers} />
                  </span>
                </div>
                <Heading as="h2" size="lg">
                  Soft outside.
                  <br />
                  Structured within.
                </Heading>
                <Card className="shadow-float">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <Eyebrow>Reusable specimen</Eyebrow>
                      <Badge tone="success">Ready to review</Badge>
                    </div>
                    <CardTitle>Details make the difference.</CardTitle>
                    <CardDescription>
                      Opaque content surfaces keep forms and numbers clear.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Avatar name="Design team" size="sm" />
                      <Avatar name="Project team" size="sm" />
                      <span className="text-xs text-muted-foreground">Initials specimen</span>
                    </div>
                    <span className="font-semibold tabular-nums">01 / 13</span>
                  </CardContent>
                </Card>
                <p className="text-sm text-inverse-muted">Warm ivory · Sand · Espresso</p>
              </Surface>
            </section>

            <Separator />

            <PreviewSection
              id="palette"
              title="A palette with purpose."
              description="Every surface, text color and status comes from a semantic token. Accent colors remain restrained."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {swatches.map((swatch) => (
                  <Card key={swatch.name} className="overflow-hidden shadow-none">
                    <div
                      aria-hidden="true"
                      className={cn('h-20 border-b border-border', swatch.style)}
                    />
                    <div className="space-y-1 p-3">
                      <h3 className="text-xs font-semibold">{swatch.name}</h3>
                      <p className="font-mono text-[10px] text-muted-foreground wrap-anywhere">
                        {swatch.token}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Neutral</Badge>
                <Badge tone="success">Success</Badge>
                <Badge tone="warning">Needs attention</Badge>
                <Badge tone="destructive">Error</Badge>
                <Badge tone="info">Information</Badge>
                <Badge tone="outline">Outline</Badge>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Chart palette</CardTitle>
                  <CardDescription>
                    A tonal sequence for future charts; essential distinctions will also use labels.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div aria-label="Five chart palette colors" className="grid grid-cols-5 gap-2">
                    {['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'].map(
                      (color, index) => (
                        <div key={color} className="space-y-2">
                          <div aria-hidden="true" className={cn('h-12 rounded-control', color)} />
                          <p className="text-center text-xs text-muted-foreground">
                            Tone {index + 1}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            </PreviewSection>

            <PreviewSection
              id="typography"
              title="Quiet confidence. Clear hierarchy."
              description="Self-hosted Manrope, a consistent type scale and tabular numerals for numeric data."
            >
              <Card>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Eyebrow>Display / semibold</Eyebrow>
                    <Heading as="h3" size="xl">
                      Space to think clearly.
                    </Heading>
                  </div>
                  <div className="space-y-2">
                    <Eyebrow>Section / semibold</Eyebrow>
                    <Heading as="h3" size="lg">
                      A consistent workspace.
                    </Heading>
                  </div>
                  <div className="space-y-2">
                    <Eyebrow>Body / regular</Eyebrow>
                    <Text>
                      Readable details support confident decisions, from the first inquiry to the
                      final handover.
                    </Text>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <Eyebrow>Numeric specimen</Eyebrow>
                      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                        AED 24,850.00
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Typography example only</p>
                  </div>
                </CardContent>
              </Card>
            </PreviewSection>

            <PreviewSection
              id="components"
              title="Small pieces. One visual language."
              description="Shared primitives provide variants, native semantics, visible focus and consistent touch targets."
            >
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Buttons & icons</CardTitle>
                    <CardDescription>
                      Press Tab to inspect keyboard focus. Preview actions never save business data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() =>
                          setMessage('Primary preview selected. No records were saved.')
                        }
                      >
                        <Icon icon={Plus} />
                        Primary
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setMessage('Secondary preview selected.')}
                      >
                        Secondary
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setMessage('Outline preview selected.')}
                      >
                        Outline
                      </Button>
                      <Button variant="ghost" onClick={() => setMessage('Ghost preview selected.')}>
                        Ghost
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          setMessage('Destructive style preview only. Nothing was deleted.')
                        }
                      >
                        Destructive
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button disabled>Disabled example</Button>
                      <Button loading>Saving preview</Button>
                      <IconButton
                        label="Preview notifications"
                        icon={Bell}
                        variant="outline"
                        onClick={() => setMessage('Notification icon preview selected.')}
                      />
                      <IconButton
                        label="Preview filters"
                        icon={SlidersHorizontal}
                        variant="secondary"
                        onClick={() => setMessage('Filter icon preview selected.')}
                      />
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-3">
                      {[Palette, Search, LayoutGrid, Layers, Sparkles].map((glyph, index) => (
                        <span
                          key={index}
                          className="grid size-11 place-items-center rounded-control bg-muted"
                        >
                          <Icon icon={glyph} />
                        </span>
                      ))}
                    </div>
                    <p
                      role="status"
                      className="rounded-control bg-muted p-3 text-sm text-muted-foreground"
                    >
                      {message}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Fields with a clear purpose</CardTitle>
                    <CardDescription>
                      Native controls with shared styling. Required, disabled and invalid states
                      remain explicit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="specimen-name" required>
                          Sample project name
                        </Label>
                        <Input
                          id="specimen-name"
                          name="projectName"
                          placeholder="Enter a sample name"
                          required
                          minLength={2}
                          aria-describedby="specimen-name-help"
                        />
                        <p id="specimen-name-help" className="text-xs text-muted-foreground">
                          Use demonstration text only.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specimen-notes">Sample notes</Label>
                        <Textarea
                          id="specimen-notes"
                          name="notes"
                          placeholder="Describe a sample space..."
                        />
                      </div>
                      <Button type="submit">Submit preview</Button>
                    </form>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="specimen-error">Invalid-state example</Label>
                      <Input
                        id="specimen-error"
                        value="Incomplete example"
                        readOnly
                        aria-invalid="true"
                        aria-describedby="specimen-error-help"
                      />
                      <p id="specimen-error-help" className="text-sm text-destructive">
                        This example demonstrates an associated error message.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specimen-disabled">Disabled field</Label>
                      <Input
                        id="specimen-disabled"
                        placeholder="Unavailable in this example"
                        disabled
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </PreviewSection>

            <PreviewSection
              id="surfaces"
              title="Layers, without the noise."
              description="Glass is reserved for selected panels. Cards and form surfaces stay opaque and readable."
            >
              <div className="grid gap-5 md:grid-cols-3">
                <MotionPanel>
                  <Surface className="h-full space-y-4 p-6 shadow-card">
                    <Icon icon={Layers} />
                    <Heading as="h3" size="md">
                      Solid card
                    </Heading>
                    <Text tone="muted" className="text-sm">
                      An opaque home for dense content and editable details.
                    </Text>
                  </Surface>
                </MotionPanel>
                <MotionPanel>
                  <GlassPanel className="h-full space-y-4 p-6 shadow-float">
                    <Icon icon={Sparkles} />
                    <Heading as="h3" size="md">
                      Soft glass
                    </Heading>
                    <Text tone="muted" className="text-sm">
                      Subtle frosting with an opaque fallback when blur is unavailable.
                    </Text>
                  </GlassPanel>
                </MotionPanel>
                <MotionPanel>
                  <Surface tone="inverse" className="h-full space-y-4 p-6 shadow-card">
                    <Icon icon={Palette} />
                    <Heading as="h3" size="md">
                      Espresso contrast
                    </Heading>
                    <Text tone="inverse" className="text-sm">
                      A calm anchor for selected high-contrast surfaces.
                    </Text>
                  </Surface>
                </MotionPanel>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Spacing & radius</CardTitle>
                  <CardDescription>
                    A 4px base spacing unit. Control, card and panel radii stay consistent.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    {[
                      ['4px', 'w-1'],
                      ['8px', 'w-2'],
                      ['16px', 'w-4'],
                      ['24px', 'w-6'],
                      ['32px', 'w-8'],
                    ].map(([label, width]) => (
                      <div key={label} className="flex items-center gap-4">
                        <span className="w-12 text-xs text-muted-foreground tabular-nums">
                          {label}
                        </span>
                        <div
                          aria-hidden="true"
                          className={cn('h-3 rounded-full bg-accent', width)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-control border border-input bg-muted p-4 text-xs">
                      Control
                    </div>
                    <div className="rounded-card border border-input bg-muted p-4 text-xs">
                      Card
                    </div>
                    <div className="rounded-panel border border-input bg-muted p-4 text-xs">
                      Panel
                    </div>
                  </div>
                </CardContent>
              </Card>
            </PreviewSection>

            <PreviewSection
              id="motion"
              title="Movement with restraint."
              description="Small hover lifts and deliberate state changes. System reduced-motion preferences disable spatial animation."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Motion specimen</CardTitle>
                    <CardDescription>
                      Toggle the example to compare states. No automatic looping illustration.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div
                      data-testid="motion-sample"
                      data-motion={reducedMotion ? 'reduced' : 'enabled'}
                      className="flex h-24 items-center rounded-card border border-border bg-muted p-4"
                    >
                      <motion.div
                        initial={false}
                        animate={{
                          x: reducedMotion ? 0 : motionActive ? 44 : 0,
                          rotate: reducedMotion ? 0 : motionActive ? 8 : 0,
                        }}
                        className={cn(
                          'grid size-12 place-items-center rounded-control',
                          motionActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground',
                        )}
                      >
                        <Icon icon={Sparkles} />
                      </motion.div>
                    </div>
                    <Button
                      variant="outline"
                      aria-pressed={motionActive}
                      onClick={() => setMotionActive(!motionActive)}
                    >
                      Toggle motion sample
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {reducedMotion
                        ? 'Reduced motion respected.'
                        : 'Short, purposeful transitions.'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Loading & identity</CardTitle>
                    <CardDescription>
                      Skeletons are decorative; the loading region has one accessible announcement.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div aria-busy="true" role="status" className="space-y-3">
                      <span className="sr-only">Loading component example</span>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-11 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      <Skeleton className="h-16 w-full" />
                    </div>
                    <Separator />
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name="Design team" size="sm" />
                      <Avatar name="Project manager" />
                      <Avatar name="Afaq team" size="lg" />
                      <span className="text-xs text-muted-foreground">
                        Initials work without external image requests.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </PreviewSection>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
              <p>Afaq Al Manzel · Reusable foundation · Sprint 05</p>
              <p>Awaiting visual approval</p>
            </footer>
          </main>
        </GlassPanel>
      </PageContainer>
    </div>
  );
}
