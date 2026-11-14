/** Exact unsigned decimal primitives. No tax, pricing order or rounding policy. */
const MAX_SCALE = 36;
const MAX_INPUT_LENGTH = 128;
const ZERO = BigInt(0);

function factor(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE)
    throw new RangeError('Decimal scale must be an integer between 0 and 36.');
  return BigInt(10) ** BigInt(scale);
}

function assertUnsigned(value: bigint): void {
  if (typeof value !== 'bigint' || value < ZERO)
    throw new TypeError('Expected a nonnegative bigint coefficient.');
}

export function parseUnsignedDecimal(value: unknown, scale: number): bigint {
  const multiplier = factor(scale);
  if (typeof value !== 'string' || value.length > MAX_INPUT_LENGTH)
    throw new TypeError('Expected a bounded decimal string, never a JavaScript number.');
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(value);
  if (!match || match[0] !== value)
    throw new RangeError('Expected a canonical nonnegative decimal string.');
  const fraction = match[2] ?? '';
  if (fraction.length > scale)
    throw new RangeError('The decimal has more fractional digits than the explicit scale.');
  return BigInt(match[1]) * multiplier + BigInt(fraction.padEnd(scale, '0') || '0');
}

export function formatUnsignedDecimal(value: bigint, scale: number): string {
  const divisor = factor(scale);
  assertUnsigned(value);
  const whole = (value / divisor).toString();
  if (scale === 0) return whole;
  return `${whole}.${(value % divisor).toString().padStart(scale, '0')}`;
}

export function rescaleUnsignedExact(value: bigint, fromScale: number, toScale: number): bigint {
  const from = factor(fromScale);
  const to = factor(toScale);
  assertUnsigned(value);
  if (to >= from) return value * (to / from);
  const divisor = from / to;
  if (value % divisor !== ZERO)
    throw new RangeError('An approved rounding policy is required for this conversion.');
  return value / divisor;
}
