import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { observeRuntimeAllocations } from './native-markdown-observer.ts';
import { Runtime, foreign, invoke, release } from '../src/native/runtime.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { MarkdownResolver } from '../src/native/markdown-resolver.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { baselineScopes } from '../src/baselines/run.ts';
import { parseResult } from '../src/validate.ts';
import { digest } from '../src/native/component-inputs.ts';

const allocations = observeRuntimeAllocations();
const runtime = await Runtime.load();
const observer = await runtime.extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url))));
invoke(observer, 'scope_test_install');
const proto = foreign(foreign(runtime.binding.Parser).prototype), originalParse = proto.parse;
const resolverCall = MarkdownResolver.prototype.call;
let parses = 0, sets = 0;
Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: function (this: unknown, ...args: unknown[]) {
  parses++;
  if (typeof originalParse !== 'function') throw new Error('Missing Parser.parse');
  return Reflect.apply(originalParse, this, args);
} });
Object.defineProperty(MarkdownResolver.prototype, 'call', { configurable: true, writable: true, value: function (this: MarkdownResolver, name: string, args: readonly number[] = []) {
  if (name === 'tsmd_set_text') sets++;
  return resolverCall.call(this, name, args);
} });

try {
  await baselineScopes('baseline:captures', 'typescript', 'const a = 1');
  const baselineParses = parses;
  assert.equal(baselineParses, 1);
  const ts = await loadLanguagePack('typescript'), json = await loadLanguagePack('json');
  const packs = new Map([['typescript', ts], ['json', json]]);
  const source = await readFile(new URL('../fixtures/original/markdown/fences.md', import.meta.url), 'utf8');
  parses = 0; sets = 0;
  const cold = await MarkdownPilotDocument.open(source);
  assert.equal(parses, 2); assert.equal(sets, 1);
  const before = parses, coldResult = await cold.document(packs, 'product');
  assert.equal(parses, before);
  parseResult(coldResult, source);
  const hash = digest(new TextEncoder().encode(JSON.stringify(coldResult)));
  cold.dispose();
  const warm = await MarkdownPilotDocument.open(source);
  assert.deepEqual(await warm.document(packs, 'product'), coldResult);
  warm.dispose();
  const baseline = allocations.live();
  const resolver = await MarkdownResolver.open(source);
  assert(allocations.live() > baseline, 'resolver allocator positive control did not arm');
  resolver.records(true); resolver.records(false); resolver.dispose();
  assert.equal(allocations.live(), baseline);
  const buffer = runtime.construct('TextBuffer', ['const x = 1']);
  assert(allocations.live() > baseline, 'TextBuffer allocator positive control did not arm');
  release(buffer); assert.equal(allocations.live(), baseline);
  await parserControls(baseline);
  const child = await MarkdownPilotDocument.open(source);
  assert(allocations.live() > baseline, 'child allocator positive control did not arm');
  child.dispose(); assert.equal(allocations.live(), baseline);
  await repeatOwners(source, packs, baseline);
  await failureControls(source, baseline);
  ts.dispose(); json.dispose();
  process.stdout.write(JSON.stringify({ hash, setText: 1, childParses: 2, scopeParses: 0, baselineParses, retainedResolver: true, retainedParser: true, retainedTree: true, retainedChild: true, released: true }) + '\n');
} finally {
  Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: originalParse });
  Object.defineProperty(MarkdownResolver.prototype, 'call', { configurable: true, writable: true, value: resolverCall });
  invoke(observer, 'scope_test_reset'); allocations.restore();
}

async function parserControls(baseline: number): Promise<void> {
  const parser = runtime.construct('Parser');
  assert(allocations.live() > baseline, 'Parser allocator positive control did not arm');
  const buffer = runtime.construct('TextBuffer', ['const x = 1']);
  let tree: ReturnType<typeof foreign> | undefined;
  try {
    invoke(parser, 'setLanguage', [await runtime.language('typescript')]);
    const retained = allocations.live();
    tree = foreign(invoke(parser, 'parse', [buffer]));
    assert(allocations.live() > retained, 'Tree allocator positive control did not arm');
  } finally {
    try { if (tree) release(tree); } finally { release(parser); release(buffer); }
  }
  assert.equal(allocations.live(), baseline);
}

async function repeatOwners(source: string, packs: Parameters<MarkdownPilotDocument['document']>[0], baseline: number): Promise<void> {
  for (let index = 0; index < 30; index++) {
    const owner = await MarkdownPilotDocument.open(source);
    try { await owner.document(packs, 'product'); } finally { owner.dispose(); }
    assert.equal(allocations.live(), baseline);
  }
}
async function failureControls(source: string, baseline: number): Promise<void> {
  for (const method of ['setLanguage', 'parse']) {
    const original = proto[method];
    let count = 0;
    Object.defineProperty(proto, method, { configurable: true, writable: true, value: function (this: unknown, ...args: unknown[]) {
      if (++count === 2) throw new Error(`injected second child ${method}`);
      if (typeof original !== 'function') throw new Error(`Missing Parser.${method}`);
      return Reflect.apply(original, this, args);
    } });
    try { await assert.rejects(MarkdownPilotDocument.open(source), /injected second child/); }
    finally { Object.defineProperty(proto, method, { configurable: true, writable: true, value: original }); }
    assert.equal(allocations.live(), baseline);
  }
  await nullParseControl(source, baseline);
  await resolverFailureControls(source, baseline);
}

async function nullParseControl(source: string, baseline: number): Promise<void> {
  const original = proto.parse;
  Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: () => null });
  try { await assert.rejects(MarkdownPilotDocument.open(source), /no tree/); }
  finally { Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: original }); }
  assert.equal(allocations.live(), baseline);
}
async function resolverFailureControls(source: string, baseline: number): Promise<void> {
  const original = MarkdownResolver.prototype.call;
  for (const method of ['tsmd_set_text', 'tsmd_out']) {
    Object.defineProperty(MarkdownResolver.prototype, 'call', { configurable: true, writable: true, value: function (this: MarkdownResolver, name: string, args: readonly number[] = []) {
      if (name === method) throw new Error(`injected ${method}`);
      return original.call(this, name, args);
    } });
    try { await assert.rejects(MarkdownPilotDocument.open(source), /injected/); }
    finally { Object.defineProperty(MarkdownResolver.prototype, 'call', { configurable: true, writable: true, value: original }); }
    assert.equal(allocations.live(), baseline);
  }
}
