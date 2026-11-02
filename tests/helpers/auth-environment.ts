import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

export function loadAuthTestEnvironment() {
  const path = resolve('.env.local');

  if (existsSync(path)) {
    loadEnvFile(path);
  }
}

export function getAuthTestCredentials() {
  const email = process.env.E2E_AUTH_EMAIL?.trim();
  const password = process.env.E2E_AUTH_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD in .env.local for the confirmed local test account.',
    );
  }

  return {
    email,
    password,
  };
}

export function getAuthStatePath(baseURL: string) {
  const url = new URL(baseURL);

  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('These authentication test credentials are for local test servers only.');
  }

  return resolve('playwright', '.auth', `session-${url.port || 'default'}.json`);
}
