import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { buildNativeReport } from '../src/native-report.ts';
import { buildBaselineReport } from '../src/baseline-report.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { loadLanguagePack } from '../src/native/packs.ts';

vi.mock('../src/native/packs.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/native/packs.ts')>();
  const roots: readonly string[] = actual.NATIVE_LANGUAGES;
  return { ...actual, NATIVE_LANGUAGES: roots.concat(['javascript', 'jsx']),
    loadLanguagePack: vi.fn(actual.loadLanguagePack) };
});

it('keeps the complete 007 report byte-identical with extra root capabilities', async () => {
  expect(await buildNativeReport()).toBe(readFileSync(new URL('../reports/native-pilot.md', import.meta.url), 'utf8'));
  expect(vi.mocked(loadLanguagePack).mock.calls.map(call => call[0])).toEqual(['json', 'typescript', 'tsx']);
}, 30000);

it('keeps the original baseline report byte-identical after JSX becomes diagnostic-capable', async () => {
  expect(await buildBaselineReport()).toBe(readFileSync(new URL('../reports/baselines.md', import.meta.url), 'utf8'));
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
