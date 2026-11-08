import { nativeThemeTargets } from '../oracles/native-theme-reference.ts';
import { normalizeTheme, snapshotInput } from '../native/theme-input.ts';
import type { NormalizedTheme } from '../native/theme-input.ts';
import type { SessionCase } from './session-case.ts';

export function normalizedThemes(input: SessionCase): readonly [NormalizedTheme, NormalizedTheme] {
  const target = JSON.stringify(nativeThemeTargets());
  return Object.freeze([normalize(input.themeJson[0], target), normalize(input.themeJson[1], target)]);
}
function normalize(text: string, target: string): NormalizedTheme {
  const input = snapshotInput({ root: 'measurement:root', edges: [], resources: [{ id: 'measurement:root', format: 'json', bytes: new TextEncoder().encode(text) }] });
  if (input.kind !== 'ok') throw new Error(`Invalid session theme: ${JSON.stringify(input)}`);
  const normalized = normalizeTheme(input.value, 'product', target);
  if (normalized.kind !== 'ok') throw new Error(`Invalid session theme: ${JSON.stringify(normalized)}`);
  return normalized.value;
}
