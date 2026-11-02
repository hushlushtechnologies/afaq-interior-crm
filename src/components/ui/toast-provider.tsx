'use client';

import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/icon-button';
import { InlineNotice, type NoticeTone } from '@/components/ui/inline-notice';

type ToastInput = {
  title: string;
  description?: string;
  tone?: NoticeTone;
};

type ToastItem = ToastInput & {
  id: string;
  origin: HTMLElement | null;
};

type Announcement = {
  id: string;
  text: string;
};

type ToastContextValue = {
  notify: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  count: number;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const notify = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();

    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const item: ToastItem = {
      ...input,
      id,
      origin,
    };

    setItems((current) => [...current, item].slice(-3));

    setAnnouncement({
      id,
      text: [input.title, input.description].filter(Boolean).join('. '),
    });

    return id;
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const item = items.find((entry) => entry.id === id);

      const focusedInsideToast =
        document.getElementById(`toast-${id}`)?.contains(document.activeElement) ?? false;

      setItems((current) => current.filter((entry) => entry.id !== id));

      if (focusedInsideToast) {
        const origin = item?.origin;

        requestAnimationFrame(() => {
          if (origin?.isConnected && !origin.matches(':disabled')) {
            origin.focus();
          }
        });
      }
    },
    [items],
  );

  const clear = useCallback(() => {
    setItems([]);

    setAnnouncement({
      id: crypto.randomUUID(),
      text: 'Notifications dismissed.',
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      notify,
      dismiss,
      clear,
      count: items.length,
    }),
    [notify, dismiss, clear, items.length],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement ? <span key={announcement.id}>{announcement.text}</span> : null}
      </div>

      {items.length ? (
        <ol
          aria-label="Notifications"
          className="fixed inset-x-4 bottom-4 z-70 flex max-h-[calc(100dvh_-_2rem)] flex-col gap-3 overflow-y-auto overscroll-contain p-1 sm:left-auto sm:w-96"
        >
          {items.map((item) => (
            <li key={item.id} id={`toast-${item.id}`} className="relative min-w-0">
              <InlineNotice title={item.title} tone={item.tone} className="pr-16 shadow-floating">
                {item.description ? <p>{item.description}</p> : null}
              </InlineNotice>

              <IconButton
                type="button"
                label={`Dismiss ${item.title}`}
                icon={X}
                variant="ghost"
                onClick={() => dismiss(item.id)}
                className="absolute right-1 top-1"
              />
            </li>
          ))}
        </ol>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }

  return context;
}
