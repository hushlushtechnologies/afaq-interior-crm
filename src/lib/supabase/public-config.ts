import { z } from 'zod';

export function isSupportedHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);

    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

    const supportedProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback);

    return (
      supportedProtocol &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/'
    );
  } catch {
    return false;
  }
}

const publicConfigSchema = z.object({
  url: z.string().trim().url().refine(isSupportedHttpOrigin),

  publishableKey: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !value.startsWith('sb_secret_')),
});

export function getSupabasePublicConfig() {
  const result = publicConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    throw new Error(
      'Supabase configuration is missing or invalid. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  return {
    url: result.data.url.replace(/\/+$/, ''),
    publishableKey: result.data.publishableKey,
  };
}
