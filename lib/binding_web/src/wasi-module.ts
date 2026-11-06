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
  free: (pointer: number) => void;
  _initialize: () => void;
  malloc: (size: number) => number;
  ts_query_delete?: (address: number) => void;
  ts_tree_delete?: (address: number) => void;
};

type SideExports = Record<string, unknown>;

interface QueryExecution {
  query: number;
  tree: number;
  failure: { error: unknown } | null;
}

const queryExecutions = new WeakMap<MainModule, QueryExecution>();

/** @internal */
export function withQueryCursor<T>(module: MainModule, query: number, tree: number, callback: MainModule['currentQueryProgressCallback'], action: () => T): T {
  if (queryExecutions.has(module)) throw new Error('A query is already running');
  if (!query) throw new Error('Cannot execute a deleted query');
  if (!tree) throw new Error('Cannot execute on a deleted tree');
  const previous = module.currentQueryProgressCallback;
  queryExecutions.set(module, { query, tree, failure: null });
  module.currentQueryProgressCallback = callback;
  try {
    return action();
  } finally {
    module.currentQueryProgressCallback = previous;
    queryExecutions.delete(module);
  }
}

/** @internal */
export function checkQueryProgress(module: MainModule): void {
  const failure = queryExecutions.get(module)?.failure;
  if (failure) throw failure.error;
}

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
const UTF16_CHUNK_SIZE = 4096;

function readLeb(bytes: Uint8Array, cursor: { at: number }): number {
  let result = 0;
  for (let shift = 0; shift <= 28; shift += 7) {
    if (cursor.at >= bytes.length) throw new Error('Truncated dylink.0 integer');
    const byte = bytes[cursor.at++];
    if (shift === 28 && byte > 15) throw new Error('dylink.0 integer overflow');
    result += (byte & 0x7f) * 2 ** shift;
    if (!(byte & 0x80)) return result;
  }
  throw new Error('dylink.0 integer overflow');
}

// The WASM_DYLINK_MEM_INFO subsection of a side module's `dylink.0` section.
function dylinkInfo(module: WebAssembly.Module) {
  const sections = WebAssembly.Module.customSections(module, 'dylink.0');
  if (sections.length === 0) throw new Error('Language module has no dylink.0 section');
  if (sections.length !== 1) throw new Error('Duplicate dylink.0 sections');
  let info: { memorySize: number; memoryAlign: number; tableSize: number; tableAlign: number } | undefined;
  const bytes = new Uint8Array(sections[0]);
  const cursor = { at: 0 };
  while (cursor.at < bytes.length) {
    const type = bytes[cursor.at++];
    const size = readLeb(bytes, cursor);
    const end = cursor.at + size;
    if (end > bytes.length) throw new Error('Truncated dylink.0 subsection');
    if (type === 1) {
      if (info) throw new Error('Duplicate dylink.0 memory info');
      const record = bytes.subarray(cursor.at, end);
      const position = { at: 0 };
      info = { memorySize: readLeb(record, position), memoryAlign: readLeb(record, position),
        tableSize: readLeb(record, position), tableAlign: readLeb(record, position) };
      if (position.at !== record.length) throw new Error('Invalid dylink.0 memory info size');
      if (info.memoryAlign > 31 || info.tableAlign > 31) throw new Error('Invalid dylink.0 alignment');
      if (info.memorySize + Math.max(16, 2 ** info.memoryAlign) - 1 > 0xffffffff) throw new Error('dylink.0 allocation size overflow');
    }
    cursor.at = end;
  }
  if (!info) throw new Error('Missing dylink.0 memory info');
  return info;
}

function sideImports(wasmModule: WebAssembly.Module, exports: Exports) {
  const env: Record<string, WebAssembly.ImportValue> = Object.create(null) as Record<string, WebAssembly.ImportValue>;
  Object.assign(env, { memory: exports.memory, __indirect_function_table: exports.__indirect_function_table, __stack_pointer: exports.__stack_pointer });
  const kinds: Record<string, WebAssembly.ImportExportKind> = { memory: 'memory', __indirect_function_table: 'table',
    __stack_pointer: 'global', __memory_base: 'global', __table_base: 'global' };
  const symbols = new Map(WebAssembly.Module.exports(wasmModule).map(symbol => [symbol.name, symbol.kind]));
  const memoryGot = new Map<string, WebAssembly.Global>();
  const functionGot = new Map<string, WebAssembly.Global>();
  const got: Record<'GOT.mem' | 'GOT.func', Record<string, WebAssembly.Global>> = {
    'GOT.mem': Object.create(null) as Record<string, WebAssembly.Global>,
    'GOT.func': Object.create(null) as Record<string, WebAssembly.Global>,
  };
  for (const { module: from, name, kind } of WebAssembly.Module.imports(wasmModule)) {
    if (from === 'env' && Object.hasOwn(kinds, name) && kinds[name] === kind) continue;
    const runtimeSymbol = Object.hasOwn(exports, name) ? exports[name] : undefined;
    if (from === 'env' && !Object.hasOwn(kinds, name) && kind === 'function' && typeof runtimeSymbol === 'function') {
      env[name] = runtimeSymbol;
      continue;
    }
    if ((from !== 'GOT.mem' && from !== 'GOT.func') || kind !== 'global') throw new Error(`Language module imports unsupported ${from}.${name} (${kind})`);
    const expected = from === 'GOT.mem' ? 'global' : 'function';
    const symbol = symbols.get(name);
    if (symbol !== expected && !(from === 'GOT.func' && symbol === undefined && typeof runtimeSymbol === 'function')) throw new Error(`Language module has no ${expected} symbol ${name}`);
    const slots = from === 'GOT.mem' ? memoryGot : functionGot;
    if (slots.has(name)) continue;
    const slot = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
    got[from][name] = slot;
    slots.set(name, slot);
  }
  for (const name of ['__wasm_apply_data_relocs', '__wasm_call_ctors']) {
    if (symbols.has(name) && symbols.get(name) !== 'function') throw new Error(`Invalid language module function ${name}`);
  }
  return { env, got, memoryGot, functionGot };
}

interface TableReservation { start: number; end: number; base: number }

export function isFileInput(input: string | URL): boolean {
  if (typeof input !== 'string') return input.protocol === 'file:';
  return /^[a-z]:/i.test(input) || !/^[a-z][a-z\d+.-]*:/i.test(input);
}

async function runtimeBytes(options: ModuleOptions): Promise<ArrayBufferView | ArrayBuffer | WebAssembly.Module> {
  if (options.wasmBinary) return options.wasmBinary;
  const base = new URL('.', import.meta.url).href;
  const location = options.locateFile?.('web-tree-sitter.wasm', base) ?? new URL('web-tree-sitter.wasm', import.meta.url).href;
  // Native paths preserve URL punctuation and resolve relative to Node's working directory.
  if (typeof process !== 'undefined' && process.versions.node && isFileInput(location)) {
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

  const utf16Scratch = new Uint16Array(UTF16_CHUNK_SIZE);

  // Typed-array reads, as Emscripten's getValue does: the bindings only pass aligned
  // addresses, and these calls are the hot path of query and node unmarshaling.
  const getValue = (ptr: number, type = 'i8'): number => {
    // Wasm32 pointers can arrive as signed i32 values when memory exceeds 2 GiB.
    refreshHeap();
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
    refreshHeap();
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
    refreshHeap();
    ptr >>>= 0;
    const limit = maxBytesToRead === undefined ? heapU8.length : Math.min(heapU8.length, ptr + maxBytesToRead);
    let end = ptr;
    if (ignoreNul) end = limit;
    else while (end < limit && heapU8[end]) end++;
    // Encoding APIs reject resizable-backed inputs in browsers. slice owns fixed storage.
    return utf8Decoder.decode(heapU8.slice(ptr, end));
  };
  const AsciiToString = (ptr: number): string => {
    refreshHeap();
    ptr >>>= 0;
    let result = '';
    for (let at = ptr; heapU8[at]; at++) result += String.fromCharCode(heapU8[at]);
    return result;
  };
  const lengthBytesUTF8 = (str: string): number => utf8Encoder.encode(str).length;
  const stringToUTF8 = (str: string, outPtr: number, maxBytesToWrite: number): number => {
    if (maxBytesToWrite <= 0) return 0;
    refreshHeap();
    outPtr >>>= 0;
    const target = heapU8.subarray(outPtr, outPtr + maxBytesToWrite - 1);
    const scratch = new Uint8Array(target.length);
    const { written } = utf8Encoder.encodeInto(str, scratch);
    target.set(scratch.subarray(0, written));
    heapU8[outPtr + written] = 0;
    return written;
  };
  const stringToUTF16 = (str: string, outPtr: number, maxBytesToWrite = 0x7fffffff): number => {
    if (maxBytesToWrite < 2) return 0;
    refreshHeap();
    outPtr >>>= 0;
    const length = Math.min(str.length, Math.floor((maxBytesToWrite - 2) / 2));
    // Populate fixed storage before bulk copying to the resizable heap. No user code runs
    // while this scratch is live; parse callbacks (including nested calls) finish first.
    for (let at = 0; at < length; at += UTF16_CHUNK_SIZE) {
      const count = Math.min(length - at, UTF16_CHUNK_SIZE);
      for (let i = 0; i < count; i++) utf16Scratch[i] = str.charCodeAt(at + i);
      heap16.set(utf16Scratch.subarray(0, count), (outPtr >>> 1) + at);
    }
    heap16[(outPtr >>> 1) + length] = 0;
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
        const execution = queryExecutions.get(module);
        if (execution?.failure) return 1;
        try {
          const cancel = module.currentQueryProgressCallback?.({ currentOffset }) as unknown;
          return Number(!!cancel);
        } catch (error) {
          if (execution) execution.failure = { error };
          return 1;
        }
      },
    },
  };

  const source = await runtimeBytes(options);
  const compiled = source instanceof WebAssembly.Module ? source : await WebAssembly.compile(source as BufferSource);
  const instance = await WebAssembly.instantiate(compiled, { ...imports, wasi_snapshot_preview1: wasiImports(compiled) });
  const exports = instance.exports as unknown as Exports;
  let heapBuffer = typeof exports.memory.toResizableBuffer === 'function'
    ? exports.memory.toResizableBuffer() : exports.memory.buffer;
  const resizable = heapBuffer.resizable;
  let heap = new DataView(heapBuffer);
  let heap8 = new Int8Array(heapBuffer);
  let heapU8 = new Uint8Array(heapBuffer);
  let heap16 = new Int16Array(heapBuffer);
  let heap32 = new Int32Array(heapBuffer);

  function refreshHeap() {
    if (resizable || heapBuffer === exports.memory.buffer) return;
    heapBuffer = exports.memory.buffer;
    heap = new DataView(heapBuffer);
    heap8 = new Int8Array(heapBuffer);
    heapU8 = new Uint8Array(heapBuffer);
    heap16 = new Int16Array(heapBuffer);
    heap32 = new Int32Array(heapBuffer);
  }
  exports._initialize();

  // Failed links return cleared ranges to this runtime. Capacity cannot shrink.
  const freeTableRanges: { start: number; end: number }[] = [];

  function planTable(size: number, alignment: number) {
    const table = exports.__indirect_function_table;
    const available = freeTableRanges.findIndex(range => Math.ceil(range.start / alignment) * alignment + size <= range.end);
    const start = available === -1 ? table.length : freeTableRanges[available].start;
    const base = Math.ceil(start / alignment) * alignment;
    const end = base + size;
    if (end > 0xffffffff) throw new Error('dylink.0 table offset overflow');
    return { start, end: size === 0 ? start : end, base, available };
  }

  function reserveTable(reservation: ReturnType<typeof planTable>): TableReservation {
    const { start, end, available } = reservation;
    if (start === end) return reservation;
    if (available === -1) exports.__indirect_function_table.grow(end - start);
    else {
      const range = freeTableRanges[available];
      freeTableRanges.splice(available, 1);
      if (range.end > end) freeTableRanges.splice(available, 0, { start: end, end: range.end });
    }
    return reservation;
  }

  function releaseTable(reservation: TableReservation) {
    const { start, end } = reservation;
    if (start === end) return;
    for (let index = start; index < end; index++) exports.__indirect_function_table.set(index, null);
    freeTableRanges.push({ start, end });
    freeTableRanges.sort((a, b) => a.start - b.start);
    for (let index = 1; index < freeTableRanges.length;) {
      const previous = freeTableRanges[index - 1];
      const current = freeTableRanges[index];
      if (previous.end !== current.start) { index++; continue; }
      previous.end = current.end;
      freeTableRanges.splice(index, 1);
    }
  }

  function relocate(side: SideExports, memoryBase: number, tableBase: number, imports: ReturnType<typeof sideImports>) {
    for (const [name, slot] of imports.memoryGot) {
      const symbol = side[name];
      if (!(symbol instanceof WebAssembly.Global) || typeof symbol.value !== 'number') throw new Error(`Language module has no data symbol ${name}`);
      const address = memoryBase + (symbol.value >>> 0);
      if (address > 0xffffffff) throw new Error('dylink.0 data symbol offset overflow');
      slot.value = address;
    }
    let index = tableBase;
    for (const [name, slot] of imports.functionGot) {
      const fn = side[name] ?? exports[name];
      if (typeof fn !== 'function') throw new Error(`Language module has no function ${name}`);
      exports.__indirect_function_table.set(index, fn);
      slot.value = index++;
    }
    (side.__wasm_apply_data_relocs as (() => void) | undefined)?.();
    (side.__wasm_call_ctors as (() => void) | undefined)?.();
  }

  function rollbackLink(allocation: number, reservation: TableReservation | undefined, stack: number, imports: ReturnType<typeof sideImports>) {
    try {
      for (const slot of imports.memoryGot.values()) slot.value = 0;
      for (const slot of imports.functionGot.values()) slot.value = 0;
      if (reservation) releaseTable(reservation);
    } finally {
      try { if (allocation) exports.free(allocation); }
      finally { exports.__stack_pointer.value = stack; }
    }
  }

  // Successful modules keep their static data and table entries for the runtime's lifetime.
  function link(wasmModule: WebAssembly.Module): SideExports {
    const info = dylinkInfo(wasmModule);
    const imports = sideImports(wasmModule, exports);
    const tableSize = info.tableSize + imports.functionGot.size;
    if (tableSize > 0xffffffff) throw new Error('dylink.0 table size overflow');
    const tablePlan = planTable(tableSize, 2 ** info.tableAlign);
    const alignment = Math.max(2 ** info.memoryAlign, 16);
    const stack = exports.__stack_pointer.value as number;
    let allocation = 0;
    let reservation: TableReservation | undefined;
    try {
      let memoryBase = 0;
      if (info.memorySize) {
        const size = info.memorySize + alignment - 1;
        allocation = exports.malloc(size) >>> 0;
        if (!allocation) throw new Error('Language module allocation failed');
        memoryBase = Math.ceil(allocation / alignment) * alignment;
        refreshHeap();
        if (allocation + size > 2 ** 32 || memoryBase + info.memorySize > heapU8.length) throw new Error('Language module allocation overflow or out of bounds');
        heapU8.fill(0, memoryBase, memoryBase + info.memorySize);
      }
      reservation = reserveTable(tablePlan);
      imports.env.__memory_base = new WebAssembly.Global({ value: 'i32', mutable: false }, memoryBase);
      imports.env.__table_base = new WebAssembly.Global({ value: 'i32', mutable: false }, reservation.base);
      const side = new WebAssembly.Instance(wasmModule, { env: imports.env, ...imports.got }).exports as SideExports;
      relocate(side, memoryBase, reservation.base + info.tableSize, imports);
      return side;
    } catch (error) {
      // Restore only loader-owned resources and the known shared stack, not arbitrary module writes.
      try { rollbackLink(allocation, reservation, stack, imports); }
      catch {
        // A cleanup exception must not replace the original module failure.
      }
      throw error;
    }
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
  Object.defineProperty(module, 'HEAPU8', { get() {
    refreshHeap();
    return heapU8;
  } });
  for (const [name, value] of Object.entries(exports)) {
    if (typeof value === 'function') (module as Record<string, unknown>)[`_${name}`] = value;
  }
  const deleteQuery = exports.ts_query_delete;
  if (deleteQuery) {
    module._ts_query_delete = address => {
      if (queryExecutions.get(module)?.query === address) throw new Error('Cannot delete an active query');
      deleteQuery(address);
    };
  }
  const deleteTree = exports.ts_tree_delete;
  if (deleteTree) {
    module._ts_tree_delete = address => {
      if (queryExecutions.get(module)?.tree === address) throw new Error('Cannot delete an active tree');
      deleteTree(address);
    };
  }
  return module;
}
