import { address } from '../src/native/decode.ts';

export function observeRuntimeAllocations() {
  const original = WebAssembly.instantiate;
  const live = new Set<number>();
  const calls = new Map<string, number>();
  let memory: WebAssembly.Memory | undefined;
  let grow = false;

  function record(name: string, args: unknown[], result: unknown): void {
    calls.set(name, (calls.get(name) ?? 0) + 1);
    if (name === 'free') { live.delete(address(args[0])); return; }
    const pointer = address(result);
    if (name === 'realloc' && (pointer || args[1] === 0)) live.delete(address(args[0]));
    if (pointer) live.add(pointer);
  }

  function wrap(instance: WebAssembly.Instance): WebAssembly.Instance {
    const exports = { ...instance.exports };
    if (exports.memory instanceof WebAssembly.Memory) memory = exports.memory;
    for (const name of ['malloc','calloc','realloc','free']) {
      const fn = exports[name];
      if (typeof fn !== 'function') continue;
      exports[name] = (...args: unknown[]) => {
        if (grow && name !== 'free' && memory) { grow = false; memory.grow(1); }
        const result: unknown = Reflect.apply(fn, undefined, args);
        record(name, args, result);
        return result;
      };
    }
    return new Proxy(instance, { get(target, key) { return key === 'exports' ? exports : Reflect.get(target, key, target); } });
  }

  async function instantiate(source: BufferSource | WebAssembly.Module, imports?: WebAssembly.Imports) {
    if (source instanceof WebAssembly.Module) return wrap(await original(source, imports));
    const result = await original(source, imports);
    return { module: result.module, instance: wrap(result.instance) };
  }

  Object.defineProperty(WebAssembly, 'instantiate', { configurable: true, writable: true, value: instantiate });
  return {
    live: () => live.size,
    calls,
    growOnNextAllocation: () => { grow = true; },
    restore: () => Object.defineProperty(WebAssembly, 'instantiate', { configurable: true, writable: true, value: original }),
  };
}
