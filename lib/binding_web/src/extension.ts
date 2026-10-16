import { C } from './constants';

/** The functions an extension module exports. */
export type ExtensionExports = Record<string, unknown>;

/**
 * Load a C extension: a module built like a grammar (`-fPIC -shared`, no libc) that calls
 * tree-sitter's C API directly. It shares the parser's memory, so it can read trees and
 * languages by address (`tree[0]`, `language[0]`) with no copying. Its imports resolve to
 * the runtime's exports: the public C API and the libc functions grammars may use.
 *
 * Call {@link Parser.init} first.
 */
export async function loadExtension(binary: Uint8Array | WebAssembly.Module): Promise<ExtensionExports> {
  return C.loadWebAssemblyModule(binary, { loadAsync: true });
}

/**
 * A live, length-tracking view of the parser's memory, for exchanging data with extensions.
 * The view and its resizable buffer retain their identity and grow with Wasm memory.
 * Allocation addresses still expire when freed or moved by realloc; copy data to retain it.
 * Addresses above 2 GiB arrive as negative numbers; index with `address >>> 0`.
 */
export function heap(): Uint8Array<ArrayBuffer> {
  return C.HEAPU8;
}
