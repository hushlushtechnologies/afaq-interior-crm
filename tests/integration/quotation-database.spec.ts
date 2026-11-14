import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { calculateQuotation } from '../../src/features/quotations/pricing';
import { PRICING_POLICY_ID, type PricingInput } from '../../src/features/quotations/schemas';

const container = 'supabase_db_afaq-interiors-crm-s09-local';
const host =
  process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
const env = { ...process.env };
for (const key of [
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_TLS',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
])
  delete env[key];

function docker(args: string[], input?: string) {
  return execFileSync('docker', [`--host=${host}`, ...args], {
    env,
    input,
    encoding: 'utf8',
    timeout: 45000,
    maxBuffer: 16 * 1024 * 1024,
  });
}
function sql(input: string) {
  return docker(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-qAt',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    input,
  );
}

test.beforeAll(() => {
  // Fixed local daemon, fixed project and fixed port. No remote URL or credential input.
  const identity = docker([
    'inspect',
    '--format',
    '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
    container,
  ]).trim();
  expect(identity).toBe(`/${container}|true|57422`);
  expect(
    sql(
      "select exists(select 1 from supabase_migrations.schema_migrations where version='20261113000300');",
    ),
  ).toBe('t\n');
});

test('private SQL pricing rejects invalid input and denies direct application-role access', () => {
  const fixture = readFileSync(resolve('tests/sql/quotation-pricing.sql'), 'utf8');
  expect(sql(fixture)).toContain('quotation SQL checks passed');
});

test('PostgreSQL and TypeScript agree on every line and total of 500 synthetic quotations', () => {
  let state = 1803;
  function random(max: number) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % max;
  }
  const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const inputs: PricingInput[] = [];
  for (let sample = 0; sample < 500; sample += 1) {
    const items: PricingInput['items'] = [];
    const count = random(9);
    for (let index = 0; index < count; index += 1) {
      const discountMode = random(3);
      const treatment = random(3);
      items.push({
        id: id(index + 1),
        sectionId: null,
        description: 'Synthetic local quotation item',
        unit: index % 2 ? 'm²' : 'custom work',
        quantity: `${random(100) + 1}.${String(random(10000)).padStart(4, '0')}`,
        unitPrice: `${random(100000) + 1}.${String(random(1000000)).padStart(6, '0')}`,
        discount:
          discountMode === 0
            ? { mode: 'none' }
            : discountMode === 1
              ? { mode: 'fixed', amount: '0.01' }
              : { mode: 'percent', rate: String(random(101)) },
        tax:
          treatment === 0
            ? { treatment: 'exempt' }
            : treatment === 1
              ? { treatment: 'zero_rated' }
              : { treatment: 'taxable', rate: ['5', '7.25', '0.000001', '100'][random(4)] },
      });
    }
    if (sample % 2 === 0) items.reverse();
    inputs.push({
      policyId: PRICING_POLICY_ID,
      currency: 'AED',
      items,
      overallDiscount:
        sample % 3 === 0 ? { mode: 'none' } : { mode: 'percent', rate: String(random(101)) },
    });
  }
  // Base64 contains no SQL quotes. No uploaded or real customer content is used.
  const queries = inputs.map((input) => {
    const encoded = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
    return `select crm_quotes.calculate(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb);`;
  });
  const output = sql(`begin; set local statement_timeout='40s';\n${queries.join('\n')}\nrollback;`);
  const rows = output.trim().split(/\r?\n/);
  expect(rows).toHaveLength(inputs.length);
  rows.forEach((row, index) => {
    expect(JSON.parse(row), `Synthetic quotation ${index + 1}`).toEqual(
      calculateQuotation(inputs[index]),
    );
  });
});

test('large cent allocations and fractional rounding agree near money boundaries', () => {
  const item: PricingInput['items'][number] = {
    id: '00000000-0000-4000-8000-000000000001',
    sectionId: null,
    description: 'Synthetic boundary fixture',
    unit: 'custom',
    quantity: '90071992547.4099',
    unitPrice: '100000',
    discount: { mode: 'none' },
    tax: { treatment: 'exempt' },
  };
  const tiny: typeof item = {
    ...item,
    id: '00000000-0000-4000-8000-000000000002',
    quantity: '1',
    unitPrice: '0.01',
    tax: { treatment: 'taxable', rate: '5' },
  };
  const inputs: PricingInput[] = [
    { mode: 'none' },
    { mode: 'fixed', amount: '0.01' },
    { mode: 'fixed', amount: '9007199254740989.99' },
    { mode: 'percent', rate: '99.999999' },
  ].map((overallDiscount) => ({
    policyId: PRICING_POLICY_ID,
    currency: 'AED',
    items: [item, tiny],
    overallDiscount: overallDiscount as PricingInput['overallDiscount'],
  }));
  inputs.push({
    policyId: PRICING_POLICY_ID,
    currency: 'AED',
    items: [{ ...tiny, quantity: '0.0001', unitPrice: '0.000001' }],
    overallDiscount: { mode: 'none' },
  });
  const queries = inputs.map((input) => {
    const encoded = Buffer.from(JSON.stringify(input)).toString('base64');
    return `select crm_quotes.calculate(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb);`;
  });
  const rows = sql(`begin;\n${queries.join('\n')}\nrollback;`)
    .trim()
    .split(/\r?\n/);
  expect(rows).toHaveLength(inputs.length);
  rows.forEach((row, index) => {
    expect(JSON.parse(row), `Boundary quotation ${index + 1}`).toEqual(
      calculateQuotation(inputs[index]),
    );
  });
});