import 'server-only';

import { z } from 'zod';
import { isSupportedHttpOrigin } from '@/lib/supabase/public-config';

const applicationUrlSchema = z.string().trim().url().refine(isSupportedHttpOrigin);

export function getApplicationOrigin(): string {
  const result = applicationUrlSchema.safeParse(process.env.APP_URL);

  if (!result.success) {
    throw new Error(
      'APP_URL is missing or invalid. Use the application origin, such as http://localhost:3000 for local development.',
    );
  }

  return new URL(result.data).origin;
}

export function getSecureAuthCookieSetting(): boolean {
  return new URL(getApplicationOrigin()).protocol === 'https:';
}
