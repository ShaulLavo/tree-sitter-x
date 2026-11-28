import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_PACKS,
  FONT_STYLE_BOLD,
  FONT_STYLE_ITALIC,
  ScopeCompat,
  ScopeCompatError,
  ZED_PLUS_CAPTURE_MAP,
  getBuiltinPack,
  highlightTreeWithFallback,
  parseColorRgba,
  resolveLanguageAlias,
  resolveZedPlusScopes,
} from '../../../lib/scope-compat/dist/index.js';
import type {
  ScopeResult,
  StyledResult,
  VscodeThemeInput,
} from '../../../lib/scope-compat/dist/index.js';
import { checkComponent, componentPath, repositoryRoot } from '../src/native/component-inputs.ts';
import { themeModule } from '../src/oracles/assets.ts';
import { rawDocument } from '../src/oracles/raw.ts';
import { textmateEngine } from '../src/oracles/textmate.ts';
import { parserUrl, querySource } from '../src/baselines/assets.ts';
import { ORACLE_THEMES } from '../src/oracles/pins.ts';
import type { Style, StyleTrack } from '../src/schema.ts';

// Exact stripped public @shaulavo/web-tree-sitter-x surface (no @internal [0] or textCallback)
interface PublicPoint { readonly row: number; readonly column: number }
interface PublicRange { readonly startIndex: number; readonly endIndex: number }
interface PublicNode {
  readonly type: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly hasError: boolean;
  readonly namedChildCount: number;
  namedChild(index: number): PublicNode | null;
}
interface PublicLanguage { readonly abiVersion: number }
interface PublicTextBuffer {
  readonly length: number;
  readonly read: (index: number, position?: PublicPoint, endIndex?: number) => string;
  edit(startIndex: number, oldEndIndex: number, text: string): void;
  delete(): void;
}
interface PublicEdit {
  readonly startIndex: number;
  readonly oldEndIndex: number;
  readonly newEndIndex: number;
  readonly startPosition: PublicPoint;
  readonly oldEndPosition: PublicPoint;
  readonly newEndPosition: PublicPoint;
}
interface PublicTree {
  readonly language: PublicLanguage;
  readonly rootNode: PublicNode;
  edit(edit: PublicEdit): void;
  getChangedRanges(other: PublicTree): PublicRange[];
  delete(): void;
}
interface PublicQuery {
  readonly captureNames: string[];
  captures(node: PublicNode, options?: { startIndex?: number; endIndex?: number; matchLimit?: number }): { name: string; patternIndex: number; node: PublicNode }[];
  captureRanges(node: PublicNode, options?: { startIndex?: number; endIndex?: number; matchLimit?: number }): { name: string; patternIndex: number; startIndex: number; endIndex: number }[];
  didExceedMatchLimit(): boolean;
  delete(): void;
}
interface PublicParser {
  setLanguage(language: PublicLanguage | null): void;
  parse(input: string | PublicTextBuffer, oldTree?: PublicTree | null): PublicTree | null;
  delete(): void;
}
interface PublicBinding {
  readonly Parser: { new (): PublicParser; init(): Promise<void>; readonly prototype: PublicParser };
  readonly Language: { load(input: Uint8Array | string): Promise<PublicLanguage> };
  readonly TextBuffer: { new (text?: string): PublicTextBuffer };
  readonly Edit: { new (input: PublicEdit): PublicEdit };
  readonly Query: { new (language: PublicLanguage, source: string): PublicQuery };
  loadExtension(module: WebAssembly.Module): Promise<Record<string, unknown>>;
  heap(): Uint8Array;
}

let cachedBinding: Promise<PublicBinding> | undefined;
async function getBinding(): Promise<PublicBinding> {
  if (!cachedBinding) {
    const url = new URL('../../../lib/binding_web/web-tree-sitter.js', import.meta.url);
    cachedBinding = (async () => {
      const mod = (await import(/* @vite-ignore */ url.href)) as PublicBinding;
      await mod.Parser.init();
      return mod;
    })();
  }
  return cachedBinding;
}

interface ManifestAssets {
  readonly themes: readonly { readonly id: string }[];
}

async function loadSdk(): Promise<{ readonly binding: PublicBinding; readonly compat: ScopeCompat }> {
  const binding = await getBinding();
  await checkComponent();
  const wasmBytes = await readFile(resolve(repositoryRoot, componentPath));
  const compat = await ScopeCompat.load(binding, wasmBytes);
  return { binding, compat };
}

const cachedLanguages = new Map<string, Promise<PublicLanguage>>();
function loadLanguage(binding: PublicBinding, languageId: string): Promise<PublicLanguage> {
  let pending = cachedLanguages.get(languageId);
  if (!pending) {
    pending = readFile(parserUrl(languageId)).then(bytes => binding.Language.load(bytes));
    cachedLanguages.set(languageId, pending);
  }
  return pending;
}

async function loadPackFromDisk(compat: ScopeCompat, binding: PublicBinding, languageId: string) {
  const meta = getBuiltinPack(languageId);
  if (!meta) throw new Error(`Missing built-in pack metadata for ${languageId}`);
  const queryParts = await Promise.all(
    meta.queryPaths.map(rel => readFile(resolve(repositoryRoot, 'lib/scope-compat', rel), 'utf8')),
  );
  const language = await loadLanguage(binding, meta.languageId);
  return compat.compilePack(language, {
    languageId: meta.languageId,
    rootScope: meta.rootScope,
    scopeSuffix: meta.scopeSuffix,
    query: queryParts.join('\n'),
    localInvalidation: meta.localInvalidation,
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

function oracleStyleAt(track: StyleTrack | undefined, offset: number): Style | undefined {
  if (!track) return undefined;
  for (let i = 0; i < track.spans.length; i += 3) {
    if (offset >= track.spans[i] && offset < track.spans[i + 1]) {
      return track.styles[track.spans[i + 2]];
    }
  }
  return undefined;
}

function assertOracleTokensMatch(
  source: string,
  styled: StyledResult,
  track: StyleTrack | undefined,
  tokens: readonly string[],
): void {
  expect(track).toBeDefined();
  for (const token of tokens) {
    const offset = source.indexOf(token);
    const actual = styleAtOffset(styled, offset);
    const expected = oracleStyleAt(track, offset);
    expect(expected).toBeDefined();
    if (expected?.foreground) expect(actual.fg).toBe(parseColorRgba(expected.foreground));
  }
}

async function verifyOracleThemes(
  compat: ScopeCompat,
  resolve: (theme: ReturnType<ScopeCompat['compileTheme']>) => StyledResult,
  source: string,
  styles: Readonly<Record<string, StyleTrack>> | undefined,
  tokens: readonly string[],
): Promise<void> {
  for (const themeId of ORACLE_THEMES) {
    const compiled = compat.compileTheme((await themeModule(themeId)) as unknown as VscodeThemeInput);
    try {
      assertOracleTokensMatch(source, resolve(compiled), styles?.[themeId], tokens);
    } finally {
      compiled.dispose();
    }
  }
}

async function verifyBundledTheme(compat: ScopeCompat, themeId: string, sample: ScopeResult): Promise<void> {
  const compiled = compat.compileTheme((await themeModule(themeId)) as unknown as VscodeThemeInput);
  try {
    expect(compiled.resolve(sample).segments.length).toBe(3);
  } finally {
    compiled.dispose();
  }
}

async function assertNoForbiddenImports(relativeDir: string, forbidden: RegExp): Promise<void> {
  const fullDir = resolve(repositoryRoot, relativeDir);
  const files = (await readdir(fullDir)).filter(name => /\.(?:[jt]s|d\.ts)$/.test(name));
  expect(files.length).toBeGreaterThanOrEqual(8);
  for (const file of files) {
    const text = await readFile(resolve(fullDir, file), 'utf8');
    expect(text, `${relativeDir}/${file}`).not.toMatch(forbidden);
  }
}

interface EditState {
  source: string;
  tree: PublicTree;
}

function applyTreeEdit(
  binding: PublicBinding,
  parser: PublicParser,
  buffer: PublicTextBuffer,
  state: EditState,
  from: number,
  to: number,
  insert: string,
): PublicRange[] {
  const lineStart = state.source.lastIndexOf('\n', from - 1) + 1;
  const row = state.source.slice(0, from).split('\n').length - 1;
  state.tree.edit(new binding.Edit({
    startIndex: from,
    oldEndIndex: to,
    newEndIndex: from + insert.length,
    startPosition: { row, column: from - lineStart },
    oldEndPosition: { row, column: to - lineStart },
    newEndPosition: { row, column: from - lineStart + insert.length },
  }));
  buffer.edit(from, to, insert);
  state.source = `${state.source.slice(0, from)}${insert}${state.source.slice(to)}`;
  const nextTree = parser.parse(buffer, state.tree);
  if (!nextTree) throw new Error('Reparse returned null');
  const changedRanges = state.tree.getChangedRanges(nextTree);
  state.tree.delete();
  state.tree = nextTree;
  return changedRanges;
}

function assertScopesMatchAtOffsets(actual: ScopeResult, expected: ScopeResult, length: number, step: number): void {
  for (let offset = 0; offset < length; offset += step) {
    expect(scopeAtOffset(actual, offset)).toEqual(scopeAtOffset(expected, offset));
  }
}

function assertReferencedPathsOnly(result: ScopeResult): void {
  const referenced = new Set<number>([0]);
  for (let i = 2; i < result.segments.length; i += 3) referenced.add(result.segments[i]);
  expect(referenced.size).toBe(result.paths.length);
}

describe('Phase 6 public zero-Shiki consumer SDK (@shaulavo/tree-sitter-scope-compat)', () => {
  it('contains zero Shiki, Oniguruma, vscode-textmate, or Node-only imports in js/, dist/, and package.json', async () => {
    const pkgRaw = await readFile(resolve(repositoryRoot, 'lib/scope-compat/package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    expect(pkg.dependencies).toBeUndefined();
    expect(pkgRaw).not.toMatch(/shiki|oniguruma|vscode-textmate|vscode-oniguruma/i);
    const forbidden = /\b(?:shiki|vscode-textmate|vscode-oniguruma|oniguruma|node:)\b/i;
    await assertNoForbiddenImports('lib/scope-compat/js', forbidden);
    await assertNoForbiddenImports('lib/scope-compat/dist', forbidden);
  });

  it('imports cleanly by package name from node_modules in Node without type-stripping errors', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'scope-compat-pkg-'));
    try {
      const scopeDir = join(tempDir, 'node_modules', '@shaulavo');
      await mkdir(scopeDir, { recursive: true });
      await symlink(resolve(repositoryRoot, 'lib/scope-compat'), join(scopeDir, 'tree-sitter-scope-compat'));
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          'import * as sdk from "@shaulavo/tree-sitter-scope-compat"; console.log(JSON.stringify({ hasLoad: typeof sdk.ScopeCompat.load === "function", packs: Object.keys(sdk.BUILTIN_PACKS).length, fallback: sdk.resolveZedPlusScopes("keyword.control.async", ".rs") }));',
        ],
        { cwd: tempDir, encoding: 'utf8' },
      );
      expect(JSON.parse(output.trim())).toEqual({
        hasLoad: true,
        packs: 13,
        fallback: ['keyword.control.rs'],
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
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

  it('reuses caller Tree and TextBuffer cast-free with zero extra parse and zero allocation leaks', async () => {
    const { binding, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const pack = await loadPackFromDisk(compat, binding, 'typescript');
    const source = 'export const answer: number = 42;\nfunction add(a: number, b: number) { return a + b; }\n';
    const buffer = new binding.TextBuffer(source);
    const parser = new binding.Parser();
    parser.setLanguage(await loadLanguage(binding, 'typescript'));
    const tree = parser.parse(buffer);
    if (!tree) throw new Error('Parse returned null');
    const parseSpy = vi.spyOn(binding.Parser.prototype, 'parse');
    try {
      // Zero casts against public @shaulavo/web-tree-sitter-x types
      const result = compat.highlightTree(pack, tree, buffer);
      expect(parseSpy).not.toHaveBeenCalled();
      expect(result.sourceLength).toBe(source.length);
      expect(result.segments).toBeInstanceOf(Uint32Array);
      expect(scopeAtOffset(result, source.indexOf('answer'))).toContain('variable.other.constant.ts');
      expect(scopeAtOffset(result, source.indexOf('add'))).toContain('entity.name.function.ts');
      expect(scopeAtOffset(result, source.indexOf('42'))).toContain('constant.numeric.decimal.ts');
    } finally {
      parseSpy.mockRestore();
      tree.delete();
      parser.delete();
      buffer.delete();
      pack.dispose();
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('rejects packs owned by a different ScopeCompat instance', async () => {
    const { binding, compat } = await loadSdk();
    const wasmBytes = await readFile(resolve(repositoryRoot, componentPath));
    const otherCompat = await ScopeCompat.load(binding, wasmBytes);
    const pack = await loadPackFromDisk(compat, binding, 'typescript');
    const source = 'const x = 1;\n';
    const buffer = new binding.TextBuffer(source);
    const parser = new binding.Parser();
    parser.setLanguage(await loadLanguage(binding, 'typescript'));
    const tree = parser.parse(buffer);
    if (!tree) throw new Error('Parse returned null');
    try {
      expect(() => otherCompat.highlightTree(pack, tree, buffer)).toThrow('different ScopeCompat');
      expect(() => otherCompat.createSession(pack)).toThrow('different ScopeCompat');
    } finally {
      tree.delete();
      parser.delete();
      buffer.delete();
      pack.dispose();
    }
  });

  it('switches themes independently via native C matcher without re-scoping and matches raw TextMate oracle styles', async () => {
    const { binding, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const pack = await loadPackFromDisk(compat, binding, 'typescript');
    const source = 'const value: string = "hello";\n// comment\nexport function run(x: number) { return x + 1; }\n';
    const buffer = new binding.TextBuffer(source);
    const parser = new binding.Parser();
    parser.setLanguage(await loadLanguage(binding, 'typescript'));
    const tree = parser.parse(buffer);
    if (!tree) throw new Error('Parse returned null');
    const darkTheme = compat.compileTheme((await themeModule('github-dark-default')) as unknown as VscodeThemeInput);
    const lightTheme = compat.compileTheme((await themeModule('github-light-default')) as unknown as VscodeThemeInput);
    const session = compat.createSession(pack);
    const highlightSpy = vi.spyOn(compat, 'highlightTree');
    try {
      session.update(tree, buffer);
      expect(highlightSpy).toHaveBeenCalledTimes(1);
      const darkStyled = session.resolveTheme(darkTheme);
      const lightStyled = session.resolveTheme(lightTheme);
      expect(highlightSpy).toHaveBeenCalledTimes(1);
      expect(darkStyled.defaultBackgroundRgba).not.toBe(lightStyled.defaultBackgroundRgba);
      expect(styleAtOffset(darkStyled, source.indexOf('const')).fg).not.toBe(styleAtOffset(lightStyled, source.indexOf('const')).fg);

      const engine = await textmateEngine('upstream');
      const raw = await rawDocument(engine, { profileId: 'raw', languageId: 'typescript', source, themeIds: ORACLE_THEMES });
      if (raw.status !== 'complete') throw new Error(`Expected complete oracle result, got ${raw.status}`);
      await verifyOracleThemes(compat, theme => session.resolveTheme(theme), source, raw.styles, [
        'const', '"hello"', '// comment', 'function', 'run', 'return',
      ]);
    } finally {
      highlightSpy.mockRestore();
      darkTheme.dispose();
      lightTheme.dispose();
      tree.delete();
      parser.delete();
      buffer.delete();
      pack.dispose();
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('compiles all 65 bundled VS Code themes cleanly and tracks effective scopeless defaults', async () => {
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
      await verifyBundledTheme(compat, entry.id, sampleScopes);
    }
    const overriddenDefault = compat.compileTheme({
      colors: { 'editor.foreground': '#000000', 'editor.background': '#111111' },
      tokenColors: [
        { settings: { foreground: '#123456', background: '#222222' } },
        { scope: [''], settings: { foreground: '#ab12cd' } },
        { scope: ' ,keyword', settings: { foreground: '#fedcba', fontStyle: 'italic' } },
        { scope: 'keyword, ', settings: { background: '#334455' } },
      ],
    });
    try {
      expect(overriddenDefault.defaultForegroundRgba).toBe(parseColorRgba('#fedcba'));
      expect(overriddenDefault.defaultBackgroundRgba).toBe(parseColorRgba('#334455'));
      const resolved = overriddenDefault.resolve({
        sourceLength: 1,
        window: { start: 0, end: 1 },
        segments: Uint32Array.from([0, 1, 1]),
        paths: [[], [0]],
        scopes: ['source.ts'],
      });
      expect(styleAtOffset(resolved, 0)).toMatchObject({
        fg: parseColorRgba('#fedcba'),
        bg: parseColorRgba('#334455'),
        font: FONT_STYLE_ITALIC,
      });
      expect(() => overriddenDefault.resolve({
        sourceLength: 0,
        window: { start: 0, end: 0 },
        segments: new Uint32Array(0),
        paths: [],
        scopes: [],
      }, { maxPacketBytes: 1 })).toThrow(ScopeCompatError);
    } finally {
      overriddenDefault.dispose();
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('performs local incremental invalidation without retaining unused paths, and falls back safely for custom packs', async () => {
    const { binding, compat } = await loadSdk();
    const pack = await loadPackFromDisk(compat, binding, 'typescript');
    const customPack = compat.compilePack(await loadLanguage(binding, 'typescript'), {
      languageId: 'typescript',
      rootScope: 'source.ts',
      scopeSuffix: '.ts',
      query: '(identifier) @variable.other.readwrite',
    });
    const lines = Array.from({ length: 80 }, (_, i) => `export function fn${i}(x: number): number { return x + ${i}; }`);
    const initialSource = `${lines.join('\n')}\n`;
    const buffer = new binding.TextBuffer(initialSource);
    const parser = new binding.Parser();
    parser.setLanguage(await loadLanguage(binding, 'typescript'));
    const initialTree = parser.parse(buffer);
    if (!initialTree) throw new Error('Parse returned null');
    const state: EditState = { source: initialSource, tree: initialTree };
    const session = compat.createSession(pack);
    const customSession = compat.createSession(customPack);
    try {
      const initial = session.update(state.tree, buffer);
      customSession.update(state.tree, buffer);
      expect(session.lastInvalidation?.mode).toBe('full-document');

      const pos = state.source.indexOf('return x + 40;') + 'return x + '.length;
      const ranges1 = applyTreeEdit(binding, parser, buffer, state, pos, pos + 2, '"40"');
      const inc1 = session.update(state.tree, buffer, { edits: [{ from: pos, to: pos + 2, insertLength: 4 }], changedRanges: ranges1, source: state.source });
      expect(session.lastInvalidation?.mode).toBe('local-range');
      expect(scopeAtOffset(inc1, pos)).toContain('string.quoted.double.ts');

      customSession.update(state.tree, buffer, { edits: [{ from: pos, to: pos + 2, insertLength: 4 }], changedRanges: ranges1, source: state.source });
      expect(customSession.lastInvalidation?.mode).toBe('full-document');

      const ranges2 = applyTreeEdit(binding, parser, buffer, state, pos, pos + 4, '40');
      const inc2 = session.update(state.tree, buffer, { edits: [{ from: pos, to: pos + 4, insertLength: 2 }], changedRanges: ranges2, source: state.source });
      expect(session.lastInvalidation?.mode).toBe('local-range');
      const fresh = compat.highlightTree(pack, state.tree, buffer);
      expect(inc2.paths.length).toBeLessThanOrEqual(fresh.paths.length);
      expect(inc2.paths.length).toBeLessThanOrEqual(initial.paths.length);
      assertReferencedPathsOnly(inc2);
      expect(inc2.paths.every(p => !p.some(id => inc2.scopes[id] === 'string.quoted.double.ts'))).toBe(true);
      assertScopesMatchAtOffsets(inc2, fresh, state.source.length, 17);
    } finally {
      state.tree.delete();
      parser.delete();
      buffer.delete();
      customPack.dispose();
      pack.dispose();
    }
  });

  it('resolves Zed-plus universal captures with exact windowed precedence, integer bounds, lone CR handling, and native theming', async () => {
    expect(Object.keys(ZED_PLUS_CAPTURE_MAP).length).toBeGreaterThanOrEqual(70);
    expect(resolveZedPlusScopes('keyword.control.async.custom', '.ts')).toEqual(['keyword.control.ts']);
    expect(resolveZedPlusScopes('@function.method.call', '.rs')).toEqual(['entity.name.function.method.rs']);
    expect(resolveZedPlusScopes('type.struct', '.rs')).toEqual(['entity.name.type.struct.rs']);
    expect(resolveZedPlusScopes('_internal_helper')).toEqual([]);
    expect(resolveZedPlusScopes('unknown.custom.capture')).toEqual([]);
    expect(resolveZedPlusScopes('text.title', '.markdown')).toEqual(['markup.heading.markdown', 'entity.name.section.markdown']);
    expect(resolveZedPlusScopes('text.strong', '.markdown')).toEqual(['markup.bold.markdown']);
    expect(resolveZedPlusScopes('text.emphasis', '.markdown')).toEqual(['markup.italic.markdown']);
    expect(resolveZedPlusScopes('text.literal', '.markdown')).toEqual(['markup.inline.raw.string.markdown']);
    expect(resolveZedPlusScopes('text.uri', '.markdown')).toEqual(['markup.underline.link.markdown']);
    expect(resolveZedPlusScopes('text.reference', '.markdown')).toEqual(['string.other.link.title.markdown']);

    const { binding, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const language = await loadLanguage(binding, 'typescript');
    const parser = new binding.Parser();
    parser.setLanguage(language);
    const source = 'const greeting = "hello";\nfunction greet(name: string) { return greeting + name; }\n';
    const tree = parser.parse(source);
    if (!tree) throw new Error('Parse returned null');
    const query = new binding.Query(language, querySource('typescript'));
    const theme = compat.compileTheme({
      type: 'dark',
      colors: { 'editor.foreground': '#d4d4d4', 'editor.background': '#1e1e1e' },
      tokenColors: [
        { scope: 'storage.type', settings: { foreground: '#569cd6', fontStyle: 'bold' } },
        { scope: 'entity.name.function', settings: { foreground: '#dcdcaa' } },
        { scope: 'string.quoted', settings: { foreground: '#ce9178', fontStyle: 'italic' } },
      ],
    });
    const precSource = 'const abc = 1;';
    const precTree = parser.parse(precSource);
    if (!precTree) throw new Error('Parse returned null');
    const precQuery = new binding.Query(language, '(identifier) @variable\n(lexical_declaration) @string');
    const crSource = '"a\rb"';
    const crTree = parser.parse(crSource);
    if (!crTree) throw new Error('Parse returned null');
    const parseSpy = vi.spyOn(binding.Parser.prototype, 'parse');
    try {
      const scopes = highlightTreeWithFallback(query, tree, source, { rootScope: 'source.ts', scopeSuffix: '.ts' });
      expect(parseSpy).not.toHaveBeenCalled();
      expect(scopeAtOffset(scopes, source.indexOf('"hello"'))).toContain('string.quoted.ts');
      expect(scopeAtOffset(scopes, source.indexOf('greet('))).toContain('entity.name.function.ts');

      const styled = theme.resolve(scopes);
      expect(styleAtOffset(styled, source.indexOf('function'))).toMatchObject({ fg: parseColorRgba('#569cd6'), font: FONT_STYLE_BOLD });
      expect(styleAtOffset(styled, source.indexOf('"hello"'))).toMatchObject({ fg: parseColorRgba('#ce9178'), font: FONT_STYLE_ITALIC });
      expect(styleAtOffset(styled, source.indexOf('greet(')).fg).toBe(parseColorRgba('#dcdcaa'));

      const fullPrec = highlightTreeWithFallback(precQuery, precTree, precSource, { rootScope: 'source.ts' });
      const winPrec = highlightTreeWithFallback(precQuery, precTree, precSource, { rootScope: 'source.ts', window: { start: 6, end: 9 } });
      expect(scopeAtOffset(winPrec, 6)).toEqual(scopeAtOffset(fullPrec, 6));
      expect(scopeAtOffset(winPrec, 6)).toEqual(['source.ts', 'string.quoted', 'variable.other.readwrite']);

      expect(() => highlightTreeWithFallback(query, tree, source, {
        rootScope: 'source.ts',
        window: { start: 0.5, end: 2.5 },
      })).toThrow(RangeError);

      const crScopes = highlightTreeWithFallback(query, crTree, crSource, { rootScope: 'source.ts', scopeSuffix: '.ts' });
      expect(scopeAtOffset(crScopes, 2)).toContain('string.quoted.ts');
    } finally {
      parseSpy.mockRestore();
      theme.dispose();
      precQuery.delete();
      precTree.delete();
      crTree.delete();
      query.delete();
      tree.delete();
      parser.delete();
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('handles empty sources, sub-range windows, multi-layer theme overrides, fontStyle reset, and error-path cleanup', async () => {
    const { binding, compat } = await loadSdk();
    const beforeAllocs = compat.liveAllocations();
    const pack = await loadPackFromDisk(compat, binding, 'typescript');
    const language = await loadLanguage(binding, 'typescript');
    const emptyBuf = new binding.TextBuffer('');
    const parser = new binding.Parser();
    parser.setLanguage(language);
    const emptyTree = parser.parse(emptyBuf);
    const source = '// comment\nconst x = 1;\nexport function demo() { return x; }\n';
    const fullBuf = new binding.TextBuffer(source);
    const fullTree = parser.parse(fullBuf);
    if (!emptyTree || !fullTree) throw new Error('Parse returned null');
    const fallbackQuery = new binding.Query(language, querySource('typescript'));
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
      const emptyScopes = compat.highlightTree(pack, emptyTree, emptyBuf);
      expect(emptyScopes.segments.length).toBe(0);
      expect(layeredTheme.resolve(emptyScopes).segments.length).toBe(0);
      const emptyFallback = highlightTreeWithFallback(fallbackQuery, emptyTree, '', { rootScope: 'source.ts' });
      expect(emptyFallback.segments.length).toBe(0);

      const winStart = source.indexOf('export');
      const winEnd = source.length;
      const winPack = compat.highlightTree(pack, fullTree, fullBuf, { window: { start: winStart, end: winEnd } });
      expect(winPack.segments[0]).toBe(winStart);
      expect(winPack.segments[winPack.segments.length - 2]).toBe(winEnd);
      const winFallback = highlightTreeWithFallback(fallbackQuery, fullTree, source, {
        rootScope: 'source.ts',
        scopeSuffix: '.ts',
        window: { start: winStart, end: winEnd },
      });
      expect(winFallback.segments[0]).toBe(winStart);
      expect(winFallback.segments[winFallback.segments.length - 2]).toBe(winEnd);

      const fullScopes = compat.highlightTree(pack, fullTree, fullBuf);
      const styled = layeredTheme.resolve(fullScopes);
      expect(styleAtOffset(styled, source.indexOf('// comment'))).toMatchObject({ fg: parseColorRgba('#6a9955'), font: 0 });
      expect(styleAtOffset(styled, source.indexOf('const'))).toMatchObject({
        fg: parseColorRgba('#ff00aa'),
        bg: parseColorRgba('#222222'),
      });

      expect(() => compat.compilePack(language, {
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
      layeredTheme.dispose();
      expect(() => layeredTheme.resolve({
        sourceLength: 0,
        window: { start: 0, end: 0 },
        segments: new Uint32Array(0),
        paths: [[]],
        scopes: ['source.ts'],
      })).toThrow('Deleted ScopeTheme');
      fallbackQuery.delete();
      emptyTree.delete();
      fullTree.delete();
      parser.delete();
      emptyBuf.delete();
      fullBuf.delete();
      pack.dispose();
      pack.dispose();
    }
    expect(compat.liveAllocations()).toBe(beforeAllocs);
  });

  it('decodes native C strings from resizable ArrayBuffer heaps without passing resizable views to TextDecoder', async () => {
    const { readCString } = await import('../../../lib/scope-compat/dist/abi.js');
    const resizable = new ArrayBuffer(64, { maxByteLength: 128 });
    expect(resizable.resizable).toBe(true);
    const view = new Uint8Array(resizable);
    const encoded = new TextEncoder().encode('keyword.control.ts\0');
    view.set(encoded, 8);
    const decodeSpy = vi.spyOn(TextDecoder.prototype, 'decode');
    try {
      expect(readCString(view, 8)).toBe('keyword.control.ts');
      expect(readCString(view, 8, 256, true)).toBe('keyword.control.ts');
      expect(decodeSpy).toHaveBeenCalledTimes(2);
      for (const [input] of decodeSpy.mock.calls) {
        expect(ArrayBuffer.isView(input)).toBe(true);
        const buffer = (input as ArrayBufferView).buffer;
        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect((buffer as ArrayBuffer).resizable).toBe(false);
      }
    } finally {
      decodeSpy.mockRestore();
    }
  });
});
