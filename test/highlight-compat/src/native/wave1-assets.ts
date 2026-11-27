import { readFileSync } from 'node:fs';
import { sha256 } from '../baselines/assets.ts';
import type { VendorAsset } from '../baselines/assets.ts';

export const WAVE1_VENDOR_ROOT = new URL('../../vendor/wave-1/', import.meta.url);
export const WAVE1_LANGUAGES = ['css', 'html', 'shellscript', 'rust', 'python', 'go', 'yaml', 'toml'] as const;
export type Wave1Language = typeof WAVE1_LANGUAGES[number];

interface StructuralManifest {
  readonly languages: readonly {
    readonly id: string;
    readonly wasm: { readonly path: string; readonly platformPath: string; readonly sha256: string };
  }[];
}

export function wave1Assets(root = WAVE1_VENDOR_ROOT): readonly VendorAsset[] {
  return JSON.parse(readFileSync(new URL('assets.json', root), 'utf8')) as VendorAsset[];
}

export function wave1Asset(languageId: string, root = WAVE1_VENDOR_ROOT): VendorAsset | undefined {
  return wave1Assets(root).find(asset => asset.languageId === languageId && asset.kind === 'wasm');
}

export function wave1ParserUrl(languageId: string, root = WAVE1_VENDOR_ROOT): URL | undefined {
  const asset = wave1Asset(languageId, root);
  return asset ? new URL(asset.path, root) : undefined;
}

export function checkWave1Assets(root = WAVE1_VENDOR_ROOT): string[] {
  const manifest = JSON.parse(readFileSync(new URL('../../manifest/tree-sitter-languages.json', import.meta.url), 'utf8')) as StructuralManifest;
  const assets = wave1Assets(root);
  const problems: string[] = [];
  for (const languageId of WAVE1_LANGUAGES) {
    const manifestEntry = manifest.languages.find(entry => entry.id === languageId);
    const asset = assets.find(entry => entry.languageId === languageId && entry.kind === 'wasm');
    if (!manifestEntry || !asset) {
      problems.push(`${languageId}: missing Wave 1 vendored asset or manifest pin`);
      continue;
    }
    if (asset.sha256 !== manifestEntry.wasm.sha256 || asset.path !== manifestEntry.wasm.path || asset.manifestPath !== manifestEntry.wasm.platformPath) {
      problems.push(`${asset.path}: Wave 1 asset metadata differs from structural manifest`);
    }
    if (sha256(readFileSync(new URL(asset.path, root))) !== asset.sha256) {
      problems.push(`${asset.path}: Wave 1 vendored bytes differ from pinned hash`);
    }
  }
  if (assets.length !== WAVE1_LANGUAGES.length) problems.push('Wave 1 vendored asset count mismatch');
  return problems;
}
