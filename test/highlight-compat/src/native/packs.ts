import { readFile } from 'node:fs/promises';
import { Component } from './component.ts';
import type { NativePack } from './component.ts';
import { foreign } from './runtime.ts';
import { parserLanguageId, vendorAssets } from '../baselines/assets.ts';
import { wave1Asset } from './wave1-assets.ts';
import { loadJsonPack } from './adapter.ts';

export const NATIVE_LANGUAGES = [
  'json', 'typescript', 'tsx', 'javascript', 'jsx',
  'css', 'html', 'shellscript', 'rust', 'python', 'go', 'yaml', 'toml',
] as const;
export type NativeLanguage = typeof NATIVE_LANGUAGES[number];

const LANGUAGE_ALIASES: Readonly<Record<string, NativeLanguage>> = Object.freeze({
  bash: 'shellscript',
  sh: 'shellscript',
  shell: 'shellscript',
  zsh: 'shellscript',
  rs: 'rust',
  py: 'python',
  yml: 'yaml',
});

export function nativeLanguage(value: string): NativeLanguage | undefined {
  const direct = NATIVE_LANGUAGES.find(language => language === value);
  if (direct) return direct;
  return Object.hasOwn(LANGUAGE_ALIASES, value) ? LANGUAGE_ALIASES[value] : undefined;
}
export function embeddedScope(language: NativeLanguage): string {
  return `meta.embedded.block.${language}`;
}

export async function loadLanguagePack(languageId: string): Promise<NativePack> {
  const resolved = nativeLanguage(languageId);
  if (resolved === 'json') return loadJsonPack();
  const identity = resolved ? packIdentity(resolved) : undefined;
  if (!identity || !resolved) throw new Error(`${languageId}: distinct variant, no native pack in the pilot (Phase 5)`);
  const root = new URL(`../../../../lib/scope-compat/packs/${resolved}/`, import.meta.url);
  const spec = foreign(JSON.parse(await readFile(new URL('pack.json', root), 'utf8')));
  const parser = foreign(spec.parser);
  const asset = vendorAssets().find(item => item.languageId === parserLanguageId(resolved) && item.kind === 'wasm')
    ?? wave1Asset(resolved);
  const { rootScope, suffix, queries, version } = identity;
  if (spec.schema !== 1 || spec.languageId !== resolved || spec.packVersion !== version ||
      spec.rootScope !== rootScope || spec.scopeSuffix !== suffix || spec.embeddedScope !== embeddedScope(resolved) ||
      parser.asset !== asset?.path || parser.sha256 !== asset?.sha256 || !Array.isArray(spec.queries) ||
      JSON.stringify(spec.queries) !== JSON.stringify(queries)) throw new Error(`Unsupported ${resolved} pack manifest or parser identity`);
  const files = await Promise.all(queries.map(async path => ({
    path: `lib/scope-compat/packs/${resolved}/${path}`, query: await readFile(new URL(path, root), 'utf8'),
  })));
  return (await Component.load()).loadPack({ id: resolved, version, languageId: resolved, rootScope, suffix, files });
}

interface PackIdentity {
  readonly rootScope: string;
  readonly suffix: string;
  readonly version: string;
  readonly queries: readonly string[];
}

const WAVE1_PACKS: Readonly<Record<string, PackIdentity>> = Object.freeze({
  css: { rootScope: 'source.css', suffix: '.css', version: 'wave1-1', queries: ['css.scm'] },
  html: { rootScope: 'text.html.basic', suffix: '.html', version: 'wave1-1', queries: ['html.scm'] },
  shellscript: { rootScope: 'source.shell', suffix: '.shell', version: 'wave1-1', queries: ['shellscript.scm'] },
  rust: { rootScope: 'source.rust', suffix: '.rust', version: 'wave1-1', queries: ['rust.scm'] },
  python: { rootScope: 'source.python', suffix: '.python', version: 'wave1-1', queries: ['python.scm'] },
  go: { rootScope: 'source.go', suffix: '.go', version: 'wave1-1', queries: ['go.scm'] },
  yaml: { rootScope: 'source.yaml', suffix: '.yaml', version: 'wave1-1', queries: ['yaml.scm'] },
  toml: { rootScope: 'source.toml', suffix: '.toml', version: 'wave1-1', queries: ['toml.scm'] },
});

function packIdentity(languageId: NativeLanguage): PackIdentity | undefined {
  if (languageId === 'typescript' || languageId === 'tsx') {
    const suffix = languageId === 'typescript' ? '.ts' : '.tsx';
    return { rootScope: `source${suffix}`, suffix, version: 'pilot-1', queries: ['../shared/typescript-common.scm', `${languageId}.scm`] };
  }
  if (languageId === 'javascript' || languageId === 'jsx') {
    const suffix = languageId === 'javascript' ? '.js' : '.js.jsx';
    return { rootScope: `source${suffix}`, suffix, version: 'experimental-1', queries: ['../shared/javascript-common.scm', `${languageId}.scm`] };
  }
  return Object.hasOwn(WAVE1_PACKS, languageId) ? WAVE1_PACKS[languageId] : undefined;
}
