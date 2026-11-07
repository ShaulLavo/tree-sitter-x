import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { baselineDocument, baselineScopes, baselineSupport } from '../src/baselines/run.ts';
import { parserUrl, querySource, sha256, vendorAssets, VENDOR_ROOT } from '../src/baselines/assets.ts';
import { languageRegistrations } from '../src/oracles/assets.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { parseResult } from '../src/validate.ts';
import { sourceSha256 } from '../src/source.ts';

it('runs the JSX registration over the pinned JS parser and ordered JS then JSX queries', async () => {
  expect(baselineSupport('baseline:captures', 'jsx')).toBeUndefined();
  expect(parserUrl('jsx')).toEqual(parserUrl('javascript'));
  expect(vendorAssets().some(asset => asset.languageId === 'jsx')).toBe(false);
  expect(sha256(readFileSync(parserUrl('jsx')))).toBe('5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240');
  const javascript = readFileSync(new URL('queries/javascript-highlights.scm', VENDOR_ROOT), 'utf8');
  const jsx = readFileSync(new URL('tree-sitter-javascript/queries/highlights-jsx.scm', VENDOR_ROOT), 'utf8');
  expect(sha256(javascript)).toBe('5f13a9435d7a49d6cbaab666cb1ebe79bce439a4d31cd50767e4617854f25eb8');
  expect(sha256(jsx)).toBe('0cad1712acaf40804bc5dc7c8476858752c1f549cdf7d8c63c747317be0f8fa6');
  expect(querySource('jsx')).toBe([javascript, jsx].join('\n'));
  const root = (await languageRegistrations('jsx')).find(item => item.name === 'jsx')?.scopeName;
  expect(root).toBe('source.js.jsx');
  const source = 'const face = "😀";\r\nconst view = <section title="é">{face}</section>;\n';
  const result = await baselineScopes('baseline:captures', 'jsx', source);
  expect(result.intervals.filter(item => item.scopes.length).every(item => item.scopes[0] === root)).toBe(true);
  const tag = source.indexOf('section');
  expect(result.intervals.find(item => item.from <= tag && item.to > tag)?.scopes).toEqual(['source.js.jsx', 'variable.other.readwrite', 'entity.name.tag']);
  const attribute = source.indexOf('title');
  expect(result.intervals.find(item => item.from <= attribute && item.to > attribute)?.scopes).toContain('entity.other.attribute-name');
  const emoji = source.indexOf('😀');
  expect(result.intervals.find(item => item.from <= emoji && item.to >= emoji + 2)?.scopes).toContain('string.quoted');
  expect(result.intervals.filter(item => ['\n', '\r\n'].includes(source.slice(item.from, item.to))).every(item => item.scopes.length === 0)).toBe(true);
  expect(result.engine.querySha256).toBe(sha256([javascript, jsx].join('\n')));
  expect(result.evidence.operations).toContain('match?');
  expect(result.evidence.exclusions.length).toBeGreaterThan(0);
  expect(result.evidence.exclusions.every(reason => reason.includes('#is-not? local'))).toBe(true);
  const document = await baselineDocument('baseline:captures', 'jsx', source, 'raw');
  expect(document.status).toBe('complete');
  expect(document.sourceSha256).toBe(sourceSha256(source));
  expect(document.sourceLength).toBe(source.length);
  expect(parseResult(JSON.parse(JSON.stringify(document)), source)).toEqual(document);
});

it('keeps empty and recovery JSX sources whole without implying native or VS Code support', async () => {
  expect((await baselineScopes('baseline:captures', 'jsx', '')).intervals).toEqual([]);
  const source = 'const view = <Panel title="unfinished\n😀';
  const document = await baselineDocument('baseline:captures', 'jsx', source, 'product');
  expect(document.status).toBe('complete');
  expect(parseResult(JSON.parse(JSON.stringify(document)), source)).toEqual(document);
  if (document.status !== 'complete') throw new Error(document.diagnostics.join('\n'));
  expect(document.spans.at(-2)).toBe(source.length);
  for (const id of ['javascript', 'jsx']) {
    expect(baselineSupport('baseline:vscode-ts', id)).toContain('only to the TypeScript and TSX');
    await expect(loadLanguagePack(id)).rejects.toThrow('no native pack');
  }
});
