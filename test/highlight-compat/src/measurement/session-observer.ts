import { foreign } from '../native/runtime.ts';
import type { MeasurementContext } from './context.ts';
import { Releases } from './context.ts';
import { replaceMethod } from './observer.ts';
import { record } from './model.ts';

export interface CallCounts { readonly parseCalls: number; readonly scopeCalls: number; readonly themeCompileCalls: number; readonly themeResolveCalls: number; readonly decodedSegmentBytes: number }
export interface NativeWork { readonly capturesSeen: number; readonly intervalsKept: number; readonly droppedEmpty: number; readonly droppedExclusive: number; readonly droppedDuplicate: number }
export function installSessionCallCounters(ctx: MeasurementContext) {
  const releases = new Releases();
  let counts = { parseCalls: 0, scopeCalls: 0, themeCompileCalls: 0, themeResolveCalls: 0, decodedSegmentBytes: 0 };
  let work: NativeWork[] = [];
  try {
    const prototype = foreign(foreign(ctx.runtime.binding.Parser).prototype);
    releases.add(replaceMethod(prototype, 'parse', original => function(this: unknown, ...args: unknown[]) {
      counts.parseCalls++; return Reflect.apply(original, this, args);
    }));
    releases.add(replaceMethod(ctx.component, 'call', original => function(this: unknown, ...args: unknown[]) {
      if (args[0] === 'scope_compat_run') counts.scopeCalls++;
      if (args[0] === 'scope_compat_theme_new') counts.themeCompileCalls++;
      if (args[0] === 'scope_compat_theme_resolve') counts.themeResolveCalls++;
      return Reflect.apply(original, this, args);
    }));
    releases.add(replaceMethod(ctx.component, 'run', original => function(this: unknown, ...args: unknown[]) {
      const result: unknown = Reflect.apply(original, this, args);
      const output = record(result);
      if (output.status === 0) capture(output);
      return result;
    }));
    return { read: (): CallCounts => ({ ...counts }), work: () => work.slice(),
      reset: () => { counts = { parseCalls: 0, scopeCalls: 0, themeCompileCalls: 0, themeResolveCalls: 0, decodedSegmentBytes: 0 }; work = []; },
      restore: () => releases.close() };
  } catch (error) { releases.close(); throw error; }
  function capture(output: Record<string, unknown>): void {
    if (!(output.segments instanceof Uint32Array) || !Array.isArray(output.statistics) || output.statistics.length !== 5) throw new Error('Invalid observed native work');
    counts.decodedSegmentBytes += output.segments.byteLength;
    const [capturesSeen, intervalsKept, droppedEmpty, droppedExclusive, droppedDuplicate] = output.statistics;
    if (![capturesSeen, intervalsKept, droppedEmpty, droppedExclusive, droppedDuplicate].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid native statistics');
    work.push({ capturesSeen, intervalsKept, droppedEmpty, droppedExclusive, droppedDuplicate });
  }
}
export type SessionCounters = ReturnType<typeof installSessionCallCounters>;
export function subtractCounts(after: CallCounts, before: CallCounts): CallCounts {
  return { parseCalls: after.parseCalls - before.parseCalls, scopeCalls: after.scopeCalls - before.scopeCalls,
    themeCompileCalls: after.themeCompileCalls - before.themeCompileCalls, themeResolveCalls: after.themeResolveCalls - before.themeResolveCalls,
    decodedSegmentBytes: after.decodedSegmentBytes - before.decodedSegmentBytes };
}
