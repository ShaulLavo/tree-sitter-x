import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import createModule from '../src/wasi-module';

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
