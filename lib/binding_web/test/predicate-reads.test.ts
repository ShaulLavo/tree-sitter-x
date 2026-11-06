import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Language, Parser, Query, type Tree } from '../src';
import { C } from '../src/constants';
import { TRANSFER_BUFFER } from '../src/parser';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import path from 'path';
import helper from './helper';

let JavaScript: Language;
const dispose: (() => void)[] = [];

beforeAll(async () => {
  ({ JavaScript } = await helper);
});
afterEach(() => {
  for (const release of dispose.splice(0).reverse()) release();
});

function parse(source: string, chunkLength = Infinity) {
  const reads: { start: number; end: number | undefined; units: number }[] = [];
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  dispose.push(() => { parser.delete(); });
  const tree = parser.parse((start, _point, end?: number) => {
    const text = source.slice(start, Math.min(end ?? source.length, start + chunkLength));
    reads.push({ start, end, units: text.length });
    return text;
  })!;
  dispose.push(() => { tree.delete(); });
  reads.length = 0;
  return { tree, reads };
}

function query(source: string) {
  const result = new Query(JavaScript, source);
  dispose.push(() => { result.delete(); });
  return result;
}

function identifier(tree: Tree) {
  return query('(identifier) @name').captures(tree.rootNode)[0].node;
}

describe('bounded predicate source reads', () => {
  it.each([Infinity, 2])('requests only the node range with chunk size %s', (chunkLength) => {
    const { tree, reads } = parse('let alpha = 123456789;', chunkLength);
    const node = identifier(tree);
    expect(node.text).toBe('alpha');
    expect(reads[0]).toEqual({ start: node.startIndex, end: node.endIndex, units: Math.min(5, chunkLength) });
    expect(reads.reduce((sum, read) => sum + read.units, 0)).toBe(5);
    expect(reads.every((read) => read.end === node.endIndex)).toBe(true);
  });

  it('preserves exact Unicode node text', () => {
    const { tree, reads } = parse('const 名前 = "🎉";');
    const node = identifier(tree);
    expect(node.text).toBe('名前');
    expect(reads).toEqual([{ start: node.startIndex, end: node.endIndex, units: 2 }]);
  });
});

describe('query-local predicate text reuse', () => {
  it.each(['matches', 'captures'] as const)('reads each node once during %s and releases the cache after the call', (method) => {
    const { tree, reads } = parse('let alpha = 123;');
    const predicates = query(`
      ((identifier) @equal (#eq? @equal "alpha"))
      ((identifier) @regex (#match? @regex "^a"))
      ((identifier) @member (#any-of? @member "alpha"))
    `);
    expect(predicates[method](tree.rootNode)).toHaveLength(3);
    expect(reads).toHaveLength(1);
    expect(reads[0].units).toBe(5);
    expect(predicates[method](tree.rootNode)).toHaveLength(3);
    expect(reads).toHaveLength(2);
    const other = parse('let beta = 123;');
    expect(predicates[method](other.tree.rootNode)).toHaveLength(0);
    expect(other.reads).toHaveLength(1);
    expect(other.reads[0].units).toBe(4);
  });
});

describe('query failure ownership', () => {
  it('transfers a successful native query to exactly one explicit deletion', () => {
    const create = vi.spyOn(C, '_ts_query_new');
    const destroy = vi.spyOn(C, '_ts_query_delete');
    try {
      const q = new Query(JavaScript, '(identifier) @name');
      q.delete();
      expect(destroy).toHaveBeenCalledExactlyOnceWith(create.mock.results[0].value);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each([
    '((identifier) @name (#eq? @name))',
    '((identifier) @name (#match? @name "["))',
  ])('releases construction resources for %s', source => {
    const malloc = vi.spyOn(C, '_malloc');
    const free = vi.spyOn(C, '_free');
    const create = vi.spyOn(C, '_ts_query_new');
    const destroy = vi.spyOn(C, '_ts_query_delete');
    try {
      expect(() => new Query(JavaScript, source)).toThrow();
      expect(free).toHaveBeenCalledExactlyOnceWith(malloc.mock.results[0].value);
      expect(destroy).toHaveBeenCalledExactlyOnceWith(create.mock.results[0].value);
    } finally {
      vi.restoreAllMocks();
    }
    const { tree } = parse('alpha;');
    expect(query('(identifier) @name').matches(tree.rootNode)).toHaveLength(1);
  });

  it.each(['matches', 'captures', 'captureRanges'] as const)('restores the previous callback after %s', method => {
    const { tree } = parse('alpha;');
    const q = query('(identifier) @name');
    const previous = () => { throw new Error('previous callback must stay dormant'); };
    C.currentQueryProgressCallback = previous;
    try {
      expect(q[method](tree.rootNode)).toHaveLength(1);
      expect(C.currentQueryProgressCallback).toBe(previous);
    } finally {
      C.currentQueryProgressCallback = null;
    }
  });

  it.each(['matches', 'captures', 'captureRanges'] as const)('cleans up a predicate read failure in %s', method => {
    const { tree } = parse('alpha;');
    const q = query('((identifier) @name (#eq? @name "alpha"))');
    const failure = new Error('predicate read failed');
    const read = tree.textCallback;
    const previous = () => undefined;
    C.currentQueryProgressCallback = previous;
    tree.textCallback = () => { throw failure; };
    const free = vi.spyOn(C, '_free');
    try {
      expect(() => q[method](tree.rootNode)).toThrow(failure);
      expect(free).toHaveBeenCalledTimes(1);
      expect(C.currentQueryProgressCallback).toBe(previous);
    } finally {
      free.mockRestore();
      tree.textCallback = read;
      C.currentQueryProgressCallback = null;
    }
    expect(q[method](tree.rootNode)).toHaveLength(1);
  });

  it.each(['matches', 'captures', 'captureRanges'] as const)('rejects deleted query and tree handles in %s', method => {
    const { tree } = parse('alpha;');
    const node = tree.rootNode;
    const q = query('(identifier) @name');
    q.delete();
    expect(() => q[method](node)).toThrow('deleted query');
    const live = query('(identifier) @name');
    tree.delete();
    expect(() => live[method](node)).toThrow('deleted tree');
  });

  it.each(['matches', 'captures', 'captureRanges'] as const)('rejects scratch-cursor reentry during %s', method => {
    const { tree } = parse('alpha;\n'.repeat(5000));
    const node = tree.rootNode;
    const q = query('(identifier) @name');
    let calls = 0;
    expect(() => q[method](node, { progressCallback: () => {
      calls++;
      q.matches(node);
    } })).toThrow('query is already running');
    expect(calls).toBe(1);
    expect(q[method](node)).toHaveLength(5000);
  });

  it.each(['query', 'tree'] as const)('prevents deleting the active %s from a progress callback', target => {
    const { tree } = parse('alpha;\n'.repeat(5000));
    const node = tree.rootNode;
    const q = query('(identifier) @name');
    const unregister = vi.spyOn(FinalizationRegistry.prototype, 'unregister');
    try {
      expect(() => q.matches(node, { progressCallback: () => {
        (target === 'query' ? q : tree).delete();
      } })).toThrow(`Cannot delete an active ${target}`);
      expect(unregister).not.toHaveBeenCalled();
    } finally {
      unregister.mockRestore();
    }
    expect(q.matches(node)).toHaveLength(5000);
  });
});

async function allocationObserver() {
  const directory = mkdtempSync(path.join(tmpdir(), 'ts-query-ownership-'));
  const output = path.join(directory, 'observer.wasm');
  const cache = process.platform === 'win32'
    ? process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local')
    : process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache');
  const sdk = process.env.TREE_SITTER_WASI_SDK_PATH ?? process.env.WASI_SDK ?? path.join(cache, 'tree-sitter/wasi-sdk');
  const source = `
    #include <stdlib.h>
    #include <tree_sitter/api.h>
    static void *owned[16384];
    static unsigned count;
    static void forget(void *p) {
      for (unsigned i = 0; i < count; i++) {
        if (owned[i] != p) continue;
        owned[i] = owned[--count];
        return;
      }
    }
    __attribute__((export_name("allocate")))
    void *allocate(size_t n) {
      void *p = malloc(n);
      if (p) owned[count++] = p;
      return p;
    }
    static void *zero_allocate(size_t n, size_t size) {
      void *p = calloc(n, size);
      if (p) owned[count++] = p;
      return p;
    }
    static void *resize(void *old, size_t n) {
      void *p = realloc(old, n);
      if (!p && n) return p;
      forget(old);
      if (p) owned[count++] = p;
      return p;
    }
    __attribute__((export_name("release")))
    void release(void *p) { forget(p); free(p); }
    __attribute__((export_name("start")))
    void start(void) { ts_set_allocator(allocate, zero_allocate, resize, release); }
    __attribute__((export_name("stop")))
    void stop(void) { ts_set_allocator(NULL, NULL, NULL, NULL); }
    __attribute__((export_name("outstanding")))
    unsigned outstanding(void) { return count; }
  `;
  try {
    execFileSync(path.join(sdk, 'bin', process.platform === 'win32' ? 'clang.exe' : 'clang'), [
      '--target=wasm32-wasip1', '-O2', '-fPIC', '-shared', '-nostdlib',
      '-Wl,--allow-undefined', '-Wl,--no-entry', '-Wl,--export=__wasm_call_ctors',
      '-I', path.join(process.cwd(), '../include'), '-x', 'c', '-', '-o', output,
    ], { input: source });
    return await C.loadWebAssemblyModule(readFileSync(output), { loadAsync: true });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it('returns real native allocations to a warm baseline after repeated failures', async () => {
  const observer = await allocationObserver();
  const allocate = observer.allocate as (size: number) => number;
  const release = observer.release as (address: number) => void;
  const start = observer.start as () => void;
  const stop = observer.stop as () => void;
  const outstanding = observer.outstanding;
  const { tree } = parse('alpha;\n'.repeat(5000));
  const q = query('((identifier) @name (#eq? @name "alpha"))');
  const node = tree.rootNode;
  const malloc = Object.getOwnPropertyDescriptor(C, '_malloc')!;
  const free = Object.getOwnPropertyDescriptor(C, '_free')!;
  const failure = { message: 'same thrown object' };
  start();
  C._malloc = allocate;
  C._free = release;
  let baseline: number | undefined;
  try {
    assertNativeAllocationObserver(outstanding);
    warmQueries(q, tree);
    baseline = outstanding();
    for (let attempt = 0; attempt < 10; attempt++) {
      assertFailedQueries(q, tree, failure);
      expect(() => new Query(JavaScript, '((identifier) @x (#match? @x "["))')).toThrow();
      warmQueries(q, tree);
      expect(outstanding()).toBe(baseline);
    }
    expect(q.matches(node)).toHaveLength(5000);
  } finally {
    console.info(`Native live allocations: ${baseline} after warmup, ${outstanding()} at teardown`);
    Object.defineProperty(C, '_malloc', malloc);
    Object.defineProperty(C, '_free', free);
    stop();
  }
}, 30_000);

function assertNativeAllocationObserver(outstanding: () => number) {
  const baseline = outstanding();
  const probe = new Query(JavaScript, '(identifier) @probe');
  try {
    expect(outstanding()).toBeGreaterThan(baseline);
  } finally {
    probe.delete();
  }
  expect(outstanding()).toBe(baseline);
}

function warmQueries(q: Query, tree: Tree) {
  for (const method of ['matches', 'captures', 'captureRanges'] as const) q[method](tree.rootNode);
}

function assertFailedQueries(q: Query, tree: Tree, failure: unknown) {
  for (const method of ['matches', 'captures', 'captureRanges'] as const) {
    let calls = 0;
    let caught: unknown;
    let didThrow = false;
    let resultCount = 0;
    const previous = () => { throw new Error('stale progress callback'); };
    C.currentQueryProgressCallback = previous;
    let restored: unknown;
    const release = C._free.bind(C);
    const free = vi.spyOn(C, '_free').mockImplementation(address => {
      if (address) resultCount = C.getValue(TRANSFER_BUFFER, 'i32');
      release(address);
    });
    try {
      q[method](tree.rootNode, { progressCallback: () => {
        if (++calls === 2) throw failure;
      } });
    } catch (error) {
      caught = error;
      didThrow = true;
    } finally {
      restored = C.currentQueryProgressCallback;
      C.currentQueryProgressCallback = null;
      free.mockRestore();
    }
    expect(calls).toBe(2);
    expect(didThrow).toBe(true);
    expect(caught).toBe(failure);
    expect(resultCount).toBeGreaterThan(0);
    expect(restored).toBe(previous);
    assertPredicateFailure(q, tree, method, failure);
  }
}

function assertPredicateFailure(q: Query, tree: Tree, method: 'matches' | 'captures' | 'captureRanges', failure: unknown) {
  const read = tree.textCallback;
  let caught: unknown;
  let didThrow = false;
  tree.textCallback = () => { throw failure; };
  try {
    q[method](tree.rootNode);
  } catch (error) {
    caught = error;
    didThrow = true;
  } finally {
    tree.textCallback = read;
  }
  expect(didThrow).toBe(true);
  expect(caught).toBe(failure);
}
