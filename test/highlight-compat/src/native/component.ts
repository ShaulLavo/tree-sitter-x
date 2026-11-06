import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkComponent, componentPath, manifestPath, digest, repositoryRoot, sourceIdentity } from './component-inputs.ts';
import { address, decodeExplain, decodeResult, nativeString, sourceSpan, span, u32, validateLayout } from './decode.ts';
import type { PassResult, ExplainResult, Window } from './decode.ts';
import { languageAddress } from './borrow.ts';
import type { Borrowed } from './borrow.ts';
import { Runtime, invoke } from './runtime.ts';
import type { Foreign } from './runtime.ts';
import { vendorAssets } from '../baselines/assets.ts';

export interface QueryFile { readonly path: string; readonly query: string }
export interface PackSpec {
  readonly id: string; readonly version: string; readonly languageId: string;
  readonly rootScope: string; readonly suffix: string; readonly files: readonly QueryFile[];
}
export interface Limits { readonly matchLimit?: number; readonly maxIntervals?: number; readonly maxSegments?: number; readonly encoding?: number }

function location(files: readonly QueryFile[], offset: number): string {
  let start = 0;
  for (const file of files) {
    const bytes = new TextEncoder().encode(file.query);
    if (offset <= start + bytes.length) return `${file.path}:${1 + bytes.subarray(0, Math.max(0, offset - start)).filter(byte => byte === 10).length}`;
    start += bytes.length + 1;
  }
  return `${files.at(-1)?.path ?? '<query>'}:?`;
}

export class PackLoadError extends Error {
  readonly status: number; readonly detail: number; readonly pattern: number; readonly offset: number; readonly operator: string;
  constructor(status: number, detail: number, value: number, pattern: number, offset: number, operator: string, files: readonly QueryFile[]) {
    super(`${location(files, offset)}: ${operator || 'query'}: native pack status ${status}, detail ${detail}, value ${value}, pattern ${pattern}`);
    this.status = status; this.detail = detail; this.pattern = pattern; this.offset = offset; this.operator = operator;
  }
}

export class NativePack {
  #pointer: number;
  readonly #language: Foreign;
  readonly #component: Component;
  readonly spec: PackSpec;
  readonly scopes: readonly string[];
  readonly patterns: number;
  readonly engine: Readonly<Record<string, string>>;
  constructor(component: Component, pointer: number, language: Foreign, spec: PackSpec,
    scopes: readonly string[], patterns: number, engine: Readonly<Record<string, string>>) {
    this.#component = component; this.#pointer = pointer; this.#language = language;
    this.spec = Object.freeze({ ...spec, files: Object.freeze(Array.from(spec.files, file => Object.freeze({ ...file }))) });
    this.scopes = Object.freeze(Array.from(scopes)); this.patterns = patterns; this.engine = Object.freeze({ ...engine });
    Object.freeze(this);
  }
  readonly sameLanguage = (language: Foreign): boolean => language === this.#language;
  withHandle<T>(action: (pointer: number) => T): T {
    if (!this.#pointer) throw new Error('Deleted native pack');
    return action(this.#pointer);
  }
  run(borrow: Borrowed, window: Window, limits: Limits = {}): PassResult { return this.#component.run(this, borrow, window, limits); }
  explain(borrow: Borrowed, window: Window, limits: Limits = {}): ExplainResult { return this.#component.explain(this, borrow, window, limits); }
  dispose(): void {
    if (!this.#pointer) return;
    const pointer = this.#pointer; this.#pointer = 0;
    this.#component.call('scope_compat_pack_delete', [pointer]);
  }
}

export class Component {
  readonly runtime: Runtime;
  readonly #exports: Foreign;
  readonly #identity: Readonly<Record<string, string>>;
  static #instance: Promise<Component> | undefined;
  private constructor(runtime: Runtime, exports: Foreign, identity: Readonly<Record<string, string>>) {
    this.runtime = runtime; this.#exports = exports; this.#identity = identity;
  }
  static load(): Promise<Component> { Component.#instance ??= Component.open(); return Component.#instance; }
  private static async open(): Promise<Component> {
    const runtime = await Runtime.load();
    const module = await checkComponent();
    const exports = await runtime.extension(module);
    const bytes = await readFile(resolve(repositoryRoot, componentPath));
    const manifest: unknown = JSON.parse(await readFile(resolve(repositoryRoot, manifestPath), 'utf8'));
    const runtimeBytes = await readFile(new URL('../../../../lib/binding_web/web-tree-sitter.wasm', import.meta.url));
    const bindingBytes = await readFile(new URL('../../../../lib/binding_web/web-tree-sitter.js', import.meta.url));
    const component = new Component(runtime, exports, { componentSha256: digest(bytes), sourceDigest: sourceIdentity(manifest), runtimeSha256: digest(Buffer.concat([runtimeBytes, bindingBytes])), abi: '1' });
    if (component.number('scope_compat_abi_version') !== 1) throw new Error('Unsupported component ABI');
    const layout = component.number('scope_compat_layout');
    validateLayout(runtime.heap(), layout);
    return component;
  }
  call(name: string, args: readonly number[] = []): unknown { args.forEach(u32); return invoke(this.#exports, name, args); }
  number(name: string, args: readonly number[] = []): number { return address(this.call(name, args)); }
  liveAllocations(): number { return this.number('scope_compat_live_allocations'); }
  private string(name: string, args: readonly number[], diagnostic = false): string {
    const pointer = this.number(name, args);
    return nativeString(this.runtime.heap(), pointer, 256, diagnostic);
  }

  private withBytes<T>(text: string, action: (pointer: number, length: number) => T): T {
    const bytes = new TextEncoder().encode(text);
    const pointer = this.number('scope_compat_bytes_new', [bytes.length]);
    if (!pointer) throw new Error('Native scratch allocation failed');
    try {
      const heap = this.runtime.heap();
      span(heap, pointer, bytes.length, 1, 1); heap.set(bytes, pointer);
      return action(pointer, bytes.length);
    } finally { this.call('scope_compat_bytes_delete', [pointer]); }
  }

  async loadPack(spec: PackSpec): Promise<NativePack> {
    const language = await this.runtime.language(spec.languageId);
    const query = spec.files.map(file => file.query).join('\n');
    const pointer = this.withBytes(query, (q, ql) => this.withBytes(spec.rootScope, (r, rl) =>
      this.withBytes(spec.suffix, (s, sl) => this.number('scope_compat_pack_new', [languageAddress(language), q, ql, r, rl, s, sl]))));
    if (!pointer) throw new Error('Native pack header allocation failed');
    try { return this.readPack(pointer, language, spec, query); }
    catch (error) { this.call('scope_compat_pack_delete', [pointer]); throw error; }
  }

  private readPack(pointer: number, language: Foreign, spec: PackSpec, query: string): NativePack {
    const status = this.number('scope_compat_pack_status', [pointer]);
    if (status !== 0) {
      const values = ['detail', 'error_value', 'error_pattern', 'error_offset'].map(key => this.number(`scope_compat_pack_${key}`, [pointer]));
      const name = this.string('scope_compat_pack_error_name', [pointer], true);
      throw new PackLoadError(status, values[0], values[1], values[2], values[3], name, spec.files);
    }
    const count = this.number('scope_compat_pack_scope_count', [pointer]);
    if (!count || count > this.runtime.heap().length / 4) throw new Error('Invalid native scope count');
    const names = Array.from({ length: count }, (_, id) => this.string('scope_compat_pack_scope_name', [pointer, id]));
    if (names[0] !== spec.rootScope || names.some(name => !name || /\s/.test(name))) throw new Error('Invalid native scope names');
    const parser = vendorAssets().find(asset => asset.languageId === spec.languageId && asset.kind === 'wasm');
    if (!parser) throw new Error('Missing parser identity');
    return new NativePack(this, pointer, language, spec, names, this.number('scope_compat_pack_pattern_count', [pointer]), {
      ...this.#identity, packId: spec.id, packVersion: spec.version, querySha256: digest(new TextEncoder().encode(query)),
      parserSha256: parser.sha256, composition: 'scope-compat-compose-1', predicateDialect: 'eq/any-of/make-range/priority',
    });
  }

  withResult<T>(pack: NativePack, borrow: Borrowed, window: Window, limits: Limits,
    consume: (heap: Uint8Array, pointer: number) => T): T {
    this.validateBorrow(borrow, window);
    return pack.withHandle(handle => {
      const pointer = this.number('scope_compat_run', [handle, borrow.tree, borrow.source, borrow.length, limits.encoding ?? 1,
        window.start, window.end, limits.matchLimit ?? 0, limits.maxIntervals ?? 0, limits.maxSegments ?? 0]);
      if (!pointer) throw new Error('Native result header allocation failed');
      try { return consume(this.runtime.heap(), pointer); } finally { this.call('scope_compat_result_delete', [pointer]); }
    });
  }
  run(pack: NativePack, borrow: Borrowed, window: Window, limits: Limits = {}): PassResult {
    return this.withResult(pack, borrow, window, limits, (heap, pointer) => decodeResult(heap, pointer, window, pack.scopes.length));
  }
  withExplain<T>(pack: NativePack, borrow: Borrowed, window: Window, limits: Limits,
    consume: (heap: Uint8Array, pointer: number) => T): T {
    this.validateBorrow(borrow, window);
    return pack.withHandle(handle => {
      const pointer = this.number('scope_compat_explain', [handle, borrow.tree, borrow.source, borrow.length, limits.encoding ?? 1,
        window.start, window.end, limits.matchLimit ?? 0, limits.maxIntervals ?? 0]);
      if (!pointer) throw new Error('Native explain header allocation failed');
      try { return consume(this.runtime.heap(), pointer); }
      finally { this.call('scope_compat_explain_delete', [pointer]); }
    });
  }
  explain(pack: NativePack, borrow: Borrowed, window: Window, limits: Limits = {}): ExplainResult {
    return this.withExplain(pack, borrow, window, limits, (heap, pointer) => decodeExplain(heap, pointer, window, pack.scopes.length, pack.patterns));
  }
  private validateBorrow(borrow: Borrowed, window: Window): void {
    u32(borrow.tree); u32(window.start); u32(window.end);
    if (!borrow.tree || window.start > window.end || window.end > borrow.length) throw new RangeError('Invalid borrow or window');
    sourceSpan(this.runtime.heap(), borrow.source, borrow.length);
  }
}
