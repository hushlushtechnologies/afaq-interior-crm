'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { useAccess } from '@/components/access/access-provider';
import { ModuleIcon } from '@/components/shell/module-icon';
import { ShellDialog } from '@/components/shell/shell-dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, focusRing } from '@/lib/utils';

export function NavigationSearch() {
  const router = useRouter();
  const { searchLinks } = useAccess();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const results = searchLinks.filter((link) =>
    normalizedQuery ? link.searchText.includes(normalizedQuery) : link.isRoot,
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        !event.isComposing &&
        !event.altKey &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setQuery('');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const firstResult = results[0];

    if (firstResult) {
      handleOpenChange(false);
      router.push(firstResult.href);
    }
  }

  return (
    <ShellDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search navigation"
      description="Find pages available to your account."
      closeLabel="Close search"
      initialFocusRef={inputRef}
      trigger={
        <Button
          type="button"
          variant="outline"
          aria-label="Search navigation"
          aria-keyshortcuts="Control+K Meta+K"
          className="size-12 min-h-12 shrink-0 px-0 xl:w-64 xl:justify-start xl:px-3"
        >
          <Icon icon={Search} />

          <span className="hidden xl:inline">Search workspace</span>

          <kbd
            aria-hidden="true"
            className="ml-auto hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground xl:inline"
          >
            Ctrl K
          </kbd>
        </Button>
      }
    >
      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Label htmlFor="navigation-search-input">Find a page</Label>

          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              id="navigation-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search available pages"
              autoComplete="off"
              aria-describedby="navigation-search-help"
            />

            <Button type="submit" disabled={results.length === 0}>
              Go
            </Button>
          </div>

          <p id="navigation-search-help" className="text-xs text-muted-foreground">
            Enter opens the first matching page. Escape closes search.
          </p>
        </form>

        {results.length > 0 ? (
          <ul aria-label="Matching pages" className="space-y-1">
            {results.map((result) => (
              <li key={result.href}>
                <Link
                  href={result.href}
                  aria-label={result.moduleTitle + ' — ' + result.title}
                  onClick={() => handleOpenChange(false)}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-control px-3 py-2 hover:bg-muted',
                    focusRing,
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-control bg-secondary">
                    <ModuleIcon moduleId={result.moduleId} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{result.title}</span>

                    <span className="block text-xs text-muted-foreground">
                      {result.moduleTitle}
                    </span>
                  </span>

                  <Icon icon={ArrowUpRight} size="sm" className="text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-card border border-border bg-muted p-5">
            <p className="text-sm font-semibold">
              {searchLinks.length ? 'No matching pages' : 'No pages available'}
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              {searchLinks.length
                ? 'Try another page name.'
                : 'Ask your Super Admin to review your roles.'}
            </p>
          </div>
        )}
      </div>
    </ShellDialog>
  );
}
