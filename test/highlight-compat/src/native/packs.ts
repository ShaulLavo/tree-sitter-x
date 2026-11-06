import { readFile } from 'node:fs/promises';
import { Component } from './component.ts';
import type { NativePack } from './component.ts';
import { foreign } from './runtime.ts';
import { vendorAssets } from '../baselines/assets.ts';
import { loadJsonPack } from './adapter.ts';

export const NATIVE_LANGUAGES = ['json', 'typescript', 'tsx'] as const;
export type NativeLanguage = typeof NATIVE_LANGUAGES[number];
export function nativeLanguage(value: string): NativeLanguage | undefined {
  return NATIVE_LANGUAGES.find(language => language === value);
}
export function embeddedScope(language: NativeLanguage): string {
  return `meta.embedded.block.${language}`;
}

export async function loadLanguagePack(languageId: string): Promise<NativePack> {
  if (languageId === 'json') return loadJsonPack();
  if (languageId !== 'typescript' && languageId !== 'tsx') throw new Error(`${languageId}: distinct variant, no native pack in the pilot (Phase 5)`);
  const root = new URL(`../../../../lib/scope-compat/packs/${languageId}/`, import.meta.url);
  const spec = foreign(JSON.parse(await readFile(new URL('pack.json', root), 'utf8')));
  const parser = foreign(spec.parser);
  const asset = vendorAssets().find(asset => asset.languageId === languageId && asset.kind === 'wasm');
  const suffix = languageId === 'typescript' ? '.ts' : '.tsx';
  const queries = ['../shared/typescript-common.scm', `${languageId}.scm`];
  if (spec.schema !== 1 || spec.languageId !== languageId || spec.packVersion !== 'pilot-1' ||
      spec.rootScope !== `source${suffix}` || spec.scopeSuffix !== suffix || spec.embeddedScope !== embeddedScope(languageId) ||
      parser.asset !== asset?.path || parser.sha256 !== asset?.sha256 || !Array.isArray(spec.queries) ||
      JSON.stringify(spec.queries) !== JSON.stringify(queries)) throw new Error(`Unsupported ${languageId} pack manifest or parser identity`);
  const files = await Promise.all(queries.map(async path => ({
    path: `lib/scope-compat/packs/${languageId}/${path}`, query: await readFile(new URL(path, root), 'utf8'),
  })));
  return (await Component.load()).loadPack({ id: languageId, version: 'pilot-1', languageId,
    rootScope: `source${suffix}`, suffix, files });
}
