import esbuild from 'esbuild';
import fs from 'fs/promises';

const format = process.env.CJS ? 'cjs' : 'esm';
const debug = process.argv.includes('--debug');
const outfile = `${debug ? 'debug/' : ''}web-tree-sitter.${format === 'esm' ? 'js' : 'cjs'}`;

async function build() {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format,
    outfile,
    sourcemap: true,
    sourcesContent: true,
    keepNames: true,
    external: ['fs/*', 'fs/promises'],
    resolveExtensions: ['.ts', '.js', format === 'esm' ? '.mjs' : '.cjs'],
    ...(format === 'cjs' ? {
      footer: { js: 'module.exports.default = module.exports;' },
      // src/wasi-module.ts finds the runtime next to the bundle through import.meta.url.
      define: { 'import.meta.url': 'importMetaUrl' },
      inject: ['script/import-meta-url.cjs'],
    } : {}),
  });

  // Copy the Wasm file to the appropriate spot, as esbuild doesn't "bundle" Wasm files.
  // Debug builds carry DWARF inside the Wasm file instead of a separate source map.
  await fs.copyFile('lib/web-tree-sitter.wasm', `${debug ? 'debug/' : ''}web-tree-sitter.wasm`);
}

build().catch(console.error);
