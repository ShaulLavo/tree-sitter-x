import { readFile } from 'node:fs/promises';
import { Runtime, invoke } from '../native/runtime.ts';
import { Component } from '../native/component.ts';
import { loadLanguagePack } from '../native/packs.ts';
import { digest } from '../native/component-inputs.ts';
import { observeAllocations } from './observer.ts';

export class Releases {
  readonly #actions: (() => void)[] = [];
  add(action: () => void): () => void {
    let held = true;
    const release = () => { if (!held) return; held = false; action(); };
    this.#actions.push(release); return release;
  }
  closeOnFailure(primary: unknown): never {
    try { this.close(); }
    catch (cleanup) { throw new AggregateError([primary, cleanup], 'Measurement operation and cleanup failed', { cause: primary }); }
    throw primary;
  }
  close(): void {
    const errors: unknown[] = [];
    for (const action of this.#actions.reverse()) {
      try { action(); } catch (error) { errors.push(error); }
    }
    this.#actions.length = 0;
    if (errors.length) throw new AggregateError(errors, 'Measurement cleanup failed');
  }
}
export async function openMeasurementContext(language: string) {
  const releases = new Releases();
  try {
    const allocations = observeAllocations(); releases.add(allocations.restore);
    const runtime = await Runtime.load();
    const bytes = await readFile(new URL('../../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url));
    const observer = await runtime.extension(new WebAssembly.Module(bytes));
    releases.add(() => { invoke(observer, 'scope_test_reset'); });
    invoke(observer, 'scope_test_install');
    const component = await Component.load(), pack = await loadLanguagePack(language);
    releases.add(() => pack.dispose());
    return { runtime, component, pack, allocations, observerSha256: digest(bytes), dispose: () => releases.close() };
  } catch (error) { releases.closeOnFailure(error); }
}
export type MeasurementContext = Awaited<ReturnType<typeof openMeasurementContext>>;

export function failureText(error: unknown): string {
  const pending: unknown[] = [error], seen = new Set<unknown>(), messages: string[] = [];
  while (pending.length) {
    const current = pending.pop();
    if (seen.has(current)) continue;
    seen.add(current); messages.push(current instanceof Error ? current.stack ?? current.message : String(current));
    if (current instanceof AggregateError) pending.push(...current.errors.toReversed());
    else if (current instanceof Error && current.cause !== undefined) pending.push(current.cause);
  }
  return messages.join('\nCaused by:\n');
}
