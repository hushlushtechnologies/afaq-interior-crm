'use client';

import { useEffect, useRef, useState } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { Button, buttonClassName } from '@/components/ui/button';
import {
  prepareInternalDraftPdf,
  requestInternalDraftPdfDownload,
} from '@/features/quotations/pdf-actions';

export function QuotationDraftPdf({ id, version }: { id: string; version: number }) {
  const gate = useRef(false);
  const request = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const storageKey = `crm-draft-pdf:${id}:${version}`;
  useEffect(() => {
    if (!link) return;
    const timer = window.setTimeout(() => setLink(null), Math.max(0, link.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [link]);

  async function run(download: boolean) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    setLink(null);
    try {
      if (download && documentId) {
        const result = await requestInternalDraftPdfDownload({ documentId });
        if (result.status === 'error') {
          setError(result.message);
          return;
        }
        setLink(result.data);
        setMessage('Download access prepared. The link expires within 60 seconds.');
      } else {
        if (!request.current) {
          try {
            request.current = sessionStorage.getItem(storageKey);
          } catch {
            /* Optional retry persistence. */
          }
          if (!request.current || !/^[a-f0-9-]{36}$/i.test(request.current))
            request.current = crypto.randomUUID();
          try {
            sessionStorage.setItem(storageKey, request.current);
          } catch {
            /* In-memory retry remains available. */
          }
        }
        const result = await prepareInternalDraftPdf({ id, version, requestId: request.current });
        if (result.status === 'error') {
          setError(result.message);
          if (!result.retryable) {
            request.current = null;
            try {
              sessionStorage.removeItem(storageKey);
            } catch {
              /* Optional persistence. */
            }
          }
          return;
        }
        setDocumentId(result.data.documentId);
        setMessage('Internal draft PDF prepared. No approval or client delivery occurred.');
      }
    } catch {
      setError('The result is unconfirmed. Retry using the same saved version.');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto my-6 min-w-0 max-w-7xl">
      <DetailSection
        id="quotation-draft-pdf"
        title="Internal draft PDF"
        description={`Uses saved version ${version}. Unsaved edits are not included. English-only; not approved for client delivery.`}
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={busy} onClick={() => void run(false)}>
            {documentId ? 'Recheck saved draft PDF' : 'Prepare saved draft PDF'}
          </Button>
          {documentId && (
            <Button disabled={busy} onClick={() => void run(true)}>
              Create draft download link
            </Button>
          )}
          {link && (
            <a
              href={link.url}
              className={buttonClassName({ variant: 'outline' })}
              rel="noreferrer"
              referrerPolicy="no-referrer"
              onClick={(event) => {
                if (Date.now() >= link.expiresAt) {
                  event.preventDefault();
                  setLink(null);
                }
              }}
            >
              Download internal draft PDF
            </a>
          )}
        </div>
        {busy && (
          <p role="status" className="mt-3 text-sm">
            Preparing protected draft access…
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm">
            {error}
          </p>
        )}
      </DetailSection>
    </div>
  );
}