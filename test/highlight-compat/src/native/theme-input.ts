import { createHash } from 'node:crypto';
import { normalizeTheme as shikiNormalize } from 'shiki/core';
import type { ThemeRegistration } from 'shiki/core';
import { workerThemeRegistration } from '../oracles/product/theme.ts';
import { vscodeRawTheme } from '../oracles/raw.ts';
import { INPUT_DEFAULTS, NONE, attempt, cap, limits, reject } from './theme-contract.ts';
import type { AcquiredInput, InputLimits, Location, NativeRule, Outcome, OutsideScore, Profile } from './theme-contract.ts';
import { themePacket } from './theme-packet.ts';

const snapshotBrand = Symbol('theme input snapshot'), normalizedBrand = Symbol('normalized theme');
export interface InputSnapshot { readonly [snapshotBrand]: true; readonly acquisitionRevision: string }
export interface NormalizedTheme {
  readonly [normalizedBrand]: true; readonly profile: Profile; readonly contentRevision: string;
  readonly acquisitionRevision: string; readonly targetIdentity: string; readonly normalizedPacketDigest: string;
}
type Setting = NonNullable<ThemeRegistration['tokenColors']>[number];
interface Resource { readonly id: string; readonly bytes: Uint8Array; readonly document: Record<string,unknown> }
interface SnapshotData { readonly resources: readonly Resource[]; readonly bounds: InputLimits }
const snapshots = new WeakMap<InputSnapshot,SnapshotData>();
const packets = new WeakMap<NormalizedTheme,Uint8Array>();
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8',{fatal:true});
function hash(domain: string, fields: readonly (string | Uint8Array)[]): string {
  const digest = createHash('sha256');
  const allFields: readonly (string | Uint8Array)[] = [domain];
  for (const field of allFields.concat(fields)) {
    const bytes = typeof field === 'string' ? encoder.encode(field) : field;
    const size = Buffer.alloc(4); size.writeUInt32LE(bytes.length);
    digest.update(size); digest.update(bytes);
  }
  return digest.digest('hex');
}
function record(value: unknown): value is Record<string,unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function resourceLocation(resource: string, jsonPointer = ''): Location { return {kind:'resource',resource,jsonPointer,byteOffset:null}; }
function schema(location: Location): never { return reject({kind:'invalid',code:'schema',location}); }
function resource(input: AcquiredInput['resources'][number], bounds: InputLimits): Resource {
  if (!input || typeof input.id !== 'string' || !input.id || !input.id.isWellFormed() || !(input.bytes instanceof Uint8Array)) schema({kind:'request'});
  const location = resourceLocation(input.id);
  cap(encoder.encode(input.id).length,bounds.resourceIdBytes,'resource-id-bytes');
  if (input.format !== 'json') {
    if (input.format === 'jsonc' || input.format === 'plist') reject({kind:'unsupported',code:'input-format',location});
    schema(location);
  }
  const bytes = input.bytes.slice();
  let document: unknown;
  try { document = JSON.parse(decoder.decode(bytes)); }
  catch { reject({kind:'invalid',code:'json',location}); }
  if (!record(document)) schema(location);
  if ('include' in document && (typeof document.include !== 'string' || !document.include)) schema(resourceLocation(input.id,'/include'));
  return {id:input.id,bytes,document};
}
function acquisition(input: AcquiredInput, bounds: InputLimits): { readonly resources: readonly Resource[]; readonly revision: string } {
  if (!input || typeof input.root !== 'string' || !Array.isArray(input.resources) || !Array.isArray(input.edges)) schema({kind:'request'});
  cap(input.resources.length,bounds.resources,'resources');
  let byteCount = 0;
  for (const entry of input.resources) {
    if (!entry || !(entry.bytes instanceof Uint8Array)) schema({kind:'request'});
    byteCount += entry.bytes.length; cap(byteCount,bounds.inputBytes,'input-bytes');
  }
  const resources = input.resources.map(entry => resource(entry,bounds)), byId = new Map(resources.map(entry => [entry.id,entry]));
  if (byId.size !== resources.length || !byId.has(input.root))
    reject({kind:'invalid',code:'include-graph',location:resourceLocation(input.root)});
  if (input.edges.length > resources.length) reject({kind:'invalid',code:'include-graph',location:resourceLocation(input.root,'/include')});
  const edges = new Map<string,string>();
  for (const edge of input.edges) {
    if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string' || edge.ordinal !== 0 || edges.has(edge.from))
      reject({kind:'invalid',code:'include-graph',location:resourceLocation(typeof edge?.from === 'string' ? edge.from : input.root,'/include')});
    if (!byId.has(edge.from) || !byId.has(edge.to)) reject({kind:'invalid',code:'include-authority',location:resourceLocation(edge.from,'/include')});
    edges.set(edge.from,edge.to);
  }
  const ordered = closure(input.root,byId,edges,bounds);
  const fields: (string | Uint8Array)[] = [input.root];
  resources.forEach(entry => fields.push(entry.id,entry.bytes));
  input.edges.forEach(edge => fields.push(edge.from,edge.to,String(edge.ordinal)));
  return {resources:ordered,revision:hash('scope-compat/acquisition-1',fields)};
}
function closure(root: string, resources: ReadonlyMap<string,Resource>, edges: ReadonlyMap<string,string>, bounds: InputLimits): readonly Resource[] {
  const ordered: Resource[] = [], visited = new Set<string>();
  let id: string | undefined = root;
  while (id !== undefined) {
    const entry = resources.get(id);
    if (!entry || visited.has(id)) reject({kind:'invalid',code:'include-graph',location:resourceLocation(id,'/include')});
    cap(ordered.length,bounds.includeDepth,'include-depth');
    visited.add(id); ordered.push(entry);
    const next = edges.get(id);
    if (('include' in entry.document) !== (next !== undefined)) reject({kind:'invalid',code:'include-graph',location:resourceLocation(id,'/include')});
    id = next;
  }
  if (visited.size !== resources.size) reject({kind:'invalid',code:'include-graph',location:resourceLocation(root)});
  ordered.reverse(); return ordered;
}
export function snapshotInput(input: AcquiredInput, options: Partial<InputLimits> = {}): Outcome<InputSnapshot> {
  return attempt(() => {
    const bounds = limits(INPUT_DEFAULTS,options,true), acquired = acquisition(input,bounds);
    const snapshot = Object.freeze({[snapshotBrand]:true,acquisitionRevision:acquired.revision} satisfies InputSnapshot);
    snapshots.set(snapshot,{resources:acquired.resources,bounds}); return snapshot;
  });
}

function color(value: unknown, location: Location): string {
  if (typeof value !== 'string') schema(location);
  if (value === '') reject({kind:'invalid',code:'color',location});
  if (!value.startsWith('#')) reject({kind:'unsupported',code:'color-format',location});
  if (!/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) reject({kind:'invalid',code:'color',location});
  return value;
}
function font(value: unknown, location: Location): string {
  if (typeof value !== 'string') schema(location);
  if (value === '') return value;
  if (!value.trim() || value.trim() !== value || / {2}|[\t\r\n\f\v]/.test(value)) reject({kind:'invalid',code:'font-style',location});
  if (!value.split(' ').every(word => ['italic','bold','underline','strikethrough'].includes(word))) reject({kind:'unsupported',code:'font-style',location});
  return value;
}
function setting(value: unknown, resource: string, rule: number): Setting {
  const location = (property: string): Location => ({kind:'setting',resource,rule,alternative:0,property});
  if (!record(value) || !record(value.settings)) schema(location('settings'));
  const settings: { -readonly [K in keyof Setting['settings']]: Setting['settings'][K] } = {};
  for (const [property,field] of Object.entries(value.settings)) {
    if (property === 'foreground' || property === 'background') { settings[property] = color(field,location(property)); continue; }
    if (property === 'fontStyle') { settings.fontStyle = font(field,location(property)); continue; }
    reject({kind:'unsupported',code:'syntax-property',location:location(property)});
  }
  const name = value.name;
  if (name !== undefined && typeof name !== 'string') schema(location('name'));
  const named = name === undefined ? {settings} : {settings,name};
  if (value.scope === undefined) return named;
  if (typeof value.scope === 'string') return {...named,scope:value.scope};
  if (Array.isArray(value.scope) && value.scope.every((entry: unknown) => typeof entry === 'string')) return {...named,scope:Array.from(value.scope)};
  return schema(location('scope'));
}
function registration(entry: Resource, warnings: OutsideScore[]): ThemeRegistration & {name:string} {
  const doc = entry.document, result: ThemeRegistration & {name:string} = {name:typeof doc.name === 'string' ? doc.name : entry.id};
  if ('name' in doc && typeof doc.name !== 'string') schema(resourceLocation(entry.id,'/name'));
  for (const key of ['settings','tokenColors'] as const) {
    const value = doc[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) schema(resourceLocation(entry.id,`/${key}`));
    result[key] = value.map((rule,index) => setting(rule,entry.id,index));
  }
  if ('type' in doc) {
    if (doc.type !== 'dark' && doc.type !== 'light') schema(resourceLocation(entry.id,'/type'));
    result.type = doc.type;
  }
  const colorWarnings: OutsideScore[] = [];
  if ('colors' in doc) result.colors = colors(doc.colors,entry.id,colorWarnings);
  if ('fg' in doc) result.fg = color(doc.fg,resourceLocation(entry.id,'/fg'));
  if ('bg' in doc) result.bg = color(doc.bg,resourceLocation(entry.id,'/bg'));
  if ('colorReplacements' in doc) reject({kind:'unsupported',code:'syntax-property',location:resourceLocation(entry.id,'/colorReplacements')});
  for (const property of Object.keys(doc)) {
    if (['name','type','settings','tokenColors','colors','include','fg','bg'].includes(property)) continue;
    warnings.push({kind:'outside-score',resource:entry.id,property});
  }
  colorWarnings.forEach(warning => warnings.push(warning));
  return result;
}
function colors(value: unknown, resource: string, warnings: OutsideScore[]): Record<string,string> {
  if (!record(value)) schema(resourceLocation(resource,'/colors'));
  const result: Record<string,string> = {};
  for (const [key,entry] of Object.entries(value)) {
    if (typeof entry !== 'string') schema(resourceLocation(resource,`/colors/${key}`));
    result[key] = entry;
    if (key === 'editor.foreground' || key === 'editor.background') color(entry,resourceLocation(resource,`/colors/${key}`));
    else warnings.push({kind:'outside-score',resource,property:`colors/${key}`});
  }
  return result;
}
function canonical(value: string): string {
  const expanded = value.length <= 5 ? Array.from(value.slice(1),c => c+c).join('') : value.slice(1);
  return (expanded.length === 6 ? `${expanded}ff` : expanded).toLowerCase();
}
function mask(value: string): number {
  const bits: ReadonlyMap<string,number> = new Map([['italic',1],['bold',2],['underline',4],['strikethrough',8]]);
  return value.split(' ').reduce((result,word) => result | (bits.get(word) ?? 0),0);
}
function selectors(scope: Setting['scope'], location: Location): readonly string[] {
  if (scope === undefined || scope === '') return [''];
  const alternatives = typeof scope === 'string' ? scope.split(',') : scope;
  if (!alternatives.length) reject({kind:'invalid',code:'selector',location});
  return alternatives.map(value => {
    const selector = value.trim();
    if (!selector || selector.includes(',')) reject({kind:'invalid',code:'selector',location});
    return selector;
  });
}
interface RuleBuilder { readonly atoms: Map<string,number>; readonly rules: NativeRule[]; readonly bounds: InputLimits; edges: number }
function atomId(builder: RuleBuilder, atom: string): number {
  cap(encoder.encode(atom).length,builder.bounds.atomBytes,'atom-bytes');
  const known = builder.atoms.get(atom);
  if (known !== undefined) return known;
  cap(builder.atoms.size+1,builder.bounds.atoms,'atoms');
  const id = builder.atoms.size; builder.atoms.set(atom,id); return id;
}
function selectorParts(selector: string, location: Location): { readonly tail: string; readonly contexts: readonly {atom:string;immediate:boolean}[] } {
  if (!selector) return {tail:'',contexts:[]};
  if (/[\t\r\n]| {2}/.test(selector)) reject({kind:'invalid',code:'selector',location});
  if (/[*|&():/]/.test(selector) || (selector !== '-' && selector.split(' ').includes('-'))) reject({kind:'unsupported',code:'selector',location});
  const parts = selector.split(' '), tail = parts.pop();
  if (!tail || tail === '>' || parts[0] === '>') reject({kind:'invalid',code:'selector',location});
  const contexts: {atom:string;immediate:boolean}[] = [];
  let immediate = false;
  parts.reverse();
  for (const part of parts) {
    if (part === '>' && !immediate) { immediate = true; continue; }
    if (part === '>') reject({kind:'invalid',code:'selector',location});
    contexts.push({atom:part,immediate}); immediate = false;
  }
  const atoms = contexts.map(edge => edge.atom).concat([tail]);
  if (atoms.some(value => value === '-' || !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(value))) reject({kind:'invalid',code:'selector',location});
  if (tail.split('.').some(value => value === 'hasOwnProperty' || value === '__proto__')) reject({kind:'unsupported',code:'trie-tail-atom',location});
  return {tail,contexts};
}
function addRule(builder: RuleBuilder, value: Setting, rule: number, source: {readonly resource:string;readonly rule:number}): void {
  const location: Location = {kind:'setting',resource:source.resource,rule:source.rule,alternative:0,property:'scope'};
  const alternatives = selectors(value.scope,location);
  alternatives.forEach((selector,alternative) => {
    const where = {...location,alternative}, parsed = selectorParts(selector,where);
    cap(builder.rules.length+1,builder.bounds.rules,'rules');
    cap(parsed.contexts.length,builder.bounds.contextAtomsPerSelector,'context-atoms');
    builder.edges += parsed.contexts.length; cap(builder.edges,builder.bounds.contextEdges,'context-edges');
    const {foreground,background,fontStyle} = value.settings;
    builder.rules.push({tail:parsed.tail ? atomId(builder,parsed.tail) : NONE,
      contexts:parsed.contexts.map(edge => ({atom:atomId(builder,edge.atom),immediate:edge.immediate})),rule,alternative,
      present:(foreground === undefined ? 0 : 1) | (background === undefined ? 0 : 2) | (fontStyle === undefined ? 0 : 4),
      foreground:foreground === undefined ? 0 : parseInt(canonical(foreground),16),
      background:background === undefined ? 0 : parseInt(canonical(background),16),fontMask:fontStyle === undefined ? 0 : mask(fontStyle)});
  });
}
export function normalizeTheme(input: InputSnapshot, profile: Profile, targetIdentity: string, options: Partial<InputLimits> = {}): Outcome<NormalizedTheme> {
  const warnings: OutsideScore[] = [];
  const snapshot = snapshots.get(input);
  if (!snapshot) throw new Error('Unknown input snapshot');
  return attempt(() => normalize(input,profile,targetIdentity,limits(snapshot.bounds,options,true),warnings),warnings);
}
function normalize(input: InputSnapshot, profile: Profile, targetIdentity: string, bounds: InputLimits, warnings: OutsideScore[]): NormalizedTheme {
  const snapshot = snapshots.get(input);
  if (!snapshot) throw new Error('Unknown input snapshot');
  if (profile !== 'raw' && profile !== 'product') reject({kind:'unsupported',code:'profile',location:{kind:'request'}});
  if (!targetIdentity) throw new Error('Missing pinned theme target identity');
  const registrations = snapshot.resources.map(entry => registration(entry,warnings));
  const expanded: ThemeRegistration & {name:string} = {name:registrations.at(-1)?.name ?? 'theme',colors:{},settings:[]};
  const locations: {resource:string;rule:number}[] = [];
  registrations.forEach((entry,index) => {
    Object.assign(expanded.colors ?? {},entry.colors);
    if (entry.type !== undefined) expanded.type = entry.type;
    if (entry.fg !== undefined) expanded.fg = entry.fg;
    if (entry.bg !== undefined) expanded.bg = entry.bg;
    const selected = entry.settings ?? entry.tokenColors ?? [];
    expanded.settings = (expanded.settings ?? []).concat(selected);
    selected.forEach((_,rule) => locations.push({resource:snapshot.resources[index].id,rule}));
  });
  const originalCount = expanded.settings?.length ?? 0;
  const normalized = profile === 'raw' ? vscodeRawTheme(expanded).settings : shikiNormalize(workerThemeRegistration(expanded)).settings;
  if (normalized.length > originalCount) locations.unshift({resource:snapshot.resources.at(-1)?.id ?? '',rule:0});
  const builder: RuleBuilder = {atoms:new Map(),rules:[],bounds,edges:0};
  const palette = new Set(['000000ff','ffffffff']);
  normalized.forEach((entry,index) => {
    const source = setting(entry,'<normalized>',index);
    addRule(builder,source,index,locations[index]);
    if (source.settings.foreground !== undefined) palette.add(canonical(source.settings.foreground));
    if (source.settings.background !== undefined) palette.add(canonical(source.settings.background));
  });
  if (profile === 'raw' && palette.size > 255) reject({kind:'unsupported',code:'raw-palette',location:resourceLocation(snapshot.resources.at(-1)?.id ?? '')});
  const packet = themePacket(Array.from(builder.atoms.keys()),builder.rules,bounds.packetBytes);
  const packetDigest = hash('scope-compat/theme-packet-1',[packet]);
  const revision = hash('scope-compat/normalized-theme-1',[input.acquisitionRevision,profile,targetIdentity,'base-first-1',packet]);
  const result = Object.freeze({[normalizedBrand]:true,profile,contentRevision:revision,
    acquisitionRevision:input.acquisitionRevision,targetIdentity,normalizedPacketDigest:packetDigest} satisfies NormalizedTheme);
  packets.set(result,packet); return result;
}
export function normalizedPacket(input: NormalizedTheme): Uint8Array {
  const packet = packets.get(input);
  if (!packet) throw new Error('Unknown normalized theme');
  return packet.slice();
}
