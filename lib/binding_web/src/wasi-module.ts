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

// wasi_snapshot_preview1 imports of the runtime. It has no files, clock or entropy:
// file calls report a bad descriptor, anything else is unsupported, and exit traps.
const ERRNO_BADF = 8;
const ERRNO_NOSYS = 52;
function wasiImports(module: WebAssembly.Module): Record<string, () => number> {
  const wasi: Record<string, () => number> = {};
  for (const { module: from, name } of WebAssembly.Module.imports(module)) {
    if (from !== 'wasi_snapshot_preview1') continue;
    if (name === 'proc_exit') {
      wasi[name] = () => { throw new Error('tree-sitter runtime exited'); };
    } else {
      wasi[name] = name.startsWith('fd_') ? () => ERRNO_BADF : () => ERRNO_NOSYS;
    }
  }
  return wasi;
}

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
  // Native paths preserve URL punctuation and resolve relative to Node's working directory.
  const isPath = /^[a-z]:/i.test(location) || !/^[a-z][a-z\d+.-]*:/i.test(location);
  if (typeof process !== 'undefined' && process.versions.node && isPath) {
    const { readFile } = await import('fs/promises');
    return readFile(location);
  }
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
  let heap8 = new Int8Array(0);
  let heapU8 = new Uint8Array(0);
  let heap16 = new Int16Array(0);
  let heap32 = new Int32Array(0);
  // Memory can grow during any call into the runtime, detaching earlier views.
  const refresh = () => {
    const buffer = runtime.exports.memory.buffer;
    if (buffer === heapBuffer) return;
    heapBuffer = buffer;
    heap = new DataView(buffer);
    heap8 = new Int8Array(buffer);
    heapU8 = new Uint8Array(buffer);
    heap16 = new Int16Array(buffer);
    heap32 = new Int32Array(buffer);
  };
  const bytes = () => {
    refresh();
    return heapU8;
  };

  // Typed-array reads, as Emscripten's getValue does: the bindings only pass aligned
  // addresses, and these calls are the hot path of query and node unmarshaling.
  const getValue = (ptr: number, type = 'i8'): number => {
    refresh();
    // Wasm32 pointers can arrive as signed i32 values when memory exceeds 2 GiB.
    ptr >>>= 0;
    switch (type) {
      case 'i32': case '*': return heap32[ptr >>> 2];
      case 'i16': return heap16[ptr >>> 1];
      case 'i1':
      case 'i8': return heap8[ptr];
      case 'i64': return Number(heap.getBigInt64(ptr, true));
      case 'float': return heap.getFloat32(ptr, true);
      case 'double': return heap.getFloat64(ptr, true);
      default: throw new Error(`getValue: invalid type ${type}`);
    }
  };
  const setValue = (ptr: number, value: number, type = 'i8'): void => {
    refresh();
    ptr >>>= 0;
    switch (type) {
      case 'i32': case '*': heap32[ptr >>> 2] = value; return;
      case 'i16': heap16[ptr >>> 1] = value; return;
      case 'i1':
      case 'i8': heap8[ptr] = value; return;
      case 'i64': heap.setBigInt64(ptr, BigInt(value), true); return;
      case 'float': heap.setFloat32(ptr, value, true); return;
      case 'double': heap.setFloat64(ptr, value, true); return;
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
    const length = Math.min(str.length, (maxBytesToWrite - 2) >> 1);
    // wasm32 is little-endian, like every host that runs it, so a Uint16Array writes UTF-16LE.
    const units = new Uint16Array(bytes().buffer, outPtr, length + 1);
    for (let i = 0; i < length; i++) units[i] = str.charCodeAt(i);
    units[length] = 0;
    return 2 * length;
  };

  const imports = {
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
  const compiled = source instanceof WebAssembly.Module ? source : await WebAssembly.compile(source as BufferSource);
  const instance = await WebAssembly.instantiate(compiled, { ...imports, wasi_snapshot_preview1: wasiImports(compiled) });
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
