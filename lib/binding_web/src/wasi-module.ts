import type { MainModule } from '../lib/web-tree-sitter';

/**
 * Options for {@link createModule}, a subset of Emscripten's module options.
 */
export interface ModuleOptions {
  /** Maps the runtime's file name to its URL or path. */
  locateFile?: (path: string, scriptDirectory: string) => string;
  /** The runtime's bytes, or a compiled module, instead of fetching it. */
  wasmBinary?: ArrayBufferView | ArrayBuffer | WebAssembly.Module;
}

type Exports = Record<string, unknown> & {
  memory: WebAssembly.Memory;
  __indirect_function_table: WebAssembly.Table;
  __stack_pointer: WebAssembly.Global;
  _initialize: () => void;
  malloc: (size: number) => number;
};

type SideExports = Record<string, unknown>;

// wasi_snapshot_preview1 imports of the runtime: no files, and no entropy needed.
const ERRNO_BADF = 8;
const ERRNO_NOSYS = 52;
const wasi = {
  fd_close: () => ERRNO_BADF,
  fd_seek: () => ERRNO_BADF,
  fd_write: () => ERRNO_BADF,
  random_get: () => ERRNO_NOSYS,
};

const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();
const INPUT_BUFFER_SIZE = 10 * 1024;

function readLeb(bytes: Uint8Array, cursor: { at: number }): number {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = bytes[cursor.at++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return result >>> 0;
}

// The WASM_DYLINK_MEM_INFO subsection of a side module's `dylink.0` section.
function dylinkInfo(module: WebAssembly.Module) {
  const info = { memorySize: 0, memoryAlign: 0, tableSize: 0, tableAlign: 0 };
  const sections = WebAssembly.Module.customSections(module, 'dylink.0');
  if (sections.length === 0) throw new Error('Language module has no dylink.0 section');
  const bytes = new Uint8Array(sections[0]);
  const cursor = { at: 0 };
  while (cursor.at < bytes.length) {
    const type = bytes[cursor.at++];
    const size = readLeb(bytes, cursor);
    const end = cursor.at + size;
    if (type === 1) {
      info.memorySize = readLeb(bytes, cursor);
      info.memoryAlign = readLeb(bytes, cursor);
      info.tableSize = readLeb(bytes, cursor);
      info.tableAlign = readLeb(bytes, cursor);
    }
    cursor.at = end;
  }
  return info;
}

async function runtimeBytes(options: ModuleOptions): Promise<ArrayBufferView | ArrayBuffer | WebAssembly.Module> {
  if (options.wasmBinary) return options.wasmBinary;
  const base = new URL('.', import.meta.url).href;
  const location = options.locateFile?.('web-tree-sitter.wasm', base) ?? new URL('web-tree-sitter.wasm', import.meta.url).href;
  const url = new URL(location, base);
  if (url.protocol === 'file:') {
    const { readFile } = await import('fs/promises');
    // The published bundle sits beside the runtime; the sources in src/ reach it in lib/.
    return readFile(url).catch((error: unknown) => {
      if (options.locateFile) throw error;
      return readFile(new URL('../lib/web-tree-sitter.wasm', import.meta.url));
    });
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url.href}: ${response.status}`);
  return response.arrayBuffer();
}

/**
 * Instantiates the WASI-built runtime and returns the object the bindings call through,
 * shaped like the Emscripten module they were written against.
 */
export default async function createModule(options: ModuleOptions = {}): Promise<MainModule> {
  const module = {
    currentParseCallback: null,
    currentLogCallback: null,
    currentProgressCallback: null,
    currentQueryProgressCallback: null,
  } as unknown as MainModule & Record<string, unknown>;

  // Filled once the runtime is instantiated; the import callbacks run only after that.
  const runtime = { exports: undefined as unknown as Exports };
  let heapBuffer: ArrayBufferLike | null = null;
  let heap = new DataView(new ArrayBuffer(0));
  let heapBytes = new Uint8Array(0);
  // Memory can grow during any call into the runtime, detaching earlier views.
  const view = () => {
    if (runtime.exports.memory.buffer !== heapBuffer) {
      heapBuffer = runtime.exports.memory.buffer;
      heap = new DataView(heapBuffer);
      heapBytes = new Uint8Array(heapBuffer);
    }
    return heap;
  };
  const bytes = () => {
    view();
    return heapBytes;
  };

  const getValue = (ptr: number, type = 'i8'): number => {
    const memory = view();
    switch (type) {
      case 'i1':
      case 'i8': return memory.getInt8(ptr);
      case 'i16': return memory.getInt16(ptr, true);
      case 'i32': case '*': return memory.getInt32(ptr, true);
      case 'i64': return Number(memory.getBigInt64(ptr, true));
      case 'float': return memory.getFloat32(ptr, true);
      case 'double': return memory.getFloat64(ptr, true);
      default: throw new Error(`getValue: invalid type ${type}`);
    }
  };
  const setValue = (ptr: number, value: number, type = 'i8'): void => {
    const memory = view();
    switch (type) {
      case 'i1':
      case 'i8': memory.setInt8(ptr, value); return;
      case 'i16': memory.setInt16(ptr, value, true); return;
      case 'i32': case '*': memory.setInt32(ptr, value, true); return;
      case 'i64': memory.setBigInt64(ptr, BigInt(value), true); return;
      case 'float': memory.setFloat32(ptr, value, true); return;
      case 'double': memory.setFloat64(ptr, value, true); return;
      default: throw new Error(`setValue: invalid type ${type}`);
    }
  };
  const UTF8ToString = (ptr: number, maxBytesToRead?: number, ignoreNul?: boolean): string => {
    if (!ptr) return '';
    const heapU8 = bytes();
    const limit = maxBytesToRead === undefined ? heapU8.length : Math.min(heapU8.length, ptr + maxBytesToRead);
    let end = ptr;
    if (ignoreNul) end = limit;
    else while (end < limit && heapU8[end]) end++;
    return utf8Decoder.decode(heapU8.subarray(ptr, end));
  };
  const AsciiToString = (ptr: number): string => {
    const heapU8 = bytes();
    let result = '';
    for (let at = ptr; heapU8[at]; at++) result += String.fromCharCode(heapU8[at]);
    return result;
  };
  const lengthBytesUTF8 = (str: string): number => utf8Encoder.encode(str).length;
  const stringToUTF8 = (str: string, outPtr: number, maxBytesToWrite: number): number => {
    if (maxBytesToWrite <= 0) return 0;
    const target = bytes().subarray(outPtr, outPtr + maxBytesToWrite - 1);
    const { written } = utf8Encoder.encodeInto(str, target);
    bytes()[outPtr + written] = 0;
    return written;
  };
  const stringToUTF16 = (str: string, outPtr: number, maxBytesToWrite = 0x7fffffff): number => {
    if (maxBytesToWrite < 2) return 0;
    const memory = view();
    const length = Math.min(str.length, (maxBytesToWrite - 2) >> 1);
    for (let i = 0; i < length; i++) memory.setUint16(outPtr + 2 * i, str.charCodeAt(i), true);
    memory.setUint16(outPtr + 2 * length, 0, true);
    return 2 * length;
  };

  const imports = {
    wasi_snapshot_preview1: wasi,
    env: {
      tree_sitter_parse_callback(inputBufferAddress: number, index: number, row: number, column: number, lengthAddress: number) {
        const text = module.currentParseCallback?.(index, { row, column });
        if (typeof text === 'string') {
          setValue(lengthAddress, text.length, 'i32');
          stringToUTF16(text, inputBufferAddress, INPUT_BUFFER_SIZE);
        } else {
          setValue(lengthAddress, 0, 'i32');
        }
      },
      tree_sitter_log_callback(isLexMessage: number, messageAddress: number) {
        module.currentLogCallback?.(UTF8ToString(messageAddress), isLexMessage !== 0);
      },
      // A progress callback returns true to cancel, although MainModule types it as void.
      tree_sitter_progress_callback(currentOffset: number, hasError: number) {
        const cancel = module.currentProgressCallback?.({ currentOffset, hasError: hasError !== 0 }) as unknown;
        return Number(!!cancel);
      },
      tree_sitter_query_progress_callback(currentOffset: number) {
        const cancel = module.currentQueryProgressCallback?.({ currentOffset }) as unknown;
        return Number(!!cancel);
      },
    },
  };

  const source = await runtimeBytes(options);
  const instance = source instanceof WebAssembly.Module
    ? await WebAssembly.instantiate(source, imports)
    : (await WebAssembly.instantiate(source as BufferSource, imports)).instance;
  runtime.exports = instance.exports as unknown as Exports;
  const exports = runtime.exports;
  exports._initialize();

  // Links a grammar built as a dylink side module: its data goes in a block of the
  // runtime's heap, its functions in the runtime's table, and its libc imports
  // resolve to the runtime's exports.
  function link(wasmModule: WebAssembly.Module): SideExports {
    const info = dylinkInfo(wasmModule);
    const align = Math.max(2 ** info.memoryAlign, 16);
    const memoryBase = info.memorySize ? Math.ceil(exports.malloc(info.memorySize + align) / align) * align : 0;
    if (info.memorySize) bytes().fill(0, memoryBase, memoryBase + info.memorySize);
    const table = exports.__indirect_function_table;
    const tableBase = table.grow(info.tableSize);

    const env: Record<string, WebAssembly.ImportValue> = {
      memory: exports.memory,
      __indirect_function_table: table,
      __stack_pointer: exports.__stack_pointer,
      __memory_base: new WebAssembly.Global({ value: 'i32', mutable: false }, memoryBase),
      __table_base: new WebAssembly.Global({ value: 'i32', mutable: false }, tableBase),
    };
    // Addresses the module takes through its GOT, filled in once it has been instantiated.
    const memoryGot = new Map<string, WebAssembly.Global>();
    const functionGot = new Map<string, WebAssembly.Global>();
    const got = { 'GOT.mem': {} as Record<string, WebAssembly.Global>, 'GOT.func': {} as Record<string, WebAssembly.Global> };
    for (const { module: from, name, kind } of WebAssembly.Module.imports(wasmModule)) {
      if (from === 'env') {
        if (name in env) continue;
        if (kind !== 'function' || typeof exports[name] !== 'function') {
          throw new Error(`Language module imports ${name}, which the runtime does not provide`);
        }
        env[name] = exports[name];
      } else if (from === 'GOT.mem' || from === 'GOT.func') {
        const slot = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
        got[from][name] = slot;
        (from === 'GOT.mem' ? memoryGot : functionGot).set(name, slot);
      } else {
        throw new Error(`Language module imports ${from}.${name}, which the runtime does not provide`);
      }
    }

    const side = new WebAssembly.Instance(wasmModule, { env, ...got }).exports as SideExports;
    for (const [name, slot] of memoryGot) {
      const symbol = side[name];
      if (!(symbol instanceof WebAssembly.Global)) throw new Error(`Language module has no data symbol ${name}`);
      slot.value = memoryBase + (symbol.value as number);
    }
    for (const [name, slot] of functionGot) {
      const fn = side[name] ?? exports[name];
      if (typeof fn !== 'function') throw new Error(`Language module has no function ${name}`);
      const index = table.grow(1);
      table.set(index, fn);
      slot.value = index;
    }
    (side.__wasm_apply_data_relocs as (() => void) | undefined)?.();
    (side.__wasm_call_ctors as (() => void) | undefined)?.();
    return side;
  }

  function loadWebAssemblyModule(binary: Uint8Array | WebAssembly.Module, flags: { loadAsync: boolean }) {
    if (!flags.loadAsync) {
      return link(binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary as BufferSource));
    }
    const compiled = binary instanceof WebAssembly.Module ? Promise.resolve(binary) : WebAssembly.compile(binary as BufferSource);
    return compiled.then(link);
  }

  Object.assign(module, {
    getValue,
    setValue,
    UTF8ToString,
    AsciiToString,
    lengthBytesUTF8,
    stringToUTF8,
    stringToUTF16,
    loadWebAssemblyModule,
  });
  // Views over the current memory, which growth replaces.
  Object.defineProperty(module, 'HEAPU8', { get: bytes });
  for (const [name, value] of Object.entries(exports)) {
    if (typeof value === 'function') (module as Record<string, unknown>)[`_${name}`] = value;
  }
  return module;
}
