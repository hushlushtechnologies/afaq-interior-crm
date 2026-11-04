import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base } from '@playwright/test';
import { createLocalAuthFixtures } from '../helpers/local-auth-fixtures';

const bucket = 'crm-private';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);

const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

const test = base.extend<{ storage: Awaited<ReturnType<typeof fixtures>> }>({
  storage: async ({}, provide) => {
    const fixture = await fixtures();

    try {
      await provide(fixture);
    } finally {
      await fixture.cleanup();
    }
  },
});

async function fixtures() {
  // Validate the exact local API/project configuration before any privileged call.
  const auth = createLocalAuthFixtures('http://127.0.0.1:3100');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const admin = createClient(url, process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!, options);
  const anonymous = createClient(url, key, options);
  const clients = [anonymous];
  const prefix = `s12-${randomUUID()}`;

  const paths = ['probe.png', 'forged.png', 'moved.png', 'copy.png', 'bad.txt', 'large.png'].map(
    (name) => `${prefix}/${name}`,
  );

  try {
    for (const role of ['sales_executive', 'super_admin', null] as const) {
      const account = await auth.createAccount({ role });
      const client = createClient(url, key, options);

      const signed = await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });

      if (signed.error) throw new Error('Local fixture sign-in failed.');

      clients.push(client);
    }
  } catch (error) {
    await auth.cleanup();
    throw error;
  }

  return {
    admin,
    clients,
    prefix,
    paths,

    async upload() {
      const result = await admin.storage
        .from(bucket)
        .upload(paths[0], png, { contentType: 'image/png', upsert: false });

      expect(Boolean(result.error), 'Trusted local fixture upload').toBe(false);
    },

    async cleanup() {
      try {
        const result = await admin.storage.from(bucket).remove(paths);

        if (result.error) throw new Error('Local storage fixture cleanup failed.');
      } finally {
        await auth.cleanup();
      }
    },
  };
}

test('private object reads, listing and signing deny anonymous, Sales, Super Admin and roleless clients', async ({
  storage: s,
}) => {
  await s.upload();

  for (const client of s.clients) {
    expect(Boolean((await client.storage.from(bucket).download(s.paths[0])).error)).toBe(true);

    const list = await client.storage.from(bucket).list(s.prefix);
    expect((list.data ?? []).length).toBe(0);

    const signed = await client.storage.from(bucket).createSignedUrl(s.paths[0], 60);
    expect(Boolean(signed.error)).toBe(true);
    expect(Boolean(signed.data?.signedUrl)).toBe(false);

    const upload = await client.storage.from(bucket).createSignedUploadUrl(s.paths[1]);
    expect(Boolean(upload.error)).toBe(true);
    expect(Boolean(upload.data?.token)).toBe(false);
  }

  const publicUrl = s.admin.storage.from(bucket).getPublicUrl(s.paths[0]).data.publicUrl;
  const response = await fetch(publicUrl, { redirect: 'error' });

  expect(response.ok).toBe(false);

  const read = await s.admin.storage.from(bucket).download(s.paths[0]);

  expect(Boolean(read.error)).toBe(false);
  expect(Buffer.from(await read.data!.arrayBuffer()).equals(png)).toBe(true);
});

test('client writes, replacement, move, copy, deletion and bucket publication cannot change the fixture', async ({
  storage: s,
}) => {
  await s.upload();

  for (const client of s.clients) {
    expect(
      Boolean(
        (await client.storage.from(bucket).upload(s.paths[1], png, { contentType: 'image/png' }))
          .error,
      ),
    ).toBe(true);

    expect(
      Boolean(
        (
          await client.storage
            .from(bucket)
            .upload(s.paths[0], png, { contentType: 'image/png', upsert: true })
        ).error,
      ),
    ).toBe(true);

    expect(
      Boolean(
        (await client.storage.from(bucket).update(s.paths[0], png, { contentType: 'image/png' }))
          .error,
      ),
    ).toBe(true);

    await client.storage.from(bucket).move(s.paths[0], s.paths[2]);
    await client.storage.from(bucket).copy(s.paths[0], s.paths[3]);
    await client.storage.from(bucket).remove([s.paths[0]]);

    expect(Boolean((await client.storage.updateBucket(bucket, { public: true })).error)).toBe(true);
  }

  const list = await s.admin.storage.from(bucket).list(s.prefix);

  expect(Boolean(list.error)).toBe(false);
  expect(list.data?.map((file) => file.name)).toEqual(['probe.png']);

  const read = await s.admin.storage.from(bucket).download(s.paths[0]);

  expect(Boolean(read.error)).toBe(false);
  expect(Buffer.from(await read.data!.arrayBuffer()).equals(png)).toBe(true);
});

test('Storage enforces bucket MIME and size limits even for trusted fixture uploads', async ({
  storage: s,
}) => {
  const bad = await s.admin.storage
    .from(bucket)
    .upload(s.paths[4], Buffer.from('fixture'), { contentType: 'text/plain' });

  expect(Boolean(bad.error)).toBe(true);

  const large = await s.admin.storage
    .from(bucket)
    .upload(s.paths[5], Buffer.alloc(10485761), { contentType: 'image/png' });

  expect(Boolean(large.error)).toBe(true);

  const list = await s.admin.storage.from(bucket).list(s.prefix);

  expect(Boolean(list.error)).toBe(false);
  expect(list.data?.length).toBe(0);
});

test('only the trusted fixture can issue a short-lived bearer link, which expires', async ({
  storage: s,
}) => {
  await s.upload();

  const signed = await s.admin.storage.from(bucket).createSignedUrl(s.paths[0], 2);

  expect(Boolean(signed.error)).toBe(false);

  const link = signed.data!.signedUrl;
  const response = await fetch(link, { redirect: 'error' });

  expect(response.ok).toBe(true);
  expect(Buffer.from(await response.arrayBuffer()).equals(png)).toBe(true);

  await expect
    .poll(async () => !(await fetch(link, { redirect: 'error' })).ok, {
      timeout: 15000,
      intervals: [500],
      message: 'Local signed link must expire',
    })
    .toBe(true);
});