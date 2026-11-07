import { integer, pointAt } from './edit-batch.ts';
import type { OwnerKey } from './owner-state.ts';
import { sameOwner } from './owner-state.ts';
import type { ScopeInterval } from '../baselines/compose.ts';
export interface Mapping { readonly childFrom: number; readonly childTo: number; readonly parentFrom: number; readonly parentTo: number }
export interface InjectionDescriptor {
  readonly id: string; readonly parent: string | null; readonly owner: OwnerKey;
  readonly generation: number; readonly language: string; readonly frame: readonly string[]; readonly mappings: readonly Mapping[];
}
export function validateMappings(child: string, parent: string, mappings: readonly Mapping[]): readonly Mapping[] {
  let childEnd = 0, parentEnd = 0;
  const result: Mapping[] = [];
  for (const map of mappings) {
    integer(map.childFrom, child.length); integer(map.childTo, child.length);
    integer(map.parentFrom, parent.length); integer(map.parentTo, parent.length);
    if (map.childFrom < childEnd || map.parentFrom < parentEnd || map.childTo <= map.childFrom || map.parentTo <= map.parentFrom ||
      map.childTo - map.childFrom !== map.parentTo - map.parentFrom) throw new Error('Invalid injection mapping');
    pointAt(child, map.childTo); pointAt(parent, map.parentTo);
    if (child.slice(map.childFrom, map.childTo) !== parent.slice(map.parentFrom, map.parentTo)) throw new Error('Injection source mismatch');
    childEnd = map.childTo; parentEnd = map.parentTo; result.push(Object.freeze({ ...map }));
  }
  return Object.freeze(result);
}
export function validateDescriptors(descriptors: readonly InjectionDescriptor[], owner: OwnerKey, maxCount: number, maxDepth: number): void {
  if (descriptors.length > maxCount) throw new Error('Injection descriptor limit');
  const ids = new Map(descriptors.map(descriptor => [descriptor.id, descriptor]));
  if (ids.size !== descriptors.length) throw new Error('Duplicate injection ID');
  for (const descriptor of descriptors) {
    if (!descriptor.id || !sameOwner(descriptor.owner, owner) || descriptor.generation !== owner.syntax) throw new Error('Stale injection descriptor');
    validateParent(descriptor, ids, maxDepth);
  }
}
function validateParent(descriptor: InjectionDescriptor, ids: ReadonlyMap<string, InjectionDescriptor>, maxDepth: number): void {
  const seen = new Set<string>();
  let current: InjectionDescriptor | undefined = descriptor;
  while (current) {
    if (seen.has(current.id) || seen.size >= maxDepth) throw new Error('Injection cycle or depth limit');
    seen.add(current.id);
    if (current.parent === null) return;
    current = ids.get(current.parent);
    if (!current) throw new Error('Missing injection parent');
  }
}
export function mapIntervals(intervals: readonly ScopeInterval[], mappings: readonly Mapping[]): readonly ScopeInterval[] {
  return intervals.flatMap(interval => mappings.flatMap(map => mappedInterval(interval, map)));
}
function mappedInterval(interval: ScopeInterval, map: Mapping): ScopeInterval[] {
  const from = Math.max(interval.from, map.childFrom), to = Math.min(interval.to, map.childTo);
  if (from >= to) return [];
  return [{ from: integer(map.parentFrom + from - map.childFrom, map.parentTo), to: integer(map.parentFrom + to - map.childFrom, map.parentTo), scopes: interval.scopes }];
}
