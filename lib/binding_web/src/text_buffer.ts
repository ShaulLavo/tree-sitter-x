import { C } from './constants';
import { newFinalizer } from './finalization_registry';

const finalizer = newFinalizer((address: number) => {
  C._free(address);
});

// Code units decoded per String.fromCharCode call, below engines' argument limits.
const DECODE_CHUNK = 4096;

/**
 * UTF-16 text kept in the parser's memory. {@link Parser#parse} reads it in place, and
 * {@link TextBuffer#edit} moves only the text after the edit, so a keystroke copies the
 * inserted characters instead of the whole document.
 *
 * Trees parsed from a buffer read their text from it, so they see later edits.
 */
export class TextBuffer {
  /** @internal */
  [0] = 0; // Address of the text

  /** @internal */
  private capacity = 0;

  /** The length of the text, in UTF-16 code units. */
  length = 0;

  constructor(text = '') {
    this.set(text);
  }

  /** Replace the whole text. */
  set(text: string): void {
    this.reserve(text.length);
    this.length = text.length;
    this.write(0, text);
  }

  /** Replace the code units in `[startIndex, oldEndIndex)` with `text`. */
  edit(startIndex: number, oldEndIndex: number, text: string): void {
    if (startIndex < 0 || oldEndIndex < startIndex || oldEndIndex > this.length) {
      throw new RangeError(`Invalid edit [${startIndex}, ${oldEndIndex}) of a buffer of length ${this.length}`);
    }
    const length = this.length + text.length - (oldEndIndex - startIndex);
    this.reserve(length);
    const units = this.units(Math.max(length, this.length));
    units.copyWithin(startIndex + text.length, oldEndIndex, this.length);
    this.length = length;
    this.write(startIndex, text);
  }

  /** The text in `[startIndex, endIndex)`. */
  slice(startIndex = 0, endIndex = this.length): string {
    const end = Math.min(endIndex, this.length);
    const units = this.units(this.length);
    let result = '';
    for (let at = startIndex; at < end; at += DECODE_CHUNK) {
      result += String.fromCharCode(...units.subarray(at, Math.min(end, at + DECODE_CHUNK)));
    }
    return result;
  }

  // The last chunk read decoded: node text for query predicates asks for many small
  // ranges near each other, and decoding a chunk per request dominated query time.
  private chunkStart = -1;
  private chunk = '';

  /** The text from `index` on, in chunks, for {@link Tree#textCallback}. */
  readonly read = (index: number): string => {
    const start = index - (index % DECODE_CHUNK);
    if (start !== this.chunkStart) {
      this.chunk = this.slice(start, Math.min(this.length, start + DECODE_CHUNK));
      this.chunkStart = start;
    }
    return this.chunk.slice(index - start);
  };

  /** Free the buffer's memory. */
  delete(): void {
    finalizer?.unregister(this);
    C._free(this[0]);
    this[0] = 0;
    this.capacity = 0;
    this.length = 0;
  }

  private units(length: number): Uint16Array {
    return new Uint16Array(C.HEAPU8.buffer, this[0], length);
  }

  private write(at: number, text: string): void {
    this.chunkStart = -1;
    const units = this.units(at + text.length);
    for (let i = 0; i < text.length; i++) units[at + i] = text.charCodeAt(i);
  }

  private reserve(length: number): void {
    if (length <= this.capacity && this[0]) return;
    const capacity = Math.max(length, this.capacity * 2, 64);
    const address = C._realloc(this[0], capacity * 2);
    if (!address) throw new Error(`Failed to allocate a text buffer of ${capacity} code units`);
    finalizer?.unregister(this);
    this[0] = address;
    this.capacity = capacity;
    finalizer?.register(this, address, this);
  }
}
