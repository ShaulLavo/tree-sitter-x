import type { NativeLanguage } from './packs.ts';

// Fence admission is independent of root-pack availability and registration aliases.
export const MARKDOWN_CHILD_ALIASES = Object.freeze([
  ['json', 'json'], ['typescript', 'typescript'], ['ts', 'typescript'],
  ['cts', 'typescript'], ['mts', 'typescript'], ['tsx', 'tsx'],
] as const satisfies readonly (readonly [string, NativeLanguage])[]);
