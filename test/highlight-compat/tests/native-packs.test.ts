import { describe, expect, it } from 'vitest';
import { loadLanguagePack } from '../src/native/packs.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeDocument, nativeScopes } from '../src/native/adapter.ts';
import { corpusInputs } from '../src/corpus.ts';
import { parseResult } from '../src/validate.ts';
import { Runtime, foreign } from '../src/native/runtime.ts';
import { baselineScopes } from '../src/baselines/run.ts';
import type { NativePack } from '../src/native/component.ts';
import type { CorpusInput } from '../src/corpus.ts';

async function checkInput(pack: NativePack, input: CorpusInput): Promise<void> {
  const owner = await PilotDocument.open(input.languageId, input.source);
  try {
    const result = await nativeDocument(pack, owner, 'product');
    expect(result.status, input.fixtureId).toBe('complete');
    expect(parseResult(JSON.parse(JSON.stringify(result)), input.source)).toEqual(result);
    expect(nativeScopes(pack, owner)).toEqual(nativeScopes(pack, owner));
  } finally { owner.dispose(); }
}
async function checkCorpus(languageId: string): Promise<void> {
  const pack = await loadLanguagePack(languageId);
  try {
    for (const input of corpusInputs().filter(input => input.languageId === languageId)) await checkInput(pack, input);
  } finally { pack.dispose(); }
}
async function checkNoParse(pack: NativePack, language: string, count: () => number): Promise<void> {
  const before = count();
  await baselineScopes('baseline:captures', language, 'const x = 1');
  expect(count() - before).toBe(1);
  const owner = await PilotDocument.open(language, 'const x = 1');
  try { const parsed = count(); expect(nativeScopes(pack, owner).status).toBe(0); expect(count()).toBe(parsed); }
  finally { owner.dispose(); }
}

describe('explicit native language variants', () => {
  it.each(['typescript', 'tsx'] as const)('loads %s and completes its unchanged corpus', checkCorpus);

  it('keeps JavaScript and JSX distinct and deferred', async () => {
    await expect(loadLanguagePack('javascript')).rejects.toThrow('distinct variant');
    await expect(loadLanguagePack('jsx')).rejects.toThrow('distinct variant');
  });
  it.each(['typescript', 'tsx'] as const)('adds zero scope parses for the actual %s pack after a positive baseline control', async language => {
    const runtime = await Runtime.load(), prototype = foreign(foreign(runtime.binding.Parser).prototype);
    const original = prototype.parse;
    let count = 0;
    Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: function (this: unknown, ...args: unknown[]) {
      count++;
      if (typeof original !== 'function') throw new Error('Missing Parser.parse');
      return Reflect.apply(original, this, args);
    } });
    const pack = await loadLanguagePack(language);
    try {
      await checkNoParse(pack, language, () => count);
    } finally {
      pack.dispose(); Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: original });
    }
  });
});
