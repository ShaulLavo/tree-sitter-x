import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import path from 'path';

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
      : ['-fPIC', '-shared', '-nostdlib', '-Wl,--allow-undefined', '-Wl,--no-entry'];
    execFileSync(clang, ['--target=wasm32-wasip1', '-O2', '-fvisibility=hidden'].concat(flags, [
      '-I', path.join(process.cwd(), '../include'),
      path.join(process.cwd(), `test/fixtures/${name}.c`), '-o', output,
    ]));
    return readFileSync(output);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
