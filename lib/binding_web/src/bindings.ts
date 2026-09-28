import type { MainModule } from '../lib/web-tree-sitter';
import createModule, { type ModuleOptions } from './wasi-module';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type Parser } from './parser';

export let Module: MainModule | null = null;

/**
 * @internal
 *
 * Initialize the Tree-sitter Wasm module. This should only be called by the {@link Parser} class via {@link Parser.init}.
 */
export async function initializeBinding(moduleOptions?: ModuleOptions): Promise<MainModule> {
  return Module ??= await createModule(moduleOptions);
}

/**
 * @internal
 *
 * Checks if the Tree-sitter Wasm module has been initialized.
 */
export function checkModule(): boolean {
  return !!Module;
}
