import { open } from 'node:fs/promises';

export function addBytes(total: number, size: number, ceiling: number): number {
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(size) || !Number.isSafeInteger(ceiling) || total < 0 || size < 0 || size > ceiling - total) throw new RangeError('Measurement byte budget exceeded');
  return total + size;
}

export async function readBounded(path: string | number, ceiling: number): Promise<Buffer> {
  addBytes(0, 0, ceiling);
  if (typeof path === 'number') return readDescriptor(path, ceiling);
  const file = await open(path, 'r');
  try { return await readChunks(ceiling, buffer => file.read(buffer, 0, buffer.length, null).then(result => result.bytesRead)); }
  finally { await file.close(); }
}
async function readDescriptor(fd: number, ceiling: number): Promise<Buffer> {
  const { read } = await import('node:fs');
  return readChunks(ceiling, buffer => new Promise((resolve, reject) => {
    read(fd, buffer, 0, buffer.length, null, (error, bytes) => error ? reject(error) : resolve(bytes));
  }));
}
async function readChunks(ceiling: number, read: (buffer: Buffer) => Promise<number>): Promise<Buffer> {
  const chunks: Buffer[] = []; let total = 0;
  while (total <= ceiling) {
    const buffer = Buffer.allocUnsafe(Math.min(65536, ceiling + 1 - total));
    const bytes = await read(buffer);
    if (!bytes) return Buffer.concat(chunks, total);
    total = addBytes(total, bytes, ceiling); chunks.push(buffer.subarray(0, bytes));
  }
  throw new RangeError('Measurement byte budget exceeded');
}
function stringBytes(text: string, ceiling: number): number {
  let bytes = addBytes(0, 2, ceiling);
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i), next = text.charCodeAt(i + 1);
    const paired = unit >= 0xd800 && unit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
    bytes = addBytes(bytes, unitBytes(unit, paired), ceiling);
    if (paired) i++;
  }
  return bytes;
}
function unitBytes(unit: number, paired: boolean): number {
  if (paired) return 4;
  if (unit >= 0xd800 && unit <= 0xdfff) return 6;
  if (unit === 34 || unit === 92 || (unit === 8 || unit === 9 || unit === 10 || unit === 12 || unit === 13)) return 2;
  if (unit < 32) return 6;
  return unit < 128 ? 1 : unit < 2048 ? 2 : 3;
}
export function jsonBytes(value: unknown, ceiling: number, depth = 0): number {
  if (depth > 64) throw new Error('Measurement JSON depth exceeded');
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite measurement JSON');
    return addBytes(0, String(value).length, ceiling);
  }
  if (typeof value === 'string') return stringBytes(value, ceiling);
  if (typeof value === 'object' && value !== null) {
    const prototype: unknown = Object.getPrototypeOf(value);
    if ('toJSON' in value || prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) throw new Error('Custom measurement JSON expansion is not allowed');
    return Array.isArray(value) ? arrayBytes(value, ceiling, depth) : objectBytes(value, ceiling, depth);
  }
  throw new Error('Invalid measurement JSON value');
}
function arrayBytes(values: readonly unknown[], ceiling: number, depth: number): number {
  let bytes = addBytes(0, 2, ceiling);
  for (let index = 0; index < values.length; index++) {
    bytes = addBytes(bytes, index ? 1 : 0, ceiling);
    bytes = addBytes(bytes, jsonBytes(values[index] ?? null, ceiling - bytes, depth + 1), ceiling);
  }
  return bytes;
}
function objectBytes(value: object, ceiling: number, depth: number): number {
  let bytes = addBytes(0, 2, ceiling), count = 0;
  for (const key of Object.keys(value)) {
    const item: unknown = Reflect.get(value, key);
    if (item === undefined) continue;
    bytes = addBytes(bytes, (count++ ? 1 : 0) + stringBytes(key, ceiling) + 1, ceiling);
    bytes = addBytes(bytes, jsonBytes(item, ceiling - bytes, depth + 1), ceiling);
  }
  return bytes;
}
export function boundedJson(value: unknown, ceiling: number): string {
  jsonBytes(value, ceiling);
  return JSON.stringify(value);
}
export function reportBudget(ceiling: number) {
  let used = 0;
  return { reserve(value: unknown) { used = addBytes(used, jsonBytes(value, ceiling - used), ceiling); },
    remaining: () => ceiling - used };
}
