import { expect, it } from 'vitest';
import { Component } from '../src/native/component.ts';
import { NativeTheme } from '../src/native/theme.ts';
import { normalizeTheme, normalizedPacket, snapshotInput } from '../src/native/theme-input.ts';
import { COMPILE_DEFAULTS, INPUT_DEFAULTS, RESOLVE_DEFAULTS, NONE } from '../src/native/theme-contract.ts';
import type { AcquiredInput, BudgetCode, InputLimits, OperationalFailure, Outcome } from '../src/native/theme-contract.ts';
import { encodePathPacket } from '../src/native/theme-packet.ts';

function value<T>(result: Outcome<T> | OperationalFailure): T {
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result));
  return result.value;
}
function input(bytes: Uint8Array = new TextEncoder().encode('{}')): AcquiredInput {
  return { root: 't', resources: [{ id: 't', format: 'json', bytes }], edges: [] };
}
function packet(): Uint8Array { return normalizedPacket(value(normalizeTheme(value(snapshotInput(input())), 'raw', 'review-target'))); }
function bytes(words: readonly number[]): Uint8Array {
  const output = new Uint8Array(words.length * 4), view = new DataView(output.buffer);
  words.forEach((word, index) => view.setUint32(index * 4, word, true));
  return output;
}

it('copies Buffer packet storage before the compilation await', async () => {
  const component = await Component.load(), baseline = component.liveAllocations(), owned = Buffer.from(packet());
  const pending = NativeTheme.compilePacket(owned); owned.fill(0);
  const theme = value(await pending);
  try { expect(value(theme.resolve(value(encodePathPacket([[]]))))).toHaveLength(1); }
  finally { theme.dispose(); }
  expect(component.liveAllocations()).toBe(baseline);
});

it('copies acquired bytes without calling a caller-controlled slice method', () => {
  const original = Buffer.from('{"tokenColors":[{"settings":{"foreground":"#112233"}}]}');
  const expected = value(snapshotInput(input(Buffer.from(original))));
  Object.defineProperty(original, 'slice', { value: () => Buffer.from('{}') });
  const snapshot = value(snapshotInput(input(original)));
  expect(snapshot.acquisitionRevision).toBe(expected.acquisitionRevision);
  expect(normalizedPacket(value(normalizeTheme(snapshot, 'raw', 'review-target'))))
    .toEqual(normalizedPacket(value(normalizeTheme(expected, 'raw', 'review-target'))));
});

it.each(['toString', 'constructor', '__proto__'])('rejects inherited option name %s during acquisition', key => {
  expect(snapshotInput(input(), { ...INPUT_DEFAULTS, [key]: 0 })).toMatchObject({ kind: 'invalid', code: 'schema' });
});
it.each(['toString', 'constructor', '__proto__'])('rejects inherited option name %s during compilation', async key => {
  const result = await NativeTheme.compilePacket(packet(), { ...COMPILE_DEFAULTS, [key]: 0 });
  try { expect(result).toMatchObject({ kind: 'invalid', code: 'schema' }); }
  finally { if (result.kind === 'ok') result.value.dispose(); }
});
it.each(['toString', 'constructor', '__proto__'])('rejects inherited option name %s during resolution', async key => {
  const theme = value(await NativeTheme.compilePacket(packet()));
  try { expect(theme.resolve(value(encodePathPacket([[]])), { ...RESOLVE_DEFAULTS, [key]: 0 })).toMatchObject({ kind: 'invalid', code: 'schema' }); }
  finally { theme.dispose(); }
});

const narrower: readonly { options: Partial<InputLimits>; code: BudgetCode }[] = [
  { options: { inputBytes: 0 }, code: 'input-bytes' },
  { options: { resources: 0 }, code: 'resources' },
  { options: { resourceIdBytes: 0 }, code: 'resource-id-bytes' },
];
it.each(narrower)('checks narrower $code caps against an existing snapshot', ({ options, code }) => {
  expect(normalizeTheme(value(snapshotInput(input())), 'raw', 'review-target', options)).toMatchObject({ kind: 'budget', code, limit: 0 });
});
it('accepts exact acquired-input caps and checks narrowed include depth', () => {
  const snapshot = value(snapshotInput(input()));
  expect(normalizeTheme(snapshot, 'raw', 'review-target', { inputBytes: 2, resources: 1, resourceIdBytes: 1, includeDepth: 0 })).toMatchObject({ kind: 'ok' });
  const acquired: AcquiredInput = { root: 'a', resources: [
    { id: 'a', format: 'json', bytes: new TextEncoder().encode('{"include":"b"}') },
    { id: 'b', format: 'json', bytes: new TextEncoder().encode('{}') },
  ], edges: [{ from: 'a', to: 'b', ordinal: 0 }] };
  const included = value(snapshotInput(acquired));
  expect(normalizeTheme(included, 'raw', 'review-target', { includeDepth: 1 })).toMatchObject({ kind: 'ok' });
  expect(normalizeTheme(included, 'raw', 'review-target', { includeDepth: 0 })).toMatchObject({ kind: 'budget', code: 'include-depth', limit: 0 });
});

it('accepts reordered theme regions but rejects a name outside the declared string region', async () => {
  const words = [0x31544853, 1, 96, 1, 52, 1, 88, 0, 0, 4, 48, 0,
    0x78787878, 0, 0, 0, 0, 0, 1, 0x656d616e, 0, 0, 48, 4];
  const control = value(await NativeTheme.compilePacket(bytes(words))); control.dispose();
  words[22] = 76;
  const result = await NativeTheme.compilePacket(bytes(words));
  try { expect(result).toMatchObject({ kind: 'invalid', code: 'packet', location: { kind: 'packet', byteOffset: 88 } }); }
  finally { if (result.kind === 'ok') result.value.dispose(); }
});
it('accepts reordered path regions but rejects cross-region name descriptors', async () => {
  const theme = value(await NativeTheme.compilePacket(packet()));
  const words = [0x31504853, 1, 64, 1, 56, 2, 40, 4, 36, 0x656d616e, NONE, NONE, 0, 0, 36, 4];
  try {
    expect(theme.resolve({ bytes: bytes(words), count: 2, ids: [1] })).toMatchObject({ kind: 'ok' });
    words[14] = 48;
    expect(theme.resolve({ bytes: bytes(words), count: 2, ids: [1] })).toMatchObject({ kind: 'invalid', code: 'packet', location: { kind: 'request' } });
  } finally { theme.dispose(); }
});
