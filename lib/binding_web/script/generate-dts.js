import { createBundle } from 'dts-buddy';
import { readFile, rm, writeFile } from 'node:fs/promises';
import ts from 'typescript';

const output = 'web-tree-sitter.d.cts';
await createBundle({
  project: 'tsconfig.json',
  output,
  modules: {
    'web-tree-sitter': 'src/index.ts'
  },
  compilerOptions: {
    stripInternal: true,
  },
});

const declarations = await readFile(output, 'utf8');
const source = ts.createSourceFile(output, declarations, ts.ScriptTarget.Latest, true);
const [module] = source.statements;
if (source.statements.length !== 1 || !ts.isModuleDeclaration(module) ||
    !module.body || !ts.isModuleBlock(module.body)) {
  throw new Error('Expected one bundled declaration module');
}

// Keep every newline and the body unchanged so declaration source maps stay valid.
const header = declarations.slice(0, module.body.getStart(source) + 1).replace(/[^\r\n]/g, '');
await writeFile(output, header + declarations.slice(module.body.getStart(source) + 1, module.body.end - 1) +
  declarations.slice(module.body.end));
await writeFile('web-tree-sitter.d.ts', "export * from './web-tree-sitter.cjs';\n");
await rm('web-tree-sitter.d.ts.map', { force: true });
