import { readFile } from 'node:fs/promises';
import { parserLanguageId, parserUrl, vendorAssets } from '../baselines/assets.ts';
import { digest } from './component-inputs.ts';

export type Foreign = Record<PropertyKey, unknown>;
export function foreign(value: unknown): Foreign {
  if (isForeign(value)) return value;
  throw new TypeError('Invalid native runtime object');
}
function isForeign(value: unknown): value is Foreign {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
export function invoke(target: Foreign, name: PropertyKey, args: readonly unknown[] = []): unknown {
  const fn = target[name];
  if (typeof fn !== 'function') throw new TypeError(`Missing runtime function ${String(name)}`);
  return Reflect.apply(fn, target, args);
}
export function release(target: Foreign): void { invoke(target, 'delete'); }

export class Runtime {
  readonly #languages = new Map<string, Promise<Foreign>>();
  readonly binding: Foreign;
  private constructor(binding: Foreign) { this.binding = binding; }
  static #instance: Promise<Runtime> | undefined;

  static load(): Promise<Runtime> {
    Runtime.#instance ??= Runtime.open();
    return Runtime.#instance;
  }
  private static async open(): Promise<Runtime> {
    const url = new URL('../../../../lib/binding_web/web-tree-sitter.js', import.meta.url);
    const binding = foreign(await import(/* @vite-ignore */ url.href));
    await invoke(foreign(binding.Parser), 'init');
    return new Runtime(binding);
  }
  construct(name: string, args: readonly unknown[] = []): Foreign {
    const constructor = this.binding[name];
    if (typeof constructor !== 'function') throw new TypeError(`Missing constructor ${name}`);
    return foreign(Reflect.construct(constructor, args));
  }
  heap(): Uint8Array<ArrayBuffer> {
    const value: unknown = invoke(this.binding, 'heap');
    if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer)) throw new TypeError('Invalid runtime heap');
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  async extension(module: WebAssembly.Module): Promise<Foreign> { return foreign(await invoke(this.binding, 'loadExtension', [module])); }
  language(id: string): Promise<Foreign> {
    const parserId = parserLanguageId(id);
    let pending = this.#languages.get(parserId);
    if (!pending) { pending = this.loadLanguage(parserId); this.#languages.set(parserId, pending); }
    return pending;
  }
  private async loadLanguage(id: string): Promise<Foreign> {
    const bytes = await readFile(parserUrl(id));
    const asset = vendorAssets().find(asset => asset.languageId === id && asset.kind === 'wasm');
    if (!asset || digest(bytes) !== asset.sha256) throw new Error(`Parser identity mismatch: ${id}`);
    return foreign(await invoke(foreign(this.binding.Language), 'load', [bytes]));
  }
}
