import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { generateNativeThemeSuite } from '../src/oracles/native-theme-reference.ts';
import type { NativeThemeFixture, NativeThemeField, NativeThemePartial } from '../src/oracles/native-theme-schema.ts';
import { NativeTheme } from '../src/native/theme.ts';
import { normalizeTheme, snapshotInput } from '../src/native/theme-input.ts';
import { encodePathPacket } from '../src/native/theme-packet.ts';
import { appliedStyle, namedStyle } from '../src/native/theme-projection.ts';
import type { Field, OperationalFailure, Outcome, PartialStyle } from '../src/native/theme-contract.ts';

function value<T>(outcome: Outcome<T> | OperationalFailure): T {
  if (outcome.kind !== 'ok') throw new Error(JSON.stringify(outcome));
  return outcome.value;
}
function color(field: NativeThemeField<string>): Field<number> {
  return field.kind === 'inherit' ? field : {kind:'set',value:parseInt(field.value.slice(1),16)};
}
function partial(style: NativeThemePartial): PartialStyle {
  return {foreground:color(style.foreground),background:color(style.background),fontMask:style.fontMask};
}
async function compareFixture(fixture: NativeThemeFixture, target: string): Promise<void> {
  const input = {root:fixture.input.root,edges:fixture.input.edges,resources:fixture.input.resources.map(resource => ({
    id:resource.id,format:'json' as const,bytes:new TextEncoder().encode(resource.bytes),
  }))};
  const normalized = normalizeTheme(value(snapshotInput(input)),fixture.profile,target);
  expect(normalized.kind === 'ok' ? normalized.warnings : []).toEqual(fixture.input.warnings);
  const theme = value(await NativeTheme.compile(value(normalized)));
  try {
    for (const test of fixture.cases) compareCase(fixture,test,theme);
  } finally { theme.dispose(); }
}
function compareCase(fixture: NativeThemeFixture, test: NativeThemeFixture['cases'][number], theme: NativeTheme): void {
  const paths = value(encodePathPacket([test.scopes])), styles = value(theme.resolve(paths));
  expect(styles[paths.ids[0]],`${fixture.id}/${fixture.profile}/${test.id}`).toEqual({
    foreground:parseInt(test.effective.foreground.slice(1),16),background:parseInt(test.effective.background.slice(1),16),fontMask:test.effective.fontMask,
  });
  expect(namedStyle(styles[paths.ids[0]])).toEqual(test.effective);
  expect(appliedStyle(fixture.profile,styles[paths.ids[0]])).toEqual(test.applied);
  const prefixes = value(encodePathPacket(test.scopes.map((_,i) => test.scopes.slice(0,i+1))));
  test.trace.forEach((trace,index) => {
    const match = value(theme.match(prefixes,prefixes.ids[index]));
    expect(match.style,`${fixture.id}/${fixture.profile}/${test.id}/${trace.scope}`).toEqual(partial(trace.partial));
  });
}
describe('native matcher against independent reference fixtures', () => {
  it('preserves the exact recorded oracle identity and every named effective and partial field', async () => {
    const suite = generateNativeThemeSuite();
    expect(suite.identity).toBe('f15b57bcab036a46dacbe5ba980c9e5585fdf6c57875cd98e03cda4fb39e4f7e');
    const recorded: unknown = JSON.parse(await readFile(new URL('../manifest/native-themes/suite.json',import.meta.url),'utf8'));
    expect(suite).toEqual(recorded);
    for (const fixture of suite.fixtures) await compareFixture(fixture,JSON.stringify(suite.targets));
  });
});
