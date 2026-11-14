import { expect, test } from '@playwright/test';
import {
  formatUnsignedDecimal,
  parseUnsignedDecimal,
  rescaleUnsignedExact,
} from '../../src/features/quotations/decimal';

test('decimal addition preserves 0.10 plus 0.20 exactly', () => {
  const total = parseUnsignedDecimal('0.10', 2) + parseUnsignedDecimal('0.20', 2);
  expect(total).toBe(BigInt(30));
  expect(formatUnsignedDecimal(total, 2)).toBe('0.30');
});

test('values above JavaScript safe integer range retain their cents', () => {
  const input = '9007199254740993.01';
  const value = parseUnsignedDecimal(input, 2);
  expect(value).toBe(BigInt('900719925474099301'));
  expect(formatUnsignedDecimal(value, 2)).toBe(input);
});

test('caller-selected fractional scales preserve quantity and price digits', () => {
  expect(parseUnsignedDecimal('1.2345', 4)).toBe(BigInt(12345));
  expect(parseUnsignedDecimal('2.345678', 6)).toBe(BigInt(2345678));
  expect(formatUnsignedDecimal(BigInt(1), 6)).toBe('0.000001');
  expect(formatUnsignedDecimal(BigInt(0), 0)).toBe('0');
});

test('noncanonical strings and number inputs are rejected', () => {
  for (const input of [
    0.1,
    NaN,
    Infinity,
    null,
    undefined,
    {},
    [],
    '',
    '01',
    '-1',
    '+1',
    '1e3',
    '1.',
    '.1',
    ' 1',
    '1 ',
    '1\n',
    'Infinity',
    'NaN',
  ])
    expect(() => parseUnsignedDecimal(input, 2)).toThrow();
});

test('excess fractional digits are not silently truncated', () => {
  expect(() => parseUnsignedDecimal('1.234', 2)).toThrow();
  expect(() => parseUnsignedDecimal('1.230', 2)).toThrow();
});

test('rescaling is exact and refuses implicit rounding', () => {
  const value = parseUnsignedDecimal('1.23', 2);
  expect(rescaleUnsignedExact(value, 2, 4)).toBe(BigInt(12300));
  expect(rescaleUnsignedExact(BigInt(12300), 4, 2)).toBe(value);
  expect(() => rescaleUnsignedExact(BigInt(12345), 4, 2)).toThrow('rounding policy');
});

test('invalid scales and invalid coefficients are rejected', () => {
  for (const scale of [-1, 37, 1.5, NaN, Infinity]) {
    expect(() => parseUnsignedDecimal('1', scale)).toThrow();
    expect(() => formatUnsignedDecimal(BigInt(1), scale)).toThrow();
    expect(() => rescaleUnsignedExact(BigInt(1), 2, scale)).toThrow();
  }
  expect(() => formatUnsignedDecimal(BigInt(-1), 2)).toThrow();
  expect(() => formatUnsignedDecimal(1 as unknown as bigint, 2)).toThrow();
  expect(() => rescaleUnsignedExact(BigInt(-1), 2, 4)).toThrow();
});

test('format/parse round trips are stable and input size is bounded', () => {
  for (const input of ['0', '1', '101', '900719925474099301']) {
    const value = BigInt(input);
    for (let scale = 0; scale <= 12; scale++)
      expect(parseUnsignedDecimal(formatUnsignedDecimal(value, scale), scale)).toBe(value);
  }
  expect(() => parseUnsignedDecimal('9'.repeat(129), 0)).toThrow();
});