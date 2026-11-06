import { address, sourceSpan, u32 } from './decode.ts';
import type { Foreign, Runtime } from './runtime.ts';

export interface Borrowed {
  readonly tree: number;
  readonly source: number;
  readonly length: number;
}

export function languageAddress(language: Foreign): number {
  const pointer = address(language[0]);
  if (!pointer) throw new Error('Deleted language');
  return pointer;
}

export function withBorrowed<T>(runtime: Runtime, language: Foreign, tree: Foreign, buffer: Foreign,
  sourceLength: number, sameLanguage: (language: Foreign) => boolean, action: (borrowed: Borrowed) => T): T {
  const treeAddress = address(tree[0]);
  const sourceAddress = address(buffer[0]);
  if (!treeAddress || !sourceAddress) throw new Error('Deleted tree or buffer');
  if (!sameLanguage(language) || tree.language !== language) throw new Error('Native pack language mismatch');
  if (tree.textCallback !== buffer.read || buffer.length !== sourceLength) throw new Error('Tree was not parsed from this source buffer');
  u32(sourceLength);
  sourceSpan(runtime.heap(), sourceAddress, sourceLength);
  const result = action({ tree: treeAddress, source: sourceAddress, length: sourceLength });
  if (result instanceof Promise) throw new Error('Native borrows must be synchronous');
  return result;
}
