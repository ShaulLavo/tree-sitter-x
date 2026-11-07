import { readFile } from 'node:fs/promises';
import { digest } from './component-inputs.ts';
import { foreign } from './runtime.ts';

export const MARKDOWN_COMMIT = 'f02e277a34375f326572b4ade2602f44ac769005';
export const MARKDOWN_VERSION = '0.1.32';
export const MARKDOWN_ROOT = new URL('../../vendor/native-pilot/', import.meta.url);
const REQUIRED = ['LICENSE', 'NOTICE.md', 'tree-sitter-markdown.wasm', 'tree-sitter-md.wasm',
  'licenses/cloudlibc.txt', 'licenses/cmark-gfm.txt', 'licenses/cmark.txt', 'licenses/dlmalloc.txt',
  'licenses/icu.txt', 'licenses/llvm.txt', 'licenses/markdown-cjk-friendly.txt',
  'licenses/micromark-extension-gfm-strikethrough.txt', 'licenses/micromark.txt',
  'licenses/musl.txt', 'licenses/tree-sitter-markdown.txt',
  'licenses/tree-sitter.txt', 'licenses/wasi-libc.txt'];

export async function checkMarkdownAssets(): Promise<Readonly<Record<string, string>>> {
  const manifest = foreign(JSON.parse(await readFile(new URL('assets.json', MARKDOWN_ROOT), 'utf8')));
  if (manifest.schema !== 1 || manifest.commit !== MARKDOWN_COMMIT || manifest.packageVersion !== MARKDOWN_VERSION ||
      !Array.isArray(manifest.assets) || manifest.assets.length !== REQUIRED.length) throw new Error('Invalid current Markdown source manifest');
  const identities: Record<string, string> = {};
  for (const name of REQUIRED) {
    const item = manifest.assets.map(foreign).find(item => item.path === `tree-sitter-md/${name}`);
    const bytes = await readFile(new URL(`tree-sitter-md/${name}`, MARKDOWN_ROOT));
    if (!item || item.upstreamPath !== name || item.sha256 !== digest(bytes) || item.size !== bytes.length) throw new Error(`Current Markdown asset mismatch: ${name}`);
    identities[name] = digest(bytes);
  }
  if (identities['tree-sitter-md.wasm'] !== 'a62768930dddde0a5d9cf49cd35f583d83e9b4aedb34de0f047fcd7879df5159' ||
      identities['tree-sitter-markdown.wasm'] !== '27d067c772acc4adce2c79217aaec5168914338246ad5d8ecaf4bd9d0d0548d5') throw new Error('Current Markdown design hash mismatch');
  return Object.freeze(identities);
}
