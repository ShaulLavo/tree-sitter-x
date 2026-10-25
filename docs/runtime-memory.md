# Runtime memory

The JavaScript runtime supports Node 24 and later. It feature-detects
`WebAssembly.Memory.prototype.toResizableBuffer` when creating each runtime.
It uses no Node version checks or flags.

## Heap views

`heap()` returns a `Uint8Array` covering the runtime's current memory.

- When `toResizableBuffer` is available, `heap()` returns one length-tracking view.
  That view and its buffer keep their identities through JavaScript growth,
  Wasm allocation, and `memory.grow(0)`.
- When the API is absent, the runtime uses the fixed `memory.buffer`. Every
  successful growth, including `memory.grow(0)`, detaches the previous buffer and
  its views. The runtime refreshes its byte, integer, and scalar views on access.
  Call `heap()` again after any operation that can allocate or grow memory.

For example, call an extension first, then read its result through a fresh view:

```js
const address = extension.make_result() >>> 0;
const bytes = heap().subarray(address, address + resultLength);
const owned = bytes.slice();
```

A `heap()` view does not keep a C allocation alive. Addresses expire after
`free` or a `realloc` that moves the allocation. Recreate allocation-specific
views after a move. Copy data before releasing its allocation or transferring
it to a worker.

## Limits

Both paths start with a small allocation and permit growth to the 4 GiB Wasm32
limit. A fixed buffer's `maxByteLength` describes its current size, not the
memory's declared maximum. Growth can still fail when the engine cannot provide
memory. Pointers above 2 GiB can arrive as signed values, so index with
`address >>> 0`.
