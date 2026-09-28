import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

const wasmBinary = readFileSync(new URL('../lib/web-tree-sitter.wasm', import.meta.url));

beforeEach(() => vi.resetModules());

it('shares one runtime across concurrent initialization calls', async () => {
  const { initializeBinding, checkModule } = await import('../src/bindings');
  const [host, extension] = await Promise.all([
    initializeBinding({ wasmBinary }),
    initializeBinding({ wasmBinary }),
  ]);
  expect(extension).toBe(host);
  expect(await initializeBinding()).toBe(host);
  expect(checkModule()).toBe(true);
});

it('allows initialization to retry after a failed load', async () => {
  const { initializeBinding, checkModule } = await import('../src/bindings');
  await expect(initializeBinding({ wasmBinary: new Uint8Array([0]) })).rejects.toThrow();
  expect(checkModule()).toBe(false);
  await initializeBinding({ wasmBinary });
  expect(checkModule()).toBe(true);
});
