'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn, focusRing } from '@/lib/utils';

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  label: string;
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export function Tabs({ label, items, value, onValueChange, className }: TabsProps) {
  const generatedId = useId();

  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const selectedItem =
    items.find((item) => item.id === value && !item.disabled) ??
    items.find((item) => !item.disabled);

  const enabledItems = items.filter((item) => !item.disabled);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentId: string) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const index = enabledItems.findIndex((item) => item.id === currentId);

    if (index < 0 || !enabledItems.length) {
      return;
    }

    let nextItem: TabItem | undefined;

    switch (event.key) {
      case 'ArrowRight':
        nextItem = enabledItems[(index + 1) % enabledItems.length];
        break;

      case 'ArrowLeft':
        nextItem = enabledItems[(index - 1 + enabledItems.length) % enabledItems.length];
        break;

      case 'Home':
        nextItem = enabledItems[0];
        break;

      case 'End':
        nextItem = enabledItems[enabledItems.length - 1];
        break;

      default:
        return;
    }

    if (!nextItem) {
      return;
    }

    event.preventDefault();
    onValueChange(nextItem.id);
    tabRefs.current.get(nextItem.id)?.focus();
  }

  if (!selectedItem) {
    return null;
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className="flex max-w-full gap-2 overflow-x-auto rounded-control border border-border bg-muted p-2"
      >
        {items.map((item, index) => {
          const selected = item.id === selectedItem.id;
          const tabId = `${generatedId}-tab-${index}`;
          const panelId = `${generatedId}-panel-${index}`;

          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(item.id, node);
                } else {
                  tabRefs.current.delete(item.id);
                }
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              disabled={item.disabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, item.id)}
              className={cn(
                'min-h-12 shrink-0 rounded-control border px-4 py-3 text-sm font-semibold transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
                focusRing,
                selected
                  ? 'border-border bg-card text-foreground shadow-control'
                  : 'border-transparent text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item, index) => {
        const selected = item.id === selectedItem.id;
        const tabId = `${generatedId}-tab-${index}`;
        const panelId = `${generatedId}-panel-${index}`;

        return (
          <div
            key={item.id}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            hidden={!selected}
            inert={!selected}
            tabIndex={selected ? 0 : -1}
            className={cn('min-w-0 rounded-control pt-5', focusRing)}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
