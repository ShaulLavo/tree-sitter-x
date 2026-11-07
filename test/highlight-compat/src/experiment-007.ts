import { readFileSync } from 'node:fs';
import { sha256 } from './baselines/assets.ts';
import type { BaselineId } from './baselines/run.ts';
import type { NativePack } from './native/component.ts';
import type { NativeLanguage } from './native/packs.ts';
import { loadLanguagePack } from './native/packs.ts';
import { MARKDOWN_CHILD_ALIASES } from './native/markdown-membership.ts';

interface FixedPack {
  readonly id: NativeLanguage;
  readonly version: 'pilot-1';
  readonly manifestSha256: string;
  readonly queries: readonly (readonly [path: string, sha256: string])[];
}

const packs = [
  { id: 'json', version: 'pilot-1', manifestSha256: 'cba12f44071b2115fbd1fa11e75fa0da1ba3294fa7e294efbe2b585b44828964',
    queries: [['json.scm', '2a7d911634197084f96a7ebc6f149f8bc29012b45943268d0939d049d0fbaccf']] },
  { id: 'typescript', version: 'pilot-1', manifestSha256: '0e76a226b692093d49a8c94e98780ea1531dcf05e7380ab15da872b9b381ecad',
    queries: [['../shared/typescript-common.scm', 'cae8b225ed5e030a84d73faaca32d3555a72377a1b67aa3f6f412b8224ffc883'],
      ['typescript.scm', 'd6b156c103872bee92baa350165887cdcdb51b8c558958dd95027086ee211cb8']] },
  { id: 'tsx', version: 'pilot-1', manifestSha256: '7ebacb0df09270d968ff328b8b00de6423618051ead437a3e59afa48e3bd5fdf',
    queries: [['../shared/typescript-common.scm', 'cae8b225ed5e030a84d73faaca32d3555a72377a1b67aa3f6f412b8224ffc883'],
      ['tsx.scm', '1314dc639dd49af412f5031550497a3c8fc5c46e111d8a8ab366da473eb30bc2']] },
] as const satisfies readonly FixedPack[];

export const EXPERIMENT_007 = Object.freeze({
  packs,
  languages: ['json', 'typescript', 'tsx', 'markdown', 'javascript', 'jsx'],
  baselines: ['baseline:captures', 'baseline:vscode-ts'],
  references: ['raw', 'product', 'shiki-api'],
  markdownReferences: ['raw', 'product', 'shiki-api', 'product:warm'],
  strictReferences: ['raw', 'product'],
  markdownChildren: MARKDOWN_CHILD_ALIASES,
  report: new URL('../reports/native-pilot.md', import.meta.url),
  corpusCount: 44,
  corpusSha256: '9432a17cd3b922025decb15bb3f4f1b7067383da23ae1221f5c2e23de3a82a5e',
  referencesSha256: 'f8c92516fa9f660ccbd76c90a7e84e4d9d581e5be7e9772fd4c6becec23a77d9',
} as const);

// Both historical reports retain their original applicability, even as diagnostics grow.
export function historicalBaselineSupport(profileId: BaselineId, languageId: string): string | undefined {
  if (!['javascript', 'typescript', 'tsx', 'json', 'markdown'].includes(languageId)) return `no pinned pilot parser for ${languageId}`;
  if (profileId === 'baseline:vscode-ts' && languageId !== 'typescript' && languageId !== 'tsx') return 'VS Code TypeScript query applies only to the TypeScript and TSX variants';
  if (languageId === 'markdown') return 'pinned tree-sitter-md 0.1.1 uses MarkdownDocument.highlights; no external highlights query or markdown_inline parser is configured';
  return undefined;
}

function fixedBytes(id: string, path: string, expected: string): string {
  const bytes = readFileSync(new URL(`../../../lib/scope-compat/packs/${id}/${path}`, import.meta.url), 'utf8');
  if (sha256(bytes) !== expected) throw new Error(`007 ${id}/${path}: fixed experiment bytes changed`);
  return bytes;
}

export function historicalPackManifests(): Record<string, string> {
  return Object.fromEntries(packs.map(pack => [pack.id, fixedBytes(pack.id, 'pack.json', pack.manifestSha256)]));
}

export function checkHistoricalPack(pack: NativePack, expected: FixedPack): void {
  const query = expected.queries.map(([path, hash]) => fixedBytes(expected.id, path, hash)).join('\n');
  if (pack.spec.id !== expected.id || pack.spec.languageId !== expected.id || pack.spec.version !== expected.version || pack.engine.querySha256 !== sha256(query)) {
    throw new Error(`007 ${expected.id}: loaded pack differs from fixed experiment`);
  }
}

export async function loadHistoricalPacks(): Promise<ReadonlyMap<string, NativePack>> {
  const loaded = new Map<string, NativePack>();
  try {
    historicalPackManifests();
    for (const expected of EXPERIMENT_007.packs) {
      const pack = await loadLanguagePack(expected.id);
      loaded.set(expected.id, pack);
      checkHistoricalPack(pack, expected);
    }
    return loaded;
  } catch (error) {
    for (const pack of loaded.values()) pack.dispose();
    throw error;
  }
}
