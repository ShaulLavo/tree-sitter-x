import { readFileSync } from 'fs';
import { expect, it } from 'vitest';
import { gitPackageManifest, type PackageManifest } from '../script/git-package-manifest';

const source = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as PackageManifest;

it('names the git package web-tree-sitter, the name consumers and their overrides use', () => {
  const manifest = gitPackageManifest(source);
  expect(source.name).toBe('@singapore-editor/tree-sitter-x');
  expect(manifest.name).toBe('web-tree-sitter');
  expect(manifest.version).toBe(source.version);
  expect(manifest.exports).toEqual(source.exports);
  expect(manifest).not.toHaveProperty('scripts');
  expect(manifest).not.toHaveProperty('devDependencies');
});
