import type { ReactNode } from 'react';

type AuthPanelProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPanel({ title, description, children }: AuthPanelProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full min-w-0 max-w-md">
        <p className="mb-5 text-center text-sm font-semibold tracking-wide text-muted-foreground">
          Afaq Al Manzel Interiors
        </p>

        <section className="min-w-0 rounded-panel border border-border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
