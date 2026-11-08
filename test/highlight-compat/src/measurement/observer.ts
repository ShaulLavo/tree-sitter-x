/// <reference lib="dom" />
import { address } from '../native/decode.ts';
import { foreign } from '../native/runtime.ts';
import type { Foreign } from '../native/runtime.ts';

export function allocationLedger() {
  const blocks = new Map<number, number>();
  const calls: Record<string, number> = {};
  let liveBytes = 0, peakBytes = 0, unknownFrees = 0;
  function forget(pointer: number): void {
    if (!pointer) return;
    const size = blocks.get(pointer);
    if (size === undefined) { ++unknownFrees; return; }
    liveBytes -= size;
    blocks.delete(pointer);
  }
  function track(name: string, args: readonly number[], result: number): void {
    calls[name] = (calls[name] ?? 0) + 1;
    if (name === 'free') { forget(address(args[0])); return; }
    const pointer = address(result);
    if (name === 'realloc' && (pointer || args[1] === 0)) forget(address(args[0]));
    if (!pointer) return;
    const size = name === 'calloc' ? args[0] * args[1] : name === 'realloc' ? args[1] : args[0];
    if (!Number.isSafeInteger(size) || size < 0 || blocks.has(pointer)) throw new Error('Invalid observed allocation');
    blocks.set(pointer, size);
    liveBytes += size;
    peakBytes = Math.max(peakBytes, liveBytes);
  }
  return { track, snapshot: () => ({ blocks: blocks.size, requestedBytes: liveBytes, peakRequestedBytes: peakBytes, unknownFrees, calls: { ...calls } }) };
}

export function observeAllocations() {
  const original = WebAssembly.instantiate;
  const descriptor = Object.getOwnPropertyDescriptor(WebAssembly, 'instantiate');
  const ledger = allocationLedger();
  function wrap(instance: WebAssembly.Instance): WebAssembly.Instance {
    const exports = { ...instance.exports };
    for (const name of ['malloc', 'calloc', 'realloc', 'free']) {
      const fn = exports[name];
      if (typeof fn === 'function') exports[name] = (...args: number[]) => call(fn, name, args);
    }
    return new Proxy(instance, { get: (target, key) => key === 'exports' ? exports : Reflect.get(target, key, target) });
  }
  function call(fn: Function, name: string, args: number[]): unknown {
    const result: unknown = Reflect.apply(fn, undefined, args);
    ledger.track(name, args, name === 'free' ? 0 : address(result));
    return result;
  }
  async function instantiate(source: BufferSource | WebAssembly.Module, imports?: WebAssembly.Imports) {
    if (source instanceof WebAssembly.Module) return wrap(await original(source, imports));
    const result = await original(source, imports);
    return { module: result.module, instance: wrap(result.instance) };
  }
  Object.defineProperty(WebAssembly, 'instantiate', { configurable: true, writable: true, value: instantiate });
  let installed = true;
  return { snapshot: ledger.snapshot, restore: () => {
    if (!installed) return; installed = false;
    if (descriptor) Object.defineProperty(WebAssembly, 'instantiate', descriptor);
    else Reflect.deleteProperty(WebAssembly, 'instantiate');
  } };
}

export function observeParses(binding: Foreign) {
  const prototype = foreign(foreign(binding.Parser).prototype);
  let calls = 0;
  const restore = replaceMethod(prototype, 'parse', original => function(this: unknown, ...args: unknown[]) {
    ++calls;
    return Reflect.apply(original, this, args);
  });
  return { count: () => calls, restore };
}

export function replaceMethod(target: object, key: PropertyKey, make: (original: Function) => Function): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key), original: unknown = Reflect.get(target, key);
  if (typeof original !== 'function') throw new Error(`Measurement method unavailable: ${String(key)}`);
  Object.defineProperty(target, key, { ...(descriptor ?? { configurable: true, writable: true, enumerable: false }), value: make(original) });
  let installed = true;
  return () => {
    if (!installed) return; installed = false;
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  };
}
