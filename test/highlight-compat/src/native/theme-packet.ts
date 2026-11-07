import { INPUT_DEFAULTS, NONE, cap, limits, attempt } from './theme-contract.ts';
import type { InputLimits, NativeRule, Outcome } from './theme-contract.ts';

const encoder = new TextEncoder();
function write(view: DataView, offset: number, values: readonly number[]): void {
  values.forEach((value, index) => view.setUint32(offset + index * 4, value, true));
}
function stringTable(view: DataView, bytes: Uint8Array, offset: number, strings: readonly Uint8Array[]): void {
  let cursor = offset + strings.length * 8;
  strings.forEach((value, index) => {
    write(view, offset + index * 8, [cursor, value.length]);
    bytes.set(value, cursor); cursor += value.length;
  });
}
export function themePacket(atoms: readonly string[], rules: readonly NativeRule[], maxBytes: number): Uint8Array {
  const strings = atoms.map(atom => encoder.encode(atom));
  const contextCount = rules.reduce((total, rule) => total + rule.contexts.length, 0);
  const rulesAt = rules.length ? 48 : 0;
  const contextsAt = contextCount ? 48 + rules.length * 36 : 0;
  const namesAt = 48 + rules.length * 36 + contextCount * 8;
  const stringsAt = namesAt + atoms.length * 8;
  const total = stringsAt + strings.reduce((size, bytes) => size + bytes.length, 0);
  cap(total, maxBytes, 'packet-bytes');
  const bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
  write(view, 0, [0x31544853,1,total,rules.length,rulesAt,atoms.length,atoms.length ? namesAt : 0,
    contextCount,contextsAt,total - stringsAt,total > stringsAt ? stringsAt : 0,0]);
  let context = 0;
  rules.forEach((rule, index) => {
    write(view, 48 + index * 36, [rule.tail,rule.contexts.length ? context : 0,rule.contexts.length,
      rule.rule,rule.alternative,rule.present,rule.foreground,rule.background,rule.fontMask]);
    rule.contexts.forEach(edge => {
      write(view, contextsAt + context * 8, [edge.atom,edge.immediate ? 1 : 0]); ++context;
    });
  });
  stringTable(view, bytes, namesAt, strings);
  return bytes;
}

export interface PathPacket { readonly bytes: Uint8Array; readonly ids: readonly number[]; readonly count: number }
export function encodePathPacket(paths: readonly (readonly string[])[], options: Partial<InputLimits> = {}): Outcome<PathPacket> {
  return attempt(() => encode(paths, limits(INPUT_DEFAULTS, options, true)));
}
function encode(paths: readonly (readonly string[])[], bounds: InputLimits): PathPacket {
  cap(paths.length,bounds.paths,'paths');
  if (!paths.length) {
    cap(36,bounds.packetBytes,'packet-bytes');
    const bytes = new Uint8Array(36);
    write(new DataView(bytes.buffer),0,[0x31504853,1,36,0,0,0,0,0,0]);
    return {bytes,ids:Object.freeze([]),count:0};
  }
  const names = new Map<string,number>(), pairs: number[] = [NONE,NONE], prefixes = new Map<string,number>();
  const ids = paths.map(path => encodePath(path, names, pairs, prefixes, bounds));
  cap(pairs.length / 2, bounds.paths, 'paths');
  const strings = Array.from(names.keys(), name => encoder.encode(name));
  const namesAt = 36 + pairs.length * 4, stringsAt = namesAt + strings.length * 8;
  const total = stringsAt + strings.reduce((size, bytes) => size + bytes.length, 0);
  cap(total, bounds.packetBytes, 'packet-bytes');
  const bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
  write(view, 0, [0x31504853,1,total,names.size,names.size ? namesAt : 0,pairs.length / 2,36,
    total - stringsAt,total > stringsAt ? stringsAt : 0]);
  write(view,36,pairs); stringTable(view,bytes,namesAt,strings);
  return {bytes,ids:Object.freeze(ids),count:pairs.length / 2};
}
function encodePath(path: readonly string[], names: Map<string,number>, pairs: number[], prefixes: Map<string,number>, bounds: InputLimits): number {
  let parent = 0;
  for (const name of path) {
    if (!name || !name.isWellFormed() || /[\x00-\x20\x7f]/.test(name)) throw new Error('Invalid decoded scope name');
    let nameId = names.get(name);
    if (nameId === undefined) {
      cap(encoder.encode(name).length,bounds.atomBytes,'atom-bytes');
      nameId = names.size; cap(nameId + 1,bounds.atoms,'atoms'); names.set(name,nameId);
    }
    const key = `${parent}:${nameId}`, known = prefixes.get(key);
    if (known !== undefined) { parent = known; continue; }
    cap(pairs.length / 2 + 1,bounds.paths,'paths');
    const id = pairs.length / 2; pairs.push(parent,nameId); prefixes.set(key,id); parent = id;
  }
  return parent;
}
