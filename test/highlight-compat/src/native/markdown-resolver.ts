import { readFile } from 'node:fs/promises';
import { Runtime, foreign, invoke } from './runtime.ts';
import type { Foreign } from './runtime.ts';
import { address, sourceSpan, span, u32 } from './decode.ts';
import { languageAddress } from './borrow.ts';
import { checkMarkdownAssets, MARKDOWN_ROOT } from './markdown-assets.ts';

interface ResolverRuntime { readonly runtime: Runtime; readonly exports: Foreign; readonly language: Foreign }
let initialization: Promise<ResolverRuntime> | undefined;
async function initialize(): Promise<ResolverRuntime> {
  await checkMarkdownAssets();
  const runtime = await Runtime.load();
  const language = foreign(await invoke(foreign(runtime.binding.Language), 'load', [await readFile(new URL('tree-sitter-md/tree-sitter-markdown.wasm', MARKDOWN_ROOT))]));
  const exports = await runtime.extension(new WebAssembly.Module(await readFile(new URL('tree-sitter-md/tree-sitter-md.wasm', MARKDOWN_ROOT))));
  return { runtime, exports, language };
}

export interface ResolverRecord { readonly start: number; readonly end: number; readonly kind: number; readonly extra: number }

function decorationFlags(kind: number, extra: number): void {
  if (!((kind >= 1 && kind <= 20) || (kind >= 32 && kind <= 39))) throw new Error('Invalid Markdown decoration kind');
  if ([4, 6, 8].includes(kind) && extra > 1) throw new Error('Invalid Markdown decoration flags');
  if (kind === 2 && (extra < 1 || extra > 6)) throw new Error('Invalid Markdown heading level');
}
export function decodeResolverRecords(heap: Uint8Array, pointer: number, count: number, length: number, injections: boolean): readonly ResolverRecord[] {
  u32(count); u32(length);
  if (count % 4 !== 0) throw new Error('Invalid Markdown output count');
  if (!count) return Object.freeze([]);
  if (!pointer) throw new Error('Null Markdown output');
  span(heap, pointer, count, 4);
  const words = new Uint32Array(heap.buffer, heap.byteOffset + pointer, count).slice();
  const records: ResolverRecord[] = [];
  for (let i = 0; i < words.length; i += 4) {
    const [start, end, kind, extra] = words.subarray(i, i + 4);
    if (start > end || end > length || (injections && (kind > extra || extra > start))) throw new Error('Invalid Markdown output range');
    if (!injections) decorationFlags(kind, extra);
    records.push(Object.freeze({ start, end, kind, extra }));
  }
  return Object.freeze(records);
}

export class MarkdownResolver {
  #handle: number;
  readonly #native: ResolverRuntime;
  #length: number;
  #ready = false;
  get length(): number { return this.#length; }
  private constructor(native: ResolverRuntime, handle: number, length: number) {
    this.#native = native; this.#handle = handle; this.#length = length;
    Object.freeze(this);
  }
  static async open(source: string): Promise<MarkdownResolver> {
    initialization ??= initialize();
    const native = await initialization;
    const handle = address(invoke(native.exports, 'tsmd_new', [3, languageAddress(native.language)]));
    if (!handle) throw new Error('Markdown resolver allocation failed');
    const resolver = new MarkdownResolver(native, handle, 0);
    try {
      resolver.replaceText(source);
      return resolver;
    } catch (error) { resolver.dispose(); throw error; }
  }
  replaceText(source: string): void {
    if (!this.#handle || (!this.#ready && this.#length !== 0)) throw new Error('Unavailable Markdown resolver');
    u32(source.length);
    if (source.length > 0x7fffffff) throw new RangeError('Markdown source limit');
    this.#ready = false;
    try {
      const pointer = this.number('tsmd_input', [source.length]);
      const heap = this.#native.runtime.heap();
      sourceSpan(heap, pointer, source.length);
      const units = new Uint16Array(heap.buffer, heap.byteOffset + pointer, source.length);
      for (let i = 0; i < source.length; i++) units[i] = source.charCodeAt(i);
      this.call('tsmd_set_text');
      this.#length = source.length; this.#ready = true;
    } catch (error) { this.dispose(); throw error; }
  }
  call(name: string, args: readonly number[] = []): unknown {
    if (!this.#handle) throw new Error('Deleted Markdown resolver');
    args.forEach(u32);
    return invoke(this.#native.exports, name, [this.#handle].concat(args));
  }
  number(name: string, args: readonly number[] = []): number { return address(this.call(name, args)); }
  records(injections: boolean): readonly ResolverRecord[] {
    if (!this.#ready) throw new Error('Unavailable Markdown records');
    const count = this.number(injections ? 'tsmd_injections' : 'tsmd_decorations', [0, this.length]);
    const pointer = count ? this.number('tsmd_out') : 0;
    return decodeResolverRecords(this.#native.runtime.heap(), pointer, count, this.length, injections);
  }
  dispose(): void {
    if (!this.#handle) return;
    const handle = this.#handle; this.#handle = 0;
    invoke(this.#native.exports, 'tsmd_free', [handle]);
  }
}
