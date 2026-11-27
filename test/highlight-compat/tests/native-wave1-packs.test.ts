import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { checkWave1Assets, WAVE1_LANGUAGES } from '../src/native/wave1-assets.ts';
import { loadLanguagePack, nativeLanguage } from '../src/native/packs.ts';
import { Component } from '../src/native/component.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { nativeScopes } from '../src/native/adapter.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { decodedSnapshot } from '../src/native/scope-output.ts';
import { catalog } from '../src/measurement/identity.ts';
import type { NativePack } from '../src/native/component.ts';
import type { PassResult } from '../src/native/decode.ts';

function scopesAt(pack: NativePack, result: PassResult, offset: number): string[] {
  expect(result.status).toBe(0);
  if (result.status !== 0) throw new Error(`Native scope pass failed with status ${result.status}`);
  for (let i = 0; i < result.segments.length; i += 3) {
    if (offset < result.segments[i] || offset >= result.segments[i + 1]) continue;
    return result.paths[result.segments[i + 2]].map(id => pack.scopes[id]);
  }
  throw new Error(`No native segment at ${offset}`);
}

const FIXTURE_FILES = Object.freeze({
  css: './fixtures/wave-1/css/sample.css',
  html: './fixtures/wave-1/html/sample.html',
  shellscript: './fixtures/wave-1/shellscript/sample.sh',
  rust: './fixtures/wave-1/rust/sample.rs',
  python: './fixtures/wave-1/python/sample.py',
  go: './fixtures/wave-1/go/sample.go',
  yaml: './fixtures/wave-1/yaml/sample.yaml',
  toml: './fixtures/wave-1/toml/sample.toml',
} as const);

describe('Phase 5 Wave 1 core language packs', () => {
  it('verifies all vendored Wave 1 WASM grammars against manifest/tree-sitter-languages.json', () => {
    expect(checkWave1Assets()).toEqual([]);
  });

  it('resolves canonical Wave 1 aliases across packs, Component.loadPack, owners, and measurement catalog', async () => {
    expect(nativeLanguage('bash')).toBe('shellscript');
    expect(nativeLanguage('sh')).toBe('shellscript');
    expect(nativeLanguage('rs')).toBe('rust');
    expect(nativeLanguage('py')).toBe('python');
    expect(nativeLanguage('yml')).toBe('yaml');
    const pack = await loadLanguagePack('bash');
    const customPack = await (await Component.load()).loadPack({
      id: 'alias-bash-check', version: 'test', languageId: 'bash',
      rootScope: 'source.shell', suffix: '.shell',
      files: [{ path: 'alias-bash.scm', query: '(word) @variable.other' }],
    });
    const owner = await PilotDocument.open('bash', 'export FOO="bar"\n');
    try {
      expect(owner.languageId).toBe('shellscript');
      expect(customPack.spec.languageId).toBe('shellscript');
      expect(customPack.engine.parserLanguageId).toBe('shellscript');
      const result = nativeScopes(pack, owner);
      expect(scopesAt(pack, result, 0)).toContain('storage.modifier.export.shell');
      expect(nativeScopes(customPack, owner).status).toBe(0);
      const summary = await catalog(nativeLanguage('bash')!);
      expect(summary.languages.find(entry => entry.id === 'shellscript')?.status).toBe('measured-partial-prototype');
    } finally {
      owner.dispose();
      customPack.dispose();
      pack.dispose();
    }
  });

  it.each(WAVE1_LANGUAGES)('loads and scopes %s cleanly with deterministic session output', async language => {
    const source = await readFile(new URL(FIXTURE_FILES[language], import.meta.url), 'utf8');
    const pack = await loadLanguagePack(language);
    const owner = await PilotDocument.open(language, source);
    const session = ScopeSession.attach(owner, new Map([[language, pack]]));
    const view = session.attachView({ from: 0, to: source.length });
    try {
      const direct = nativeScopes(pack, owner);
      expect(direct.status).toBe(0);
      if (direct.status !== 0) throw new Error(`Unexpected failure status ${direct.status}`);
      expect(direct.segments.length).toBeGreaterThan(0);
      session.flushOne();
      const lease = session.acquire(view);
      try {
        expect(session.outcome(view)?.kind).toBe('complete');
        const intervals = lease ? decodedSnapshot(lease.snapshot) : [];
        expect(intervals.length).toBeGreaterThan(0);
        expect(intervals.at(0)?.from).toBe(0);
        expect(intervals.at(-1)?.to).toBe(source.length);
      } finally { lease?.release(); }
    } finally {
      session.dispose(); owner.dispose(); pack.dispose();
    }
  });

  it('emits expected TextMate scopes for representative Wave 1 tokens', async () => {
    const checks: readonly (readonly [typeof WAVE1_LANGUAGES[number], string, string, string])[] = [
      ['css', '.card { color: #ff00aa; }', '#ff00aa', 'constant.other.color.rgb-value.hex.css'],
      ['html', '<a href="/docs">Docs</a>', 'href', 'entity.other.attribute-name.html'],
      ['shellscript', 'export FOO="bar"\necho "$FOO"\n', 'export', 'storage.modifier.export.shell'],
      ['rust', 'pub struct Box<T>(T);\n', 'struct', 'storage.type.rust'],
      ['rust', 'pub struct Box<T>(T);\n', '<', 'punctuation.brackets.angle.rust'],
      ['python', 'async def run(x: int) -> bool:\n    return True\n', 'async', 'storage.type.function.async.python'],
      ['go', 'func Add(a int) error { return nil }\n', 'Add', 'entity.name.function.go'],
      ['yaml', 'name: demo\nenabled: true\n', 'name', 'entity.name.tag.yaml'],
      ['toml', '[package]\nname = "demo"\n', 'package', 'entity.name.section.toml'],
    ];
    for (const [lang, source, needle, expectedScope] of checks) {
      const pack = await loadLanguagePack(lang);
      const owner = await PilotDocument.open(lang, source);
      try {
        const result = nativeScopes(pack, owner);
        expect(scopesAt(pack, result, source.indexOf(needle))).toContain(expectedScope);
      } finally { owner.dispose(); pack.dispose(); }
    }
  });

  it('handles priority, dotted-key, and delimiter edge cases across Wave 1 packs', async () => {
    const check = async (lang: typeof WAVE1_LANGUAGES[number], source: string, assertions: (at: (offset: number) => string[]) => void) => {
      const pack = await loadLanguagePack(lang);
      const owner = await PilotDocument.open(lang, source);
      try {
        const result = nativeScopes(pack, owner);
        assertions(offset => scopesAt(pack, result, offset));
      } finally { owner.dispose(); pack.dispose(); }
    };
    await check('css', 'a + b { width: calc(1px + 2px); }', at => {
      expect(at(2)).toContain('keyword.operator.combinator.css');
      expect(at(24)).toContain('keyword.operator.arithmetic.css');
      expect(at(24)).not.toContain('keyword.operator.combinator.css');
    });
    await check('python', 'def F(A):\n  pass\n', at => {
      expect(at(4)).toContain('entity.name.function.python');
      expect(at(4)).not.toContain('constant.other.caps.python');
      expect(at(6)).toContain('variable.parameter.function.language.python');
      expect(at(6)).not.toContain('constant.other.caps.python');
    });
    await check('rust', 'struct Foo;\nfn F() {}\n', at => {
      expect(at(7)).toContain('entity.name.type.struct.rust');
      expect(at(15)).toContain('entity.name.function.rust');
      expect(at(15)).not.toContain('constant.other.caps.rust');
    });
    await check('toml', '[a."b".c]\na."b".c = 42\n', at => {
      expect(at(1)).toContain('entity.name.section.toml');
      expect(at(4)).toContain('entity.name.section.toml');
      expect(at(7)).toContain('entity.name.section.toml');
      expect(at(10)).toContain('variable.other.key.toml');
      expect(at(13)).toContain('variable.other.key.toml');
      expect(at(16)).toContain('variable.other.key.toml');
    });
    await check('html', '<p>&amp; &amp</p>', at => {
      expect(at(3)).toContain('punctuation.definition.entity.html');
      expect(at(7)).toContain('punctuation.definition.entity.html');
      expect(at(12)).not.toContain('punctuation.definition.entity.html');
      expect(at(12)).not.toContain('constant.character.entity.html');
    });
    await check('shellscript', 'echo "hello"\n', at => {
      expect(at(5)).toContain('punctuation.definition.string.begin.shell');
      expect(at(11)).toContain('punctuation.definition.string.end.shell');
      expect(at(11)).not.toContain('punctuation.definition.string.begin.shell');
    });
    await check('go', 'package p\nconst s = "hello"\n', at => {
      expect(at(20)).toContain('punctuation.definition.string.begin.go');
      expect(at(26)).toContain('punctuation.definition.string.end.go');
      expect(at(26)).not.toContain('punctuation.definition.string.begin.go');
    });
  });

  it('decorates Markdown headings, inline styles, links, lists, blockquotes, and fenced blocks', async () => {
    const source = await readFile(new URL('./fixtures/wave-1/markdown/sample.md', import.meta.url), 'utf8');
    const packs = new Map([
      ['typescript', await loadLanguagePack('typescript')],
      ['json', await loadLanguagePack('json')],
    ]);
    const owner = await MarkdownPilotDocument.open(source);
    try {
      const intervals = owner.intervals(packs);
      const scopeAt = (needle: string, extraOffset = 0) => {
        const offset = source.indexOf(needle) + extraOffset;
        expect(offset).toBeGreaterThanOrEqual(0);
        return intervals.find(item => offset >= item.from && offset < item.to)?.scopes ?? [];
      };
      expect(scopeAt('# Release Notes')).toContain('punctuation.definition.heading.markdown');
      expect(scopeAt('# Release Notes')).not.toContain('entity.name.section.markdown');
      expect(scopeAt('Release Notes')).toContain('heading.1.markdown');
      expect(scopeAt('Release Notes')).toContain('entity.name.section.markdown');
      expect(scopeAt('bold')).toContain('markup.bold.markdown');
      expect(scopeAt('italic')).toContain('markup.italic.markdown');
      expect(scopeAt('inline_code')).toContain('markup.inline.raw.string.markdown');
      expect(scopeAt('architecture guide')).toContain('string.other.link.title.markdown');
      expect(scopeAt('https://example.com/docs')).toContain('markup.underline.link.markdown');
      expect(scopeAt('Incremental scoping')).toContain('markup.quote.markdown');
      expect(scopeAt('answer')).toContain('variable.other.constant.ts');
    } finally {
      owner.dispose();
      for (const pack of packs.values()) pack.dispose();
    }
  });

  it('scopes escaped-bracket Markdown links and optional link titles cleanly without quadratic blowup', async () => {
    const edgeSource = '# Heading\n\n[A\\](B](https://a.test) and [A](https://a.test "Title") and [C](<https://c.test> "T")\n';
    const owner = await MarkdownPilotDocument.open(edgeSource);
    try {
      const intervals = owner.intervals(new Map());
      const at = (offset: number) => intervals.find(item => offset >= item.from && offset < item.to)?.scopes ?? [];
      expect(at(0)).toContain('punctuation.definition.heading.markdown');
      expect(at(0)).not.toContain('entity.name.section.markdown');
      expect(at(2)).toContain('entity.name.section.markdown');
      const escapedLabel = edgeSource.indexOf('(B');
      expect(at(escapedLabel)).toContain('string.other.link.title.markdown');
      expect(at(escapedLabel)).not.toContain('markup.underline.link.markdown');
      const firstUrl = edgeSource.indexOf('https://a.test');
      expect(at(firstUrl)).toContain('markup.underline.link.markdown');
      const titlePos = edgeSource.indexOf('"Title"');
      expect(at(titlePos)).toContain('string.other.link.description.title.markdown');
      expect(at(titlePos)).not.toContain('markup.underline.link.markdown');
      const angleUrl = edgeSource.indexOf('https://c.test');
      expect(at(angleUrl)).toContain('markup.underline.link.markdown');
    } finally { owner.dispose(); }
  });
});
