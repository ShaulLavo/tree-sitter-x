import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { nativeThemeDiagnosticFixtures } from '../src/oracles/native-theme-diagnostics.ts';
import type { NativeThemeDiagnosticCase } from '../src/oracles/native-theme-diagnostics.ts';
import { generateNativeThemeSuite } from '../src/oracles/native-theme-reference.ts';
import { NativeTheme } from '../src/native/theme.ts';
import { normalizeTheme, snapshotInput } from '../src/native/theme-input.ts';
import { encodePathPacket } from '../src/native/theme-packet.ts';
import type { AcquiredInput, AcquiredResource } from '../src/native/theme-contract.ts';

function isRecord(value: unknown): value is Record<string,unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function record(value: unknown): Record<string,unknown> {
  if (!isRecord(value)) throw new Error('Malformed authored diagnostic descriptor');
  return value;
}
function text(value: unknown): string { if (typeof value !== 'string') throw new Error('Malformed diagnostic text'); return value; }
function resource(value: unknown): AcquiredResource {
  const source = record(value), format = source.format;
  if (format !== 'json' && format !== 'jsonc' && format !== 'plist') throw new Error('Malformed diagnostic resource format');
  return {id:text(source.id),format,bytes:new TextEncoder().encode(text(source.bytes))};
}
function input(value: unknown): AcquiredInput {
  const source = record(value);
  if (!Array.isArray(source.resources) || !Array.isArray(source.edges)) throw new Error('Malformed diagnostic closure');
  return {root:text(source.root),resources:source.resources.map(resource),edges:source.edges.map(entry => {
    const edge = record(entry);
    if (typeof edge.ordinal !== 'number') throw new Error('Malformed diagnostic edge');
    return {from:text(edge.from),to:text(edge.to),ordinal:edge.ordinal};
  })};
}
async function run(test: NativeThemeDiagnosticCase): Promise<unknown> {
  const request = test.request;
  if (typeof request.fixture === 'string') return fixtureOperation(test);
  let acquired: AcquiredInput;
  if (typeof request.inputFile === 'string') {
    const bytes = await readFile(new URL(`../manifest/native-themes/${request.inputFile}`,import.meta.url));
    acquired = {root:'fixture:/rejected',resources:[{id:'fixture:/rejected',format:'json',bytes}],edges:[]};
  } else acquired = input(request.input);
  const snapshot: unknown = Reflect.apply(snapshotInput,undefined,[acquired,request.limits]);
  if (record(snapshot).kind !== 'ok' || test.operation === 'snapshotInput') return snapshot;
  return Reflect.apply(normalizeTheme,undefined,[record(snapshot).value,request.profile,'pinned-diagnostic-target',request.limits]);
}
const suite = generateNativeThemeSuite();
async function fixtureOperation(test: NativeThemeDiagnosticCase): Promise<unknown> {
  const request = test.request, fixture = suite.fixtures.find(entry => `${entry.id}/${entry.profile}` === request.fixture);
  if (!fixture) throw new Error('Missing authored diagnostic fixture');
  const acquired: AcquiredInput = {root:fixture.input.root,edges:fixture.input.edges,resources:fixture.input.resources.map(entry => ({
    id:entry.id,format:'json',bytes:new TextEncoder().encode(entry.bytes),
  }))};
  const snapshot = snapshotInput(acquired);
  if (snapshot.kind !== 'ok') return snapshot;
  const normalized = normalizeTheme(snapshot.value,fixture.profile,JSON.stringify(suite.targets));
  if (normalized.kind !== 'ok') return normalized;
  const compiled: unknown = await Reflect.apply(NativeTheme.compile,NativeTheme,[normalized.value,test.operation === 'compileTheme' ? request.limits : undefined]);
  if (record(compiled).kind !== 'ok' || test.operation === 'compileTheme') {
    const possible = record(compiled).value;
    if (possible instanceof NativeTheme) possible.dispose();
    return compiled;
  }
  const theme = record(compiled).value;
  if (!(theme instanceof NativeTheme)) throw new Error('Invalid compiled diagnostic theme');
  try {
    const paths: unknown = Reflect.apply(encodePathPacket,undefined,[request.paths,request.inputLimits]);
    if (record(paths).kind !== 'ok') return paths;
    const result: unknown = Reflect.apply(theme.resolve,theme,[record(paths).value,request.limits]);
    if (record(result).kind !== 'ok') return result;
    const styles = record(result).value;
    if (!Array.isArray(styles)) throw new Error('Invalid diagnostic styles');
    return {kind:'ok',styleCount:styles.length};
  } finally { theme.dispose(); }
}
describe('independently authored amended boundary expectations', () => {
  for (const test of nativeThemeDiagnosticFixtures().cases) {
    it(test.id,async () => { expect(await run(test)).toMatchObject(test.expected); });
  }
  it('also rejects nonfinite numeric limits and unknown options in memory', async () => {
    for (const steps of [NaN,Infinity,-Infinity]) {
      const result: unknown = await Reflect.apply(NativeTheme.compilePacket,NativeTheme,[new Uint8Array(48),{steps}]);
      expect(result).toMatchObject({kind:'invalid',code:'schema',location:{kind:'request'}});
    }
  });
});
