import { address } from '../src/native/decode.ts';

function wasmAllocators(functions: WebAssembly.ModuleImports): WebAssembly.Exports {
  const string = (text: string): number[] => [text.length].concat(Array.from(text, char => char.charCodeAt(0)));
  const section = (id: number, bytes: number[]): number[] => [id, bytes.length].concat(bytes);
  const names = ['malloc', 'calloc', 'realloc', 'free'];
  const signatures = [0, 1, 1, 2];
  const types = section(1, [3, 0x60, 1, 0x7f, 1, 0x7f, 0x60, 2, 0x7f, 0x7f, 1, 0x7f, 0x60, 1, 0x7f, 0]);
  const imports = section(2, [4].concat(names.flatMap((name, i) => string('env').concat(string(name), [0, signatures[i]]))));
  const definitions = section(3, [4].concat(signatures));
  const exports = section(7, [4].concat(names.flatMap((name, i) => string(name).concat([0, i + 4]))));
  const bodies = names.flatMap((_name, i) => {
    const args = i === 1 || i === 2 ? [0x20, 0, 0x20, 1] : [0x20, 0];
    const body = [0].concat(args, [0x10, i, 0x0b]);
    return [body.length].concat(body);
  });
  const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0].concat(types, imports, definitions, exports, section(10, [4].concat(bodies))));
  return new WebAssembly.Instance(new WebAssembly.Module(bytes), { env: functions }).exports;
}

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
    if (!(instance.exports.memory instanceof WebAssembly.Memory)) return instance;
    const exports = { ...instance.exports };
    if (exports.memory instanceof WebAssembly.Memory) memory = exports.memory;
    const functions: WebAssembly.ModuleImports = {};
    for (const name of ['malloc','calloc','realloc','free']) {
      const fn = exports[name];
      if (typeof fn !== 'function') continue;
      functions[name] = observed(name, fn);
    }
    Object.assign(exports, wasmAllocators(functions));
    return new Proxy(instance, { get(target, key) { return key === 'exports' ? exports : Reflect.get(target, key, target); } });
  }

  function growIfRequested(name: string): void {
    if (!grow || name === 'free' || !memory) return;
    grow = false; memory.grow(1);
  }
  function observed(name: string, fn: CallableFunction) {
    return (...args: unknown[]) => {
      growIfRequested(name);
      const result: unknown = Reflect.apply(fn, undefined, args);
      record(name, args, result);
      return result;
    };
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
