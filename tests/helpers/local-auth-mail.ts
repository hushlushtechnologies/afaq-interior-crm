import { expect } from '@playwright/test';
import { z } from 'zod';

const MAIL_API = 'http://127.0.0.1:57424';

const messageListSchema = z.object({
  messages: z.array(
    z.object({
      ID: z.string(),
      To: z
        .array(
          z.object({
            Address: z.string(),
          }),
        )
        .default([]),
    }),
  ),
});

const messageSchema = z.object({
  HTML: z.string().nullish(),
  Text: z.string().nullish(),
});

export type LocalAuthMail = {
  html: string;
  text: string;
};

export type EmailLinkProof = {
  tokenHash: string;
  type: 'email' | 'recovery';
};

async function readMailJson(path: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(`${MAIL_API}${path}`, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error('Cannot reach the local email API on port 57424.');
  }

  if (!response.ok) {
    throw new Error(`The local email API returned HTTP ${response.status}.`);
  }

  try {
    const data: unknown = await response.json();
    return data;
  } catch {
    throw new Error('The local email API did not return valid JSON.');
  }
}

export async function waitForLocalAuthMail(email: string): Promise<LocalAuthMail> {
  let messageId: string | undefined;

  await expect
    .poll(
      async () => {
        const raw = await readMailJson('/api/v1/messages?limit=100');

        const parsed = messageListSchema.safeParse(raw);

        if (!parsed.success) {
          throw new Error('The local email list has an unexpected format.');
        }

        messageId = parsed.data.messages.find((message) =>
          message.To.some((recipient) => recipient.Address.toLowerCase() === email.toLowerCase()),
        )?.ID;

        return Boolean(messageId);
      },
      {
        timeout: 30_000,
        intervals: [250, 500, 1000],
        message: 'The expected local authentication email did not arrive.',
      },
    )
    .toBe(true);

  if (!messageId) {
    throw new Error('The local authentication email was not found.');
  }

  const raw = await readMailJson(`/api/v1/message/${encodeURIComponent(messageId)}`);

  const parsed = messageSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error('The local email message has an unexpected format.');
  }

  return {
    html: parsed.data.HTML ?? '',
    text: parsed.data.Text ?? '',
  };
}

export function readEmailLinkProof(
  mail: LocalAuthMail,
  applicationUrl: string,
  expectedType: EmailLinkProof['type'],
): EmailLinkProof {
  const expectedOrigin = new URL(applicationUrl).origin;

  const html = mail.html.replace(/&amp;/gi, '&');

  const matches = html.matchAll(/href\s*=\s*["']([^"']+)["']/gi);

  for (const match of matches) {
    let url: URL;

    try {
      url = new URL(match[1]);
    } catch {
      continue;
    }

    if (url.origin !== expectedOrigin || url.pathname !== '/auth/confirm') {
      continue;
    }

    const fragment = new URLSearchParams(url.hash.slice(1));

    const tokenHash = fragment.get('token_hash');
    const type = fragment.get('type');

    if (type === expectedType && tokenHash && /^[A-Za-z0-9_-]{16,512}$/.test(tokenHash)) {
      return {
        tokenHash,
        type: expectedType,
      };
    }
  }

  throw new Error(
    'The authentication email has no matching local confirmation link. Check APP_URL, allowed redirects, and the email template.',
  );
}

export function readVerificationCode(mail: LocalAuthMail): string {
  const text = [
    mail.html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' '),
    mail.text,
  ].join(' ');

  const code = text.match(/\b\d{6}\b/)?.[0];

  if (!code) {
    throw new Error('The verification email did not contain a six-digit code.');
  }

  return code;
}
