import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import createModule from '../src/wasi-module';
import type { ModuleOptions } from '../src/wasi-module';
import { buildFixture } from './wasm-fixtures';

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

  it('uses fixed UTF-8 boundaries, preserving bounds, NUL and owned Unicode strings', async () => {
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
        if (destination.buffer instanceof ArrayBuffer) expect(destination.buffer.resizable).toBe(false);
      }
      for (const [source] of decode.mock.calls) {
        if (ArrayBuffer.isView(source) && source.buffer instanceof ArrayBuffer) expect(source.buffer.resizable).toBe(false);
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
  });
});
