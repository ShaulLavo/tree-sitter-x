import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import path from 'path';

export function wasmU32(value: number): number[] {
  const bytes: number[] = [];
  do {
    const byte = value % 128;
    value = Math.floor(value / 128);
    bytes.push(byte | (value ? 128 : 0));
  } while (value);
  return bytes;
}

function wasmName(value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value));
  return wasmU32(bytes.length).concat(bytes);
}

function wasmSection(id: number, bytes: number[]): number[] {
  return [id].concat(wasmU32(bytes.length), bytes);
}

export function memoryInfo(memorySize = 64, memoryAlign = 4, tableSize = 1, tableAlign = 0): number[] {
  const bytes = wasmU32(memorySize).concat(wasmU32(memoryAlign), wasmU32(tableSize), wasmU32(tableAlign));
  return [1].concat(wasmU32(bytes.length), bytes);
}

interface SideFixtureOptions {
  metadata?: number[][];
  memorySize?: number;
  memoryAlign?: number;
  tableSize?: number;
  tableAlign?: number;
  extraImport?: { module: string; name: string; kind: 'function' | 'global' | 'memory' | 'table' };
  functionGot?: string;
  memoryGot?: string;
  trap?: 'start' | 'relocation' | 'constructor';
  callMalloc?: boolean;
}

/** Real side modules with active data/elements and executable failure paths. */
export function sideFixture(options: SideFixtureOptions = {}): Uint8Array {
  const metadata = options.metadata ?? [memoryInfo(options.memorySize, options.memoryAlign, options.tableSize, options.tableAlign)];
  const sections = metadata.map(bytes => wasmSection(0, wasmName('dylink.0').concat(bytes)));
  const imports = [
    wasmName('env').concat(wasmName('memory'), [2, 0, 0]),
    wasmName('env').concat(wasmName('__indirect_function_table'), [1, 0x70, 0, 0]),
    wasmName('env').concat(wasmName('__stack_pointer'), [3, 0x7f, 1]),
    wasmName('env').concat(wasmName('__memory_base'), [3, 0x7f, 0]),
    wasmName('env').concat(wasmName('__table_base'), [3, 0x7f, 0]),
  ];
  if (options.functionGot) imports.push(wasmName('GOT.func').concat(wasmName(options.functionGot), [3, 0x7f, 1]));
  if (options.memoryGot) imports.push(wasmName('GOT.mem').concat(wasmName(options.memoryGot), [3, 0x7f, 1]));
  if (options.callMalloc) imports.push(wasmName('env').concat(wasmName('malloc'), [0, 2]));
  if (options.extraImport) {
    const { module, name, kind } = options.extraImport;
    const descriptor = { function: [0, 1], global: [3, 0x7f, 1], memory: [2, 0, 0], table: [1, 0x70, 0, 0] }[kind];
    imports.push(wasmName(module).concat(wasmName(name), descriptor));
  }
  const functionOffset = Number(options.callMalloc) + Number(options.extraImport?.kind === 'function');
  const exports = [
    wasmName('value').concat([0], wasmU32(functionOffset)),
    wasmName('base').concat([0], wasmU32(functionOffset + 2)),
    wasmName('table_base').concat([0], wasmU32(functionOffset + 3)),
  ];
  if (options.memoryGot === 'data') exports.push(wasmName('data').concat([3, 3 + Number(!!options.functionGot) + 1 + Number(options.extraImport?.kind === 'global')]));
  if (options.trap === 'relocation') exports.push(wasmName('__wasm_apply_data_relocs').concat([0], wasmU32(functionOffset + 1)));
  if (options.trap === 'constructor' || options.callMalloc) exports.push(wasmName('__wasm_call_ctors').concat([0], wasmU32(functionOffset + 1)));
  const phase = options.trap ? [0x41, 32, 0x24, 0, 0] : [];
  if (options.callMalloc) phase.push(0x41, 1, 0x10, 0, 0x1a);
  const bodies = [[0x41, 42], phase, [0x23, 1], [0x23, 2]].map(code => {
    const body = [0].concat(code, [0x0b]);
    return wasmU32(body.length).concat(body);
  });
  const standard = [
    wasmSection(1, [3, 0x60, 0, 1, 0x7f, 0x60, 0, 0, 0x60, 1, 0x7f, 1, 0x7f]),
    wasmSection(2, wasmU32(imports.length).concat(imports.flat())),
    wasmSection(3, [4, 0, 1, 0, 0]),
    wasmSection(6, [1, 0x7f, 0, 0x41, 0, 0x0b]),
    wasmSection(7, wasmU32(exports.length).concat(exports.flat())),
  ];
  if (options.trap === 'start') standard.push(wasmSection(8, wasmU32(functionOffset + 1)));
  if (options.tableSize !== 0) standard.push(wasmSection(9, [1, 0, 0x23, 2, 0x0b, 1].concat(wasmU32(functionOffset))));
  standard.push(wasmSection(10, [4].concat(bodies.flat())));
  if (options.memorySize !== 0) standard.push(wasmSection(11, [1, 0, 0x23, 1, 0x0b, 1, 99]));
  return Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0].concat(sections.flat(), standard.flat()));
}

export function buildFixture(name: string, reactor = false): Uint8Array {
  const cache = process.platform === 'win32'
    ? process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local')
    : process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache');
  const sdk = process.env.TREE_SITTER_WASI_SDK_PATH ?? process.env.WASI_SDK
    ?? path.join(cache, 'tree-sitter', 'wasi-sdk');
  const clang = path.join(sdk, 'bin', process.platform === 'win32' ? 'clang.exe' : 'clang');
  const directory = mkdtempSync(path.join(tmpdir(), 'ts-fixture-'));
  try {
    const output = path.join(directory, `${name}.wasm`);
    const flags = reactor
      ? ['-mexec-model=reactor', '-Wl,--export-memory', '-Wl,--max-memory=4294967296']
      : ['-fPIC', '-shared', '-nostdlib', '-Wl,--allow-undefined', '-Wl,--no-entry', '-Wl,--export=__wasm_call_ctors'];
    execFileSync(clang, ['--target=wasm32-wasip1', '-O2', '-fvisibility=hidden'].concat(flags, [
      '-I', path.join(process.cwd(), '../include'),
      path.join(process.cwd(), `test/fixtures/${name}.c`), '-o', output,
    ]));
    return readFileSync(output);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
