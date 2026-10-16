// WebAssembly JS API addition not yet declared by TypeScript 5.9.
export {};

declare global {
  namespace WebAssembly {
    interface Memory {
      toResizableBuffer(): ArrayBuffer;
    }
  }
}

