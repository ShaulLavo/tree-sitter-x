import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import createModule from '../src/wasi-module';
import type { ModuleOptions } from '../src/wasi-module';
import { buildFixture, memoryInfo, sideFixture } from './wasm-fixtures';

let directory: string;
let runtimePath: string;

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'tree-sitter-runtime-'));
  runtimePath = path.join(directory, 'runtime #1%20.wasm');
  await copyFile('lib/web-tree-sitter.wasm', runtimePath);
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('runtime location', () => {
  it.each(['absolute path', 'relative path', 'file URL'])('loads from %s containing URL punctuation', async (kind) => {
    let location = runtimePath;
    if (kind === 'relative path') location = path.relative(process.cwd(), runtimePath);
    if (kind === 'file URL') location = pathToFileURL(runtimePath).href;
    const module = await createModule({ locateFile: () => location });
    expect(module._ts_init()).toBeGreaterThan(0);
  });
});

async function runtime(options?: ModuleOptions) {
  const conversion = typeof WebAssembly.Memory.prototype.toResizableBuffer === 'function'
    ? vi.spyOn(WebAssembly.Memory.prototype, 'toResizableBuffer') : undefined;
  const buffers = vi.spyOn(WebAssembly.Memory.prototype, 'buffer', 'get');
  try {
    const module = await createModule(options);
    if (conversion) expect(conversion).toHaveBeenCalledTimes(1);
    const memory = conversion?.mock.contexts[0] ?? buffers.mock.contexts[0];
    if (!(memory instanceof WebAssembly.Memory)) throw new Error('Runtime did not access its memory');
    return { module, memory };
  } finally {
    conversion?.mockRestore();
    buffers.mockRestore();
  }
}

function assertScalars(module: Awaited<ReturnType<typeof createModule>>, address: number, memory: WebAssembly.Memory) {
  for (const [type, value] of [
    ['i1', -1], ['i8', -12], ['i16', -1234], ['i32', -123456],
    ['*', -2147483647], ['i64', -4294967297], ['float', -1.5], ['double', Math.PI],
  ] as const) {
    memory.grow(0);
    module.setValue(address, value, type);
    memory.grow(0);
    expect(module.getValue(address, type)).toBe(value);
  }
  module.HEAPU8.set([0, 0, 192, 63], address);
  expect(module.getValue(address, 'float')).toBe(1.5);
  module.setValue(address, 1.5, 'double');
  expect(Array.from(module.HEAPU8.subarray(address, address + 8))).toEqual([0, 0, 0, 0, 0, 0, 248, 63]);
  module.HEAPU8.set([255, 255, 255, 255, 254, 255, 255, 255], address);
  expect(module.getValue(address, 'i64')).toBe(-4294967297);
}

const conversionDescriptor = Object.getOwnPropertyDescriptor(WebAssembly.Memory.prototype, 'toResizableBuffer');
const modes = typeof WebAssembly.Memory.prototype.toResizableBuffer === 'function'
  ? ['resizable', 'fixed'] : ['fixed'];

describe.each(modes)('%s heap', (mode) => {
  beforeEach(() => {
    if (mode === 'fixed') Object.defineProperty(WebAssembly.Memory.prototype, 'toResizableBuffer', { configurable: true, value: undefined });
  });

  afterEach(() => {
    if (conversionDescriptor) Object.defineProperty(WebAssembly.Memory.prototype, 'toResizableBuffer', conversionDescriptor);
    else Reflect.deleteProperty(WebAssembly.Memory.prototype, 'toResizableBuffer');
  });

  it('refreshes before constructors grow memory and call JS', async () => {
    const { module, memory } = await runtime({ wasmBinary: buildFixture('memory', true) });
    const initializedLength = Reflect.get(module, '_initialized_length') as () => number;
    expect(initializedLength()).toBe(0);
    const bytes = module.HEAPU8;
    const buffer = bytes.buffer;
    const length = bytes.length;
    bytes[32] = 0x23;
    const grow = Reflect.get(module, '_grow') as (pages: number) => number;
    expect(grow(0)).toBe(length / 65536);
    expect(module.HEAPU8.buffer === buffer).toBe(mode === 'resizable');
    expect(grow(2)).toBe(length / 65536);
    expect(module.HEAPU8.length).toBe(length + 2 * 65536);
    expect(memory.buffer === buffer).toBe(mode === 'resizable');
    expect(module.HEAPU8[32]).toBe(0x23);
    module.setValue(length + 16, 0x12345678, 'i32');
    expect(Array.from(module.HEAPU8.subarray(length + 16, length + 20))).toEqual([0x78, 0x56, 0x34, 0x12]);
  });

  it('exposes the current view across zero, positive host and allocator growth', async () => {
    const { module, memory } = await runtime();
    const bytes = module.HEAPU8;
    const buffer = bytes.buffer;
    expect(buffer.resizable).toBe(mode === 'resizable');
    if (mode === 'resizable') expect(buffer.maxByteLength).toBe(4294967296);
    expect(bytes.length).toBeLessThan(2 * 1024 * 1024);
    const address = module._malloc(32) >>> 0;
    let allocation = 0;
    try {
      bytes[address] = 0x23;
      const length = bytes.length;
      memory.grow(0);
      expect(module.HEAPU8.length).toBe(length);
      expect(module.HEAPU8 === bytes).toBe(mode === 'resizable');
      expect(memory.buffer === buffer).toBe(mode === 'resizable');
      if (mode === 'fixed') expect(bytes.byteLength).toBe(0);
      memory.grow(2);
      expect(module.HEAPU8.length).toBe(length + 2 * 65536);
      module.setValue(length + 8, 0x12345678, 'i32');
      expect(Array.from(module.HEAPU8.subarray(length + 8, length + 12))).toEqual([0x78, 0x56, 0x34, 0x12]);
      expect(module.getValue(length + 8, 'i32')).toBe(0x12345678);
      const allocationSize = module.HEAPU8.length * 2;
      allocation = module._malloc(allocationSize);
      expect(allocation).not.toBe(0);
      expect(module.HEAPU8.length).toBeGreaterThan(length + 2 * 65536);
      expect(module.HEAPU8 === bytes).toBe(mode === 'resizable');
      expect(module.HEAPU8.buffer === buffer).toBe(mode === 'resizable');
      expect(module.HEAPU8[address]).toBe(0x23);
      const end = (allocation >>> 0) + allocationSize - 16;
      expect(end).toBeGreaterThan(length);
      module.setValue(end, 0x12345678, 'i32');
      expect(Array.from(module.HEAPU8.subarray(end, end + 4))).toEqual([0x78, 0x56, 0x34, 0x12]);
    } finally {
      module._free(allocation);
      module._free(address);
    }
  });

  it('supports the full Wasm32 limit with a small initial buffer', async () => {
    const { module, memory } = await runtime();
    const initial = module.HEAPU8.byteLength;
    expect(initial).toBeLessThan(2 * 1024 * 1024);
    expect(memory.grow(65536 - initial / 65536)).toBe(initial / 65536);
    expect(module.HEAPU8.byteLength).toBe(4294967296);
    module.setValue(-8, 0x12345678, 'i32');
    expect(module.getValue(-8, 'i32')).toBe(0x12345678);
    expect(Array.from(module.HEAPU8.subarray(4294967288, 4294967292))).toEqual([0x78, 0x56, 0x34, 0x12]);
    expect(() => memory.grow(1)).toThrow(RangeError);
  });

  it('links side-module data after its allocation grows memory', async () => {
    const { module } = await runtime();
    const initial = module.HEAPU8.byteLength;
    const side = await module.loadWebAssemblyModule(buildFixture('heap-data'), { loadAsync: true });
    const address = side.data_address;
    expect(module.HEAPU8.byteLength).toBeGreaterThan(initial);
    expect(module.HEAPU8[address()]).toBe(0);
    expect(module.HEAPU8[address() + 4 * 1024 * 1024 - 1]).toBe(0);
  });

  it('preserves scalar values, little endian bytes and default types after growth', async () => {
    const { module, memory } = await runtime();
    const address = module._malloc(32) >>> 0;
    try {
      memory.grow(1);
      assertScalars(module, address, memory);
      assertScalars(module, memory.buffer.byteLength - 32, memory);
      module.setValue(address, -42);
      expect(module.getValue(address)).toBe(-42);
      module.setValue(address, 0x12345678, 'i32');
      expect(Array.from(module.HEAPU8.subarray(address, address + 4))).toEqual([0x78, 0x56, 0x34, 0x12]);
      expect(() => module.getValue(address, 'invalid')).toThrow('invalid type');
      expect(() => { module.setValue(address, 0, 'invalid'); }).toThrow('invalid type');
    } finally {
      module._free(address);
    }
  });

  it('uses fixed UTF-8 boundaries, preserving bounds, NUL and owned Unicode strings', assertStringGrowth);
});

function assertFixedEncodingInput(source: AllowSharedBufferSource | undefined) {
  if (!source) return;
  const buffer = ArrayBuffer.isView(source) ? source.buffer : source;
  if (buffer instanceof ArrayBuffer) expect(buffer.resizable).toBe(false);
}

function throwFixtureValue(value: unknown): never {
  throw value;
}

async function observedRuntime() {
  const instantiate = WebAssembly.instantiate;
  const live = new Set<number>();
  const allocations: number[] = [];
  const frees: number[] = [];
  const control = { result: undefined as number | undefined, throwOnMalloc: false };
  const thrown = { fixture: 'original thrown value' };
  let captured: WebAssembly.Exports | undefined;
  Reflect.set(WebAssembly, 'instantiate', async (compiled: WebAssembly.Module, imports: WebAssembly.Imports) => {
    const instance = await instantiate(compiled, imports);
    captured = instance.exports;
    const malloc = captured.malloc as (size: number) => number;
    const free = captured.free as (pointer: number) => void;
    return { exports: { ...captured,
      malloc(size: number) {
        if (control.throwOnMalloc) throwFixtureValue(thrown);
        const pointer = control.result ?? (malloc(size) >>> 0);
        allocations.push(pointer);
        if (pointer && control.result === undefined) live.add(pointer);
        return pointer;
      },
      free(pointer: number) {
        frees.push(pointer >>> 0);
        if (live.delete(pointer >>> 0)) free(pointer);
      },
    } };
  });
  try {
    const module = await createModule();
    if (!captured) throw new Error('Missing actual runtime exports');
    const table = captured.__indirect_function_table;
    const stack = captured.__stack_pointer;
    if (!(table instanceof WebAssembly.Table) || !(stack instanceof WebAssembly.Global)) throw new Error('Missing linker state');
    return { module, table, stack, live, allocations, frees, control, thrown, exports: captured };
  } finally {
    Reflect.set(WebAssembly, 'instantiate', instantiate);
  }
}

function tableEntries(table: WebAssembly.Table): unknown[] {
  return Array.from({ length: table.length }, (_, index) => table.get(index) as unknown);
}

const malformedMetadata: [string, number[][]][] = [
  ['missing section', []],
  ['missing memory info', [[]]],
  ['truncated subsection size', [[1, 0x80]]],
  ['overflowed subsection size', [[1, 0x80, 0x80, 0x80, 0x80, 0x10]]],
  ['overlong subsection size', [[1, 0x80, 0x80, 0x80, 0x80, 0x80, 0]]],
  ['subsection outside section', [[2, 16, 0]]],
  ['truncated memory info', [[1, 3, 64, 4, 1]]],
  ['integer crossing record end', [[1, 4, 64, 4, 1, 0x80, 0]]],
  ['overflowed memory size', [[1, 8, 0xff, 0xff, 0xff, 0xff, 0x10, 4, 1, 0]]],
  ['trailing memory info fields', [[1, 5, 64, 4, 1, 0, 0]]],
  ['duplicate memory info', [memoryInfo().concat(memoryInfo())]],
  ['duplicate sections', [memoryInfo(), memoryInfo()]],
  ['memory alignment outside wasm32', [memoryInfo(64, 32)]],
  ['table alignment outside wasm32', [memoryInfo(64, 4, 1, 32)]],
  ['allocation size overflow', [memoryInfo(0xffffffff, 4)]],
  ['table offset overflow', [memoryInfo(64, 4, 0xffffffff)]],
];

describe.each(modes)('%s transactional linking', (mode) => {
  beforeEach(() => {
    if (mode === 'fixed') Object.defineProperty(WebAssembly.Memory.prototype, 'toResizableBuffer', { configurable: true, value: undefined });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (conversionDescriptor) Object.defineProperty(WebAssembly.Memory.prototype, 'toResizableBuffer', conversionDescriptor);
    else Reflect.deleteProperty(WebAssembly.Memory.prototype, 'toResizableBuffer');
  });

  it.each(malformedMetadata)('rejects %s before allocation or table growth', async (_, metadata) => {
    const { module, table, allocations } = await observedRuntime();
    const capacity = table.length;
    const binary = sideFixture({ metadata });
    expect(WebAssembly.validate(binary)).toBe(true);
    await expect(module.loadWebAssemblyModule(binary, { loadAsync: true })).rejects.toThrow(/dylink|alignment|overflow/i);
    expect(allocations).toEqual([]);
    expect(table.length).toBe(capacity);
  });

  it.each([
    { module: 'elsewhere', name: 'missing', kind: 'function' },
    { module: 'env', name: 'missing', kind: 'function' },
    { module: 'env', name: 'memory', kind: 'function' },
    { module: 'env', name: 'malloc', kind: 'global' },
    { module: 'GOT.func', name: 'value', kind: 'function' },
    { module: 'GOT.mem', name: 'data', kind: 'function' },
    { module: 'env', name: 'toString', kind: 'function' },
  ] as const)('preflights unsupported import $module.$name ($kind)', async (extraImport) => {
    const { module, table, allocations } = await observedRuntime();
    const capacity = table.length;
    await expect(module.loadWebAssemblyModule(sideFixture({ extraImport }), { loadAsync: true })).rejects.toThrow();
    expect(allocations).toEqual([]);
    expect(table.length).toBe(capacity);
  });

  it('checks zero and overflowing allocator results before writes', async () => {
    const { module, table, allocations, frees, control } = await observedRuntime();
    const before = module.HEAPU8.slice(0, 128);
    const capacity = table.length;
    control.result = 0;
    await expect(module.loadWebAssemblyModule(sideFixture(), { loadAsync: true })).rejects.toThrow(/allocat/i);
    expect(module.HEAPU8.slice(0, 128)).toEqual(before);
    expect(table.length).toBe(capacity);
    control.result = 0xfffffff8;
    await expect(module.loadWebAssemblyModule(sideFixture(), { loadAsync: true })).rejects.toThrow(/overflow|bounds/i);
    expect(module.HEAPU8.slice(0, 128)).toEqual(before);
    expect(allocations).toEqual([0, 0xfffffff8]);
    expect(frees).toEqual([0xfffffff8]);
    expect(table.length).toBe(capacity);
  });

  it('frees the original allocation when table growth fails', async () => {
    const { module, table, allocations, frees, live, thrown } = await observedRuntime();
    vi.spyOn(table, 'grow').mockImplementationOnce(() => { throwFixtureValue(thrown); });
    await expect(module.loadWebAssemblyModule(sideFixture({ memoryAlign: 8 }), { loadAsync: true })).rejects.toBe(thrown);
    expect(allocations).toHaveLength(1);
    expect(allocations[0] % 256).not.toBe(0);
    expect(frees).toEqual(allocations);
    expect(live.size).toBe(0);
  });

  it.each(['start', 'relocation', 'constructor'] as const)('rolls back repeated %s traps and preserves live data and functions', async (trap) => {
    const { module, table, stack, allocations, frees, live, exports } = await observedRuntime();
    const savedStack = stack.value as number;
    const control = new WebAssembly.Module(sideFixture({ memorySize: 0, tableSize: 0, trap }));
    const invokeTrap = () => {
      const instance = new WebAssembly.Instance(control, { env: { memory: exports.memory, __indirect_function_table: table,
        __stack_pointer: stack, __memory_base: new WebAssembly.Global({ value: 'i32' }, 0), __table_base: new WebAssembly.Global({ value: 'i32' }, 0) } });
      const name = trap === 'relocation' ? '__wasm_apply_data_relocs' : '__wasm_call_ctors';
      const fn = instance.exports[name];
      if (typeof fn === 'function') (fn as () => void)();
    };
    try {
      expect(invokeTrap).toThrow(WebAssembly.RuntimeError);
      expect(stack.value).toBe(32);
    } finally { stack.value = savedStack; }
    const side = await module.loadWebAssemblyModule(sideFixture(), { loadAsync: true });
    const base = side.base();
    const tableBase = side.table_base();
    expect(side.value()).toBe(42);
    expect(table.get(tableBase)).toBe(side.value);
    expect(live.size).toBe(1);
    module.HEAPU8[base] = 123;
    const before = tableEntries(table);
    let capacity = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(module.loadWebAssemblyModule(sideFixture({ trap, memoryAlign: 8, tableAlign: 4, functionGot: 'value', memoryGot: 'data' }), { loadAsync: true })).rejects.toBeInstanceOf(WebAssembly.RuntimeError);
      if (!attempt) capacity = table.length;
      expect(capacity - before.length).toBeGreaterThan(0);
      expect(capacity - before.length).toBeLessThanOrEqual(17);
      expect(table.length).toBe(capacity);
      expect(stack.value).toBe(savedStack);
      expect(live.size).toBe(1);
      expect(tableEntries(table).slice(0, before.length)).toEqual(before);
      expect(tableEntries(table).slice(before.length).every(entry => entry === null)).toBe(true);
      expect(module.HEAPU8[base]).toBe(123);
      expect(side.value()).toBe(42);
    }
    expect(frees).toEqual(allocations.slice(1));
    const recovered = await module.loadWebAssemblyModule(sideFixture({ functionGot: 'value', memoryGot: 'data' }), { loadAsync: true });
    expect(recovered.value()).toBe(42);
    const functionSlot: unknown = Reflect.get(recovered, 'function_slot');
    const memorySlot: unknown = Reflect.get(recovered, 'memory_slot');
    expect(functionSlot).toBeInstanceOf(WebAssembly.Global);
    expect(memorySlot).toBeInstanceOf(WebAssembly.Global);
    if (!(functionSlot instanceof WebAssembly.Global) || !(memorySlot instanceof WebAssembly.Global)) throw new Error('Missing real GOT slots');
    expect(table.get(functionSlot.value as number)).toBe(recovered.value);
    expect(memorySlot.value).toBe(recovered.base());
    expect(live.size).toBe(2);
  });

  it('preserves a thrown host value and clears partially populated GOT function slots', async () => {
    const { module, table, control, thrown, live, stack } = await observedRuntime();
    const before = tableEntries(table);
    const savedStack = stack.value as number;
    const setEntry = table.set.bind(table);
    const set = vi.spyOn(table, 'set');
    set.mockImplementationOnce(setEntry).mockImplementationOnce(() => { throwFixtureValue(thrown); });
    await expect(module.loadWebAssemblyModule(sideFixture({ functionGot: 'value', additionalFunctionGot: 'base' }), { loadAsync: true })).rejects.toBe(thrown);
    expect(live.size).toBe(0);
    set.mockRestore();
    control.throwOnMalloc = true;
    await expect(module.loadWebAssemblyModule(sideFixture(), { loadAsync: true })).rejects.toBe(thrown);
    control.throwOnMalloc = false;
    // The constructor calls the same captured allocator after its static allocation.
    const malloc = vi.spyOn(module, '_malloc');
    malloc.mockImplementation(() => { throw new Error('unused public wrapper'); });
    let calls = 0;
    Object.defineProperty(control, 'throwOnMalloc', { get: () => ++calls > 1 });
    await expect(module.loadWebAssemblyModule(sideFixture({ callMalloc: true, functionGot: 'value' }), { loadAsync: true })).rejects.toBe(thrown);
    expect(malloc).not.toHaveBeenCalled();
    expect(calls).toBe(2);
    expect(stack.value).toBe(savedStack);
    expect(live.size).toBe(0);
    expect(tableEntries(table).slice(0, before.length)).toEqual(before);
    expect(tableEntries(table).slice(before.length).every(entry => entry === null)).toBe(true);
  });

  it('rejects combined table/GOT overflow before allocation and supports empty reservations', async () => {
    const { module, table, allocations } = await observedRuntime();
    const capacity = table.length;
    await expect(module.loadWebAssemblyModule(sideFixture({ tableSize: 0xffffffff, functionGot: 'value' }), { loadAsync: true })).rejects.toThrow(/overflow/);
    expect(allocations).toEqual([]);
    const side = module.loadWebAssemblyModule(sideFixture({ memorySize: 0, tableSize: 0 }), { loadAsync: false });
    expect(side.value()).toBe(42);
    expect(allocations).toEqual([]);
    expect(table.length).toBe(capacity);
  });

  it('rolls back an engine import-type failure during instantiation', async () => {
    const { module, table, allocations, frees, live, stack } = await observedRuntime();
    const before = tableEntries(table);
    const savedStack = stack.value as number;
    // memcpy expects three i32 arguments; this fixture deliberately imports () -> void.
    const binary = sideFixture({ extraImport: { module: 'env', name: 'memcpy', kind: 'function' } });
    await expect(module.loadWebAssemblyModule(binary, { loadAsync: true })).rejects.toBeInstanceOf(WebAssembly.LinkError);
    expect(frees).toEqual(allocations);
    expect(live.size).toBe(0);
    expect(stack.value).toBe(savedStack);
    expect(tableEntries(table).slice(0, before.length)).toEqual(before);
    expect(tableEntries(table).slice(before.length).every(entry => entry === null)).toBe(true);
  });

  it('preserves real allocations above the signed i32 boundary', async () => {
    const { module, live, allocations, frees } = await observedRuntime();
    const large = module._malloc(0x40000000);
    const second = module._malloc(0x40000000);
    try {
      expect(large).not.toBe(0);
      expect(second).not.toBe(0);
      const side = await module.loadWebAssemblyModule(sideFixture({ memoryAlign: 8 }), { loadAsync: true });
      expect(side.base() >>> 0).toBeGreaterThan(0x80000000);
      expect(module.HEAPU8[side.base() >>> 0]).toBe(99);
      expect(side.value()).toBe(42);
      const allocationCount = allocations.length;
      await expect(module.loadWebAssemblyModule(sideFixture({ memoryAlign: 8, trap: 'constructor' }), { loadAsync: true })).rejects.toBeInstanceOf(WebAssembly.RuntimeError);
      expect(allocations).toHaveLength(allocationCount + 1);
      expect(frees.at(-1)).toBe(allocations.at(-1));
      expect(live.size).toBe(3);
      expect(module.HEAPU8[side.base() >>> 0]).toBe(99);
    } finally {
      module._free(second);
      module._free(large);
    }
  });

  it('preflights missing GOT symbols and accepts bounded unknown metadata', async () => {
    const { module, allocations } = await observedRuntime();
    await expect(module.loadWebAssemblyModule(sideFixture({ functionGot: 'missing' }), { loadAsync: true })).rejects.toThrow();
    await expect(module.loadWebAssemblyModule(sideFixture({ memoryGot: 'value' }), { loadAsync: true })).rejects.toThrow();
    expect(allocations).toEqual([]);
    const metadata = [[99, 1, 0].concat(memoryInfo(64, 8, 1, 3))];
    const side = module.loadWebAssemblyModule(sideFixture({ metadata }), { loadAsync: false });
    expect(side.base() % 256).toBe(0);
    expect(side.table_base() % 8).toBe(0);
    expect(side.value()).toBe(42);
    expect(allocations).toHaveLength(1);
  });
});

async function assertStringGrowth() {
  const { module, memory } = await runtime();
  const address = module._malloc(32768) >>> 0;
  const encode = vi.spyOn(TextEncoder.prototype, 'encodeInto');
  const decode = vi.spyOn(TextDecoder.prototype, 'decode');
  try {
    for (const text of ['ASCII', 'hé水😀', 'a\0é😀', '\ud800x\udc00']) {
      const expected = new TextDecoder().decode(new TextEncoder().encode(text));
      memory.grow(0);
      const length = module.stringToUTF8(text, address, 128);
      expect(module.HEAPU8[address + length]).toBe(0);
      memory.grow(0);
      expect(module.UTF8ToString(address, length, true)).toBe(expected);
      memory.grow(0);
      expect(module.UTF8ToString(address)).toBe(expected.split('\0')[0]);
    }
    module.stringToUTF8('ASCII', address, 128);
    memory.grow(0);
    expect(module.AsciiToString(address)).toBe('ASCII');
    expect(module.stringToUTF8('😀x', address, 4)).toBe(0);
    expect(module.stringToUTF8('😀x', address, 5)).toBe(4);
    expect(module.UTF8ToString(address, 4)).toBe('😀');
    const retained = module.UTF8ToString(address, 4);
    memory.grow(1);
    module.stringToUTF8('other', address, 128);
    expect(retained).toBe('😀');
    expect(module.UTF8ToString(0)).toBe('');
    expect(module.stringToUTF8('x', address, 0)).toBe(0);
    for (const [, destination] of encode.mock.calls) {
      expect(destination.buffer).toBeInstanceOf(ArrayBuffer);
      assertFixedEncodingInput(destination);
    }
    for (const [source] of decode.mock.calls) {
      assertFixedEncodingInput(source);
    }

    const text = 'x'.repeat(4095) + '😀' + 'é水\0\ud800';
    memory.grow(0);
    expect(module.stringToUTF16(text, address, 32768)).toBe(text.length * 2);
    const units = new Uint16Array(module.HEAPU8.buffer, address, text.length + 1);
    expect(Array.from(units)).toEqual(Array.from({ length: text.length }, (_, i) => text.charCodeAt(i)).concat([0]));
    expect(module.stringToUTF16('😀', address, 4)).toBe(2);
    expect(units[0]).toBe(0xd83d);
    expect(units[1]).toBe(0);
    expect(module.stringToUTF16('x', address, 1)).toBe(0);
    expect(module.stringToUTF16('', address, 2)).toBe(0);
    expect(units[0]).toBe(0);
  } finally {
    encode.mockRestore();
    decode.mockRestore();
    module._free(address);
  }
}
