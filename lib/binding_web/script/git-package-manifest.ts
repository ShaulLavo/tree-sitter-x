// Rewrites a packed package.json for the web-tree-sitter branch, which git installs use as is.
// node script/git-package-manifest.ts <package.json>
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

export type PackageManifest = Record<string, unknown>;

export function gitPackageManifest(manifest: PackageManifest): PackageManifest {
  const published = { ...manifest };
  delete published.scripts;
  delete published.devDependencies;
  return published;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  const manifest = gitPackageManifest(JSON.parse(readFileSync(file, 'utf8')) as PackageManifest);
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}
