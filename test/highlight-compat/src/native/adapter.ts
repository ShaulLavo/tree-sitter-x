import { readFile } from 'node:fs/promises';
import { Component } from './component.ts';
import type { NativePack } from './component.ts';
import { foreign } from './runtime.ts';
import { u32 } from './decode.ts';
import type { PassResult, Window } from './decode.ts';
import { PilotDocument } from './owner.ts';
import { vendorAssets } from '../baselines/assets.ts';
import { paintScopes } from '../baselines/theme.ts';
import type { StyleReference } from '../baselines/theme.ts';
import { ResultBuilder } from '../build.ts';
import type { DocumentResult, IncompleteStatus } from '../schema.ts';

export async function loadJsonPack(): Promise<NativePack> {
  const root = new URL('../../../../lib/scope-compat/packs/json/', import.meta.url);
  const spec = foreign(JSON.parse(await readFile(new URL('pack.json', root), 'utf8')));
  const parser = foreign(spec.parser);
  const asset = vendorAssets().find(asset => asset.languageId === 'json' && asset.kind === 'wasm');
  if (spec.schema !== 1 || spec.languageId !== 'json' || spec.packVersion !== 'pilot-1' ||
      spec.rootScope !== 'source.json' || spec.scopeSuffix !== '.json' ||
      parser.asset !== asset?.path || parser.sha256 !== asset?.sha256 ||
      !Array.isArray(spec.queries) || spec.queries.length !== 1 || spec.queries[0] !== 'json.scm') throw new Error('Unsupported JSON pack manifest or parser identity');
  const component = await Component.load();
  return component.loadPack({ id: 'json', version: spec.packVersion, languageId: spec.languageId,
    rootScope: spec.rootScope, suffix: spec.scopeSuffix,
    files: [{ path: 'lib/scope-compat/packs/json/json.scm', query: await readFile(new URL('json.scm', root), 'utf8') }] });
}

export function nativeScopes(pack: NativePack, owner: PilotDocument, window: Window = { start: 0, end: owner.source.length }): PassResult {
  pack.assertLanguage(owner.languageId);
  u32(window.start); u32(window.end);
  return owner.borrow(pack.sameLanguage, borrowed => pack.run(borrowed, window));
}

function incomplete(status: 1 | 2 | 3 | 4): IncompleteStatus {
  return status === 1 ? 'unsupported' : status === 2 ? 'timeout' : 'error';
}

function scopeIntervals(result: Extract<PassResult, { status: 0 }>, pack: NativePack) {
  return Array.from({ length: result.segments.length / 3 }, (_, i) => ({
    from: result.segments[i * 3], to: result.segments[i * 3 + 1],
    scopes: result.paths[result.segments[i * 3 + 2]].map(id => pack.scopes[id]),
  }));
}

export async function nativeDocument(pack: NativePack | undefined, owner: PilotDocument, reference: StyleReference): Promise<DocumentResult> {
  const builder = new ResultBuilder({ profileId: 'native', languageId: owner.languageId, engine: pack?.engine ?? {} }, owner.source);
  try {
    pack?.assertLanguage(owner.languageId);
    if (!pack) return builder.incomplete('unsupported',
      owner.languageId === 'javascript' || owner.languageId === 'jsx'
        ? `${owner.languageId}: distinct variant, no native pack in the pilot (Phase 5)`
        : `No native pack for ${owner.languageId}`);
    const result = nativeScopes(pack, owner);
    if (result.status !== 0) return builder.incomplete(incomplete(result.status), `Native status ${result.status}, detail ${result.detail}, value ${result.value}`);
    const intervals = scopeIntervals(result, pack);
    return await paintScopes('native', owner.languageId, owner.source, intervals, reference, pack.engine);
  } catch (error) { return builder.incomplete('error', error instanceof Error ? error.message : String(error)); }
}
