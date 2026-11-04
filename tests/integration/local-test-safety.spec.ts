import { chromium, expect, test, type FullConfig } from '@playwright/test';
import setup from '../auth.setup';

test('a hosted Supabase URL is rejected before any browser can launch or sign in', async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalLaunch = chromium.launch;
  let launches = 0;

  // Even a regression in preflight cannot start a browser or contact this URL.
  chromium.launch = async () => {
    launches += 1;
    throw new Error('Unexpected browser launch before local validation.');
  };

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';

  try {
    const config = { projects: [{ use: { baseURL: 'http://127.0.0.1:3100' } }] } as FullConfig;

    await expect(setup(config)).rejects.toThrow('restricted to the dedicated local Supabase');
    expect(launches).toBe(0);
  } finally {
    chromium.launch = originalLaunch;

    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  }
});