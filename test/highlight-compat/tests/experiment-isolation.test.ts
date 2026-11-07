import { expect, it, vi } from 'vitest';
import { historicalBaselineSupport, loadHistoricalPacks } from '../src/experiment-007.ts';
import { baselineScopes, baselineSupport } from '../src/baselines/run.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { loadLanguagePack } from '../src/native/packs.ts';

vi.mock('../src/native/packs.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/native/packs.ts')>();
  const roots: readonly string[] = actual.NATIVE_LANGUAGES;
  return { ...actual, NATIVE_LANGUAGES: roots.concat(['javascript', 'jsx']),
    loadLanguagePack: vi.fn(actual.loadLanguagePack) };
});

it('loads only the fixed 007 packs with extra root capabilities', async () => {
  const packs = await loadHistoricalPacks();
  try {
    expect(Array.from(packs.keys())).toEqual(['json', 'typescript', 'tsx']);
    expect(Array.from(packs, ([id, pack]) => [id, pack.engine.packId, pack.engine.packVersion])).toEqual([
      ['json', 'json', 'pilot-1'], ['typescript', 'typescript', 'pilot-1'], ['tsx', 'tsx', 'pilot-1'],
    ]);
    expect(vi.mocked(loadLanguagePack).mock.calls.map(call => call[0])).toEqual(['json', 'typescript', 'tsx']);
  } finally { for (const pack of packs.values()) pack.dispose(); }
}, 30000);

it('keeps historical applicability separate from actual JSX diagnostic capability', async () => {
  expect(baselineSupport('baseline:captures', 'jsx')).toBeUndefined();
  const jsx = await baselineScopes('baseline:captures', 'jsx', '<i />');
  expect(jsx.intervals.find(interval => interval.scopes.includes('entity.name.tag'))?.scopes[0]).toBe('source.js.jsx');
  expect(historicalBaselineSupport('baseline:captures', 'jsx')).toBe('no pinned pilot parser for jsx');
  expect(historicalBaselineSupport('baseline:captures', 'javascript')).toBeUndefined();
  expect(historicalBaselineSupport('baseline:vscode-ts', 'jsx')).toBe('no pinned pilot parser for jsx');
  expect(historicalBaselineSupport('baseline:vscode-ts', 'javascript')).toContain('only to the TypeScript and TSX');
}, 30000);

it('does not admit extra root capabilities or aliases as Markdown children', async () => {
  const names = ['javascript', 'js', 'jsx', 'node', 'json', 'ts', 'typescript', 'cts', 'mts', 'tsx'];
  const source = names.map(name => `\`\`\`${name}\nconst value = 1;\n\`\`\`\n`).join('').concat(
    '> ```ts\n> const nested = 1\n> ```\n\n- ```json\n  {}\n  ```\n\n',
    '```unknown\nx\n```\n```\nx\n```\n```markdown\nx\n```\n```md\nx\n```\n```ts\n```\n');
  const owner = await MarkdownPilotDocument.open(source);
  try {
    expect(owner.children.map(child => child.languageId)).toEqual(['json', 'typescript', 'typescript', 'typescript', 'typescript', 'tsx']);
    expect(owner.observation.childParses).toBe(6);
    for (const name of names.slice(0, 4)) expect(owner.diagnostics.join('\n')).toContain(`missing language ${name}`);
    expect(owner.diagnostics.join('\n')).toContain('unsupported nested fence ts');
    expect(owner.diagnostics.join('\n')).toContain('unsupported nested fence json');
    expect(owner.diagnostics.join('\n')).toContain('missing language unknown');
    expect(owner.diagnostics.join('\n')).toContain('frame only: empty info');
    expect(owner.diagnostics.join('\n')).toContain('frame only: markdown');
    expect(owner.diagnostics.join('\n')).toContain('frame only: md');
  } finally { owner.dispose(); }
});
