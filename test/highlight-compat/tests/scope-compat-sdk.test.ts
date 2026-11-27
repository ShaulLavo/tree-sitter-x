import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_PACKS,
  FONT_STYLE_BOLD,
  FONT_STYLE_ITALIC,
  ScopeCompat,
  ZED_PLUS_CAPTURE_MAP,
  getBuiltinPack,
  highlightTreeWithFallback,
  parseColorRgba,
  resolveLanguageAlias,
  resolveZedPlusScopes,
} from '../../../lib/scope-compat/js/index.ts';
import type {
  ScopeResult,
  StyledResult,
  TreeSitterBinding,
  TreeSitterLanguage,
  TreeSitterQuery,
  TreeSitterTextBuffer,
  TreeSitterTree,
  VscodeThemeInput,
} from '../../../lib/scope-compat/js/index.ts';
import { checkComponent, componentPath, repositoryRoot } from '../src/native/component-inputs.ts';
import { Runtime, foreign, invoke, release } from '../src/native/runtime.ts';
import { themeModule } from '../src/oracles/assets.ts';
import { rawDocument } from '../src/oracles/raw.ts';
import { textmateEngine } from '../src/oracles/textmate.ts';
import { querySource } from '../src/baselines/assets.ts';
import { ORACLE_THEMES } from '../src/oracles/pins.ts';

interface ManifestAssets {
  readonly themes: readonly { readonly id: string }[];
}

async function loadSdk(): Promise<{
  readonly runtime: Runtime;
  readonly binding: TreeSitterBinding;
  readonly compat: ScopeCompat;
}> {
  const runtime = await Runtime.load();
  const wasmBytes = await readFile(resolve(repositoryRoot, componentPath));
  await checkComponent();
  const binding = runtime.binding as unknown as TreeSitterBinding;
  const compat = await ScopeCompat.load(binding, wasmBytes);
  return { runtime, binding, compat };
}

async function loadPackFromDisk(compat: ScopeCompat, runtime: Runtime, languageId: string) {
  const meta = getBuiltinPack(languageId);
  if (!meta) throw new Error(`Missing built-in pack metadata for ${languageId}`);
  const queryParts = await Promise.all(
    meta.queryPaths.map(rel => readFile(resolve(repositoryRoot, 'lib/scope-compat', rel), 'utf8')),
  );
  const language = (await runtime.language(meta.languageId)) as unknown as TreeSitterLanguage;
  return compat.compilePack(language, {
    languageId: meta.languageId,
    rootScope: meta.rootScope,
    scopeSuffix: meta.scopeSuffix,
    query: queryParts.join('\n'),
  });
}

function scopeAtOffset(result: ScopeResult, offset: number): readonly string[] {
  const seg = result.segments;
  for (let i = 0; i < seg.length; i += 3) {
    if (offset >= seg[i] && offset < seg[i + 1]) {
      return result.paths[seg[i + 2]].map(id => result.scopes[id]);
    }
  }
  throw new Error(`No segment covering offset ${offset}`);
}

function styleAtOffset(styled: StyledResult, offset: number): { readonly fg: number; readonly bg: number; readonly font: number } {
  const seg = styled.segments;
  for (let i = 0; i < seg.length; i += 3) {
    if (offset >= seg[i] && offset < seg[i + 1]) {
      const id = seg[i + 2];
      return { fg: styled.foregroundRgba[id], bg: styled.backgroundRgba[id], font: styled.fontMask[id] };
    }
  }
  throw new Error(`No styled segment covering offset ${offset}`);
}

describe('Phase 6 public zero-Shiki consumer SDK (lib/scope-compat/js)', () => {
  it('contains zero Shiki, Oniguruma, vscode-textmate, or Node-only imports in lib/scope-compat/js and package.json', async () => {
    const pkgRaw = await readFile(resolve(repositoryRoot, 'lib/scope-compat/package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    expect(pkg.dependencies).toBeUndefined();
    expect(pkgRaw).not.toMatch(/shiki|oniguruma|vscode-textmate|vscode-oniguruma/i);
    const jsDir = resolve(repositoryRoot, 'lib/scope-compat/js');
    const files = (await readdir(jsDir)).filter(name => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(7);
    const forbidden = /\b(?:shiki|vscode-textmate|vscode-oniguruma|oniguruma|node:)\b/i;
    for (const file of files) {
      const text = await readFile(resolve(jsDir, file), 'utf8');
      expect(text, file).not.toMatch(forbidden);
    }
  });

  it('exposes built-in pack metadata and canonical aliases for all 13 packs', () => {
    expect(Object.keys(BUILTIN_PACKS).sort()).toEqual([
      'css', 'go', 'html', 'javascript', 'json', 'jsx',
      'python', 'rust', 'shellscript', 'toml', 'tsx', 'typescript', 'yaml',
    ]);
    expect(resolveLanguageAlias('bash')).toBe('shellscript');
    expect(resolveLanguageAlias('TS')).toBe('typescript');
    expect(resolveLanguageAlias('py')).toBe('python');
    expect(resolveLanguageAlias('rs')).toBe('rust');
    expect(getBuiltinPack('yml')?.rootScope).toBe('source.yaml');
  });

  it('reuses caller Tree and TextBuffer with zero extra parse and zero allocation leaks', async () => {
    const { runtime, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const pack = await loadPackFromDisk(compat, runtime, 'typescript');
    const source = 'export const answer: number = 42;\nfunction add(a: number, b: number) { return a + b; }\n';
    const buffer = runtime.construct('TextBuffer', [source]);
    const parser = runtime.construct('Parser');
    invoke(parser, 'setLanguage', [pack.language]);
    const tree = foreign(invoke(parser, 'parse', [buffer]));
    const prototype = foreign(foreign(runtime.binding.Parser).prototype) as { parse: (...args: unknown[]) => unknown };
    const parseSpy = vi.spyOn(prototype, 'parse');
    try {
      const result = compat.highlightTree(pack, tree as unknown as TreeSitterTree, buffer as unknown as TreeSitterTextBuffer);
      expect(parseSpy).not.toHaveBeenCalled();
      expect(result.sourceLength).toBe(source.length);
      expect(result.segments).toBeInstanceOf(Uint32Array);
      expect(scopeAtOffset(result, source.indexOf('answer'))).toContain('variable.other.constant.ts');
      expect(scopeAtOffset(result, source.indexOf('add'))).toContain('entity.name.function.ts');
      expect(scopeAtOffset(result, source.indexOf('42'))).toContain('constant.numeric.decimal.ts');
    } finally {
      parseSpy.mockRestore();
      release(tree);
      release(parser);
      release(buffer);
      pack.dispose();
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('switches themes independently via native C matcher without re-scoping and matches raw TextMate oracle styles', async () => {
    const { runtime, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const pack = await loadPackFromDisk(compat, runtime, 'typescript');
    const source = 'const value: string = "hello";\n// comment\nexport function run(x: number) { return x + 1; }\n';
    const buffer = runtime.construct('TextBuffer', [source]);
    const parser = runtime.construct('Parser');
    invoke(parser, 'setLanguage', [pack.language]);
    const tree = foreign(invoke(parser, 'parse', [buffer]));
    const darkThemeInput = (await themeModule('github-dark-default')) as unknown as VscodeThemeInput;
    const lightThemeInput = (await themeModule('github-light-default')) as unknown as VscodeThemeInput;
    const darkTheme = compat.compileTheme(darkThemeInput);
    const lightTheme = compat.compileTheme(lightThemeInput);
    const session = compat.createSession(pack);
    const highlightSpy = vi.spyOn(compat, 'highlightTree');
    try {
      session.update(tree as unknown as TreeSitterTree, buffer as unknown as TreeSitterTextBuffer);
      expect(highlightSpy).toHaveBeenCalledTimes(1);
      const darkStyled = session.resolveTheme(darkTheme);
      const lightStyled = session.resolveTheme(lightTheme);
      // Zero re-scoping on theme switch!
      expect(highlightSpy).toHaveBeenCalledTimes(1);
      expect(darkStyled.segments).toBeInstanceOf(Uint32Array);
      expect(darkStyled.foregroundRgba).toBeInstanceOf(Uint32Array);
      expect(darkStyled.backgroundRgba).toBeInstanceOf(Uint32Array);
      expect(darkStyled.fontMask).toBeInstanceOf(Uint8Array);
      expect(darkStyled.defaultBackgroundRgba).not.toBe(lightStyled.defaultBackgroundRgba);
      expect(styleAtOffset(darkStyled, source.indexOf('const')).fg).not.toBe(styleAtOffset(lightStyled, source.indexOf('const')).fg);

      // Verify exact style parity with raw TextMate oracle on representative tokens across reference themes
      const engine = await textmateEngine('upstream');
      const raw = await rawDocument(engine, { profileId: 'raw', languageId: 'typescript', source, themeIds: ORACLE_THEMES });
      if (raw.status !== 'complete') throw new Error(`Expected complete oracle result, got ${raw.status}`);
      for (const themeId of ORACLE_THEMES) {
        const themeInput = (await themeModule(themeId)) as unknown as VscodeThemeInput;
        const compiled = compat.compileTheme(themeInput);
        try {
          const styled = session.resolveTheme(compiled);
          const oracleTrack = raw.styles?.[themeId];
          expect(oracleTrack).toBeDefined();
          for (const token of ['const', '"hello"', '// comment', 'function', 'run', 'return']) {
            const offset = source.indexOf(token);
            const actual = styleAtOffset(styled, offset);
            const expectedSpan = oracleTrack?.spans;
            let expectedStyleId = -1;
            if (expectedSpan) {
              for (let i = 0; i < expectedSpan.length; i += 3) {
                if (offset >= expectedSpan[i] && offset < expectedSpan[i + 1]) {
                  expectedStyleId = expectedSpan[i + 2];
                  break;
                }
              }
            }
            const expectedStyle = oracleTrack?.styles[expectedStyleId];
            expect(expectedStyle).toBeDefined();
            if (expectedStyle?.foreground) {
              expect(actual.fg).toBe(parseColorRgba(expectedStyle.foreground));
            }
          }
        } finally {
          compiled.dispose();
        }
      }
    } finally {
      highlightSpy.mockRestore();
      darkTheme.dispose();
      lightTheme.dispose();
      release(tree);
      release(parser);
      release(buffer);
      pack.dispose();
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('compiles all 65 bundled VS Code themes cleanly with zero Shiki dependency', async () => {
    const { compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const assets = JSON.parse(await readFile(resolve(repositoryRoot, 'test/highlight-compat/manifest/assets.json'), 'utf8')) as ManifestAssets;
    expect(assets.themes.length).toBe(65);
    const sampleScopes: ScopeResult = {
      sourceLength: 5,
      window: { start: 0, end: 5 },
      segments: Uint32Array.from([0, 5, 1]),
      paths: [[], [0, 1]],
      scopes: ['source.ts', 'keyword.control.flow.ts'],
    };
    for (const entry of assets.themes) {
      const themeInput = (await themeModule(entry.id)) as unknown as VscodeThemeInput;
      const compiled = compat.compileTheme(themeInput);
      try {
        const styled = compiled.resolve(sampleScopes);
        expect(styled.segments.length).toBe(3);
      } finally {
        compiled.dispose();
      }
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('performs local incremental invalidation in ScopeHighlightSession with exact full-pass equality', async () => {
    const { runtime, compat } = await loadSdk();
    const pack = await loadPackFromDisk(compat, runtime, 'typescript');
    const lines = Array.from({ length: 80 }, (_, i) => `export function fn${i}(x: number): number { return x + ${i}; }`);
    let source = `${lines.join('\n')}\n`;
    const buffer = runtime.construct('TextBuffer', [source]);
    const parser = runtime.construct('Parser');
    invoke(parser, 'setLanguage', [pack.language]);
    let tree = foreign(invoke(parser, 'parse', [buffer]));
    const session = compat.createSession(pack);
    try {
      session.update(tree as unknown as TreeSitterTree, buffer as unknown as TreeSitterTextBuffer);
      expect(session.lastInvalidation?.mode).toBe('full-document');

      // Apply localized edit on line 40
      const needle = 'return x + 40;';
      const from = source.indexOf(needle) + 'return x + '.length;
      const to = from + 2;
      const insert = '999';
      const oldEndPosition = { row: 40, column: to - source.lastIndexOf('\n', from - 1) - 1 };
      const startPosition = { row: 40, column: from - source.lastIndexOf('\n', from - 1) - 1 };
      const newEndPosition = { row: 40, column: startPosition.column + insert.length };
      invoke(tree, 'edit', [{
        startIndex: from,
        oldEndIndex: to,
        newEndIndex: from + insert.length,
        startPosition,
        oldEndPosition,
        newEndPosition,
      }]);
      invoke(buffer, 'edit', [from, to, insert]);
      source = `${source.slice(0, from)}${insert}${source.slice(to)}`;
      const nextTree = foreign(invoke(parser, 'parse', [buffer, tree]));
      const changedRanges = invoke(tree, 'getChangedRanges', [nextTree]) as readonly { readonly startIndex: number; readonly endIndex: number }[];
      release(tree);
      tree = nextTree;

      const incremental = session.update(
        tree as unknown as TreeSitterTree,
        buffer as unknown as TreeSitterTextBuffer,
        { edits: [{ from, to, insertLength: insert.length }], changedRanges, source },
      );
      expect(session.lastInvalidation?.mode).toBe('local-range');
      expect(session.lastInvalidation!.newRange.to - session.lastInvalidation!.newRange.from).toBeLessThan(source.length / 4);

      const fresh = compat.highlightTree(pack, tree as unknown as TreeSitterTree, buffer as unknown as TreeSitterTextBuffer);
      for (let offset = 0; offset < source.length; offset += 17) {
        expect(scopeAtOffset(incremental, offset)).toEqual(scopeAtOffset(fresh, offset));
      }
      expect(scopeAtOffset(incremental, from)).toEqual(scopeAtOffset(fresh, from));
    } finally {
      release(tree);
      release(parser);
      release(buffer);
      pack.dispose();
    }
  });

  it('resolves Zed-plus universal captures with longest-prefix fallback and feeds the native VS Code theme matcher', async () => {
    expect(Object.keys(ZED_PLUS_CAPTURE_MAP).length).toBeGreaterThanOrEqual(70);
    expect(resolveZedPlusScopes('keyword.control.async.custom', '.ts')).toEqual(['keyword.control.ts']);
    expect(resolveZedPlusScopes('@function.method.call', '.rs')).toEqual(['entity.name.function.method.rs']);
    expect(resolveZedPlusScopes('type.struct', '.rs')).toEqual(['entity.name.type.struct.rs']);
    expect(resolveZedPlusScopes('_internal_helper')).toEqual([]);
    expect(resolveZedPlusScopes('unknown.custom.capture')).toEqual([]);

    const { runtime, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const source = 'const greeting = "hello";\nfunction greet(name: string) { return greeting + name; }\n';
    const language = (await runtime.language('typescript')) as unknown as TreeSitterLanguage;
    const parser = runtime.construct('Parser');
    invoke(parser, 'setLanguage', [language]);
    const tree = foreign(invoke(parser, 'parse', [source]));
    const query = runtime.construct('Query', [language, querySource('typescript')]) as unknown as TreeSitterQuery;
    const theme = compat.compileTheme({
      type: 'dark',
      colors: { 'editor.foreground': '#d4d4d4', 'editor.background': '#1e1e1e' },
      tokenColors: [
        { scope: 'storage.type', settings: { foreground: '#569cd6', fontStyle: 'bold' } },
        { scope: 'entity.name.function', settings: { foreground: '#dcdcaa' } },
        { scope: 'string.quoted', settings: { foreground: '#ce9178', fontStyle: 'italic' } },
      ],
    });
    const prototype = foreign(foreign(runtime.binding.Parser).prototype) as { parse: (...args: unknown[]) => unknown };
    const parseSpy = vi.spyOn(prototype, 'parse');
    try {
      const scopes = highlightTreeWithFallback(query, tree as unknown as TreeSitterTree, source, {
        rootScope: 'source.ts',
        scopeSuffix: '.ts',
      });
      expect(parseSpy).not.toHaveBeenCalled();
      expect(scopeAtOffset(scopes, source.indexOf('"hello"'))).toContain('string.quoted.ts');
      expect(scopeAtOffset(scopes, source.indexOf('greet('))).toContain('entity.name.function.ts');

      const styled = theme.resolve(scopes);
      expect(styleAtOffset(styled, source.indexOf('function'))).toMatchObject({
        fg: parseColorRgba('#569cd6'),
        font: FONT_STYLE_BOLD,
      });
      expect(styleAtOffset(styled, source.indexOf('"hello"'))).toMatchObject({
        fg: parseColorRgba('#ce9178'),
        font: FONT_STYLE_ITALIC,
      });
      expect(styleAtOffset(styled, source.indexOf('greet(')).fg).toBe(parseColorRgba('#dcdcaa'));
    } finally {
      parseSpy.mockRestore();
      theme.dispose();
      query.delete();
      release(tree);
      release(parser);
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('handles empty sources, sub-range windows, multi-layer theme overrides, fontStyle reset, and error-path cleanup', async () => {
    const { runtime, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const pack = await loadPackFromDisk(compat, runtime, 'typescript');
    const emptyBuf = runtime.construct('TextBuffer', ['']);
    const parser = runtime.construct('Parser');
    invoke(parser, 'setLanguage', [pack.language]);
    const emptyTree = foreign(invoke(parser, 'parse', [emptyBuf]));
    const source = '// comment\nconst x = 1;\nexport function demo() { return x; }\n';
    const fullBuf = runtime.construct('TextBuffer', [source]);
    const fullTree = foreign(invoke(parser, 'parse', [fullBuf]));
    const fallbackQuery = runtime.construct('Query', [pack.language, querySource('typescript')]) as unknown as TreeSitterQuery;
    const layeredTheme = compat.compileTheme([
      {
        type: 'dark',
        colors: { 'editor.foreground': '#cccccc', 'editor.background': '#111111' },
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#6a9955', fontStyle: 'italic' } },
          { scope: 'keyword', settings: { foreground: 'inherit' } },
        ],
      },
      {
        tokenColors: [
          { scope: 'comment.line', settings: { fontStyle: '' } },
          { scope: 'storage.type', settings: { foreground: '#ff00aa', background: '#222222' } },
        ],
      },
    ]);
    try {
      // Empty source
      const emptyScopes = compat.highlightTree(pack, emptyTree as unknown as TreeSitterTree, emptyBuf as unknown as TreeSitterTextBuffer);
      expect(emptyScopes.segments.length).toBe(0);
      expect(layeredTheme.resolve(emptyScopes).segments.length).toBe(0);
      const emptyFallback = highlightTreeWithFallback(fallbackQuery, emptyTree as unknown as TreeSitterTree, '', { rootScope: 'source.ts' });
      expect(emptyFallback.segments.length).toBe(0);

      // Sub-range window on both pack and fallback
      const winStart = source.indexOf('export');
      const winEnd = source.length;
      const winPack = compat.highlightTree(pack, fullTree as unknown as TreeSitterTree, fullBuf as unknown as TreeSitterTextBuffer, {
        window: { start: winStart, end: winEnd },
      });
      expect(winPack.segments[0]).toBe(winStart);
      expect(winPack.segments[winPack.segments.length - 2]).toBe(winEnd);
      const winFallback = highlightTreeWithFallback(fallbackQuery, fullTree as unknown as TreeSitterTree, source, {
        rootScope: 'source.ts',
        scopeSuffix: '.ts',
        window: { start: winStart, end: winEnd },
      });
      expect(winFallback.segments[0]).toBe(winStart);
      expect(winFallback.segments[winFallback.segments.length - 2]).toBe(winEnd);

      // Multi-layer theme override + fontStyle "" reset + background color
      const fullScopes = compat.highlightTree(pack, fullTree as unknown as TreeSitterTree, fullBuf as unknown as TreeSitterTextBuffer);
      const styled = layeredTheme.resolve(fullScopes);
      expect(styleAtOffset(styled, source.indexOf('// comment'))).toMatchObject({
        fg: parseColorRgba('#6a9955'),
        font: 0,
      });
      expect(styleAtOffset(styled, source.indexOf('const'))).toMatchObject({
        fg: parseColorRgba('#ff00aa'),
        bg: parseColorRgba('#222222'),
      });

      // Error paths do not leak native allocations
      expect(() => compat.compilePack(pack.language, {
        languageId: 'typescript',
        rootScope: 'source.ts',
        scopeSuffix: '.ts',
        query: '(nonexistent_node_type_xyz) @keyword',
      })).toThrow();
      expect(() => compat.compileTheme({
        tokenColors: [{ scope: 'keyword', settings: { foreground: 'not-a-color' } }],
      })).toThrow();
    } finally {
      layeredTheme.dispose();
      layeredTheme.dispose(); // idempotent
      expect(() => layeredTheme.resolve({
        sourceLength: 0,
        window: { start: 0, end: 0 },
        segments: new Uint32Array(0),
        paths: [[]],
        scopes: ['source.ts'],
      })).toThrow('Deleted ScopeTheme');
      fallbackQuery.delete();
      release(emptyTree);
      release(fullTree);
      release(parser);
      release(emptyBuf);
      release(fullBuf);
      pack.dispose();
      pack.dispose(); // idempotent
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });
});
