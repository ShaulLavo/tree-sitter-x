import { encodePathPacket } from './theme-packet.ts';
import type { PathPacket } from './theme-packet.ts';
import { appliedStyle } from './theme-projection.ts';
import type { AppliedStyle } from './theme-projection.ts';
import type { NativeTheme, ThemeLease } from './theme.ts';
import type { NormalizedTheme } from './theme-input.ts';
import type { EffectiveStyle, InputLimits, Outcome, ResolveLimits } from './theme-contract.ts';
import type { FramedScopes, FramingPolicy, ScopeLease, ScopeSnapshot } from './scope-output.ts';
import type { TextSpan } from './edit-batch.ts';

export interface StyleRun extends TextSpan { readonly style: AppliedStyle | Readonly<Record<string, never>> }
export interface ThemePair {
  readonly snapshot: ScopeSnapshot; readonly runs: readonly StyleRun[];
  reserve(bytes: number): () => void; retain(): ThemePair; release(): void;
}
interface Encoding {
  readonly scope: ScopeLease; readonly framed: FramedScopes; readonly packet: PathPacket; readonly memos: Map<string, SharedPair>; readonly inputKey: string;
  uses: number; released: boolean;
}
const empty = Object.freeze({});
function fullRuns(framed: FramedScopes, packet: PathPacket, styles: readonly EffectiveStyle[], theme: NormalizedTheme): readonly StyleRun[] {
  const snapshot = framed.snapshot;
  const projected = packet.ids.map(id => appliedStyle(theme.profile, styles[id]));
  if (framed.kind === 'product-lines') return Object.freeze(framed.reasons.map((reason, index) => Object.freeze({
    from: snapshot.segments[index * 3], to: snapshot.segments[index * 3 + 1],
    style: reason === 'separator' ? empty : projected[snapshot.segments[index * 3 + 2]],
  })));
  const runs: StyleRun[] = [];
  let separator = 0;
  for (let i = 0; i < snapshot.segments.length; i += 3) {
    let from = snapshot.segments[i]; const end = snapshot.segments[i + 1], style = projected[snapshot.segments[i + 2]];
    while (from < end) {
      separator = currentSeparator(snapshot.separators, separator, from);
      const span = snapshot.separators[separator], isSeparator = span && span.from <= from;
      const to = Math.min(end, span ? isSeparator ? span.to : span.from : end);
      runs.push(Object.freeze({ from, to, style: isSeparator ? empty : style })); from = to;
    }
  }
  return Object.freeze(runs);
}
function currentSeparator(spans: readonly TextSpan[], index: number, from: number): number {
  while (index < spans.length && spans[index].to <= from) index++;
  return index;
}
export function clipStyles(runs: readonly StyleRun[], viewport: TextSpan): readonly StyleRun[] {
  return Object.freeze(runs.flatMap(run => {
    const from = Math.max(run.from, viewport.from), to = Math.min(run.to, viewport.to);
    return from < to ? [Object.freeze({ from, to, style: run.style })] : [];
  }));
}
class SharedPair {
  #references = 0;
  #state: Readonly<{ encoding: Encoding; theme: ThemeLease; releaseBytes: () => void; drop: () => void; runs: readonly StyleRun[] }> | undefined;
  constructor(encoding: Encoding, theme: NativeTheme, runs: readonly StyleRun[], bytes: number, drop: () => void) {
    const releaseBytes = encoding.scope.reserve(bytes);
    try { this.#state = { encoding, runs, drop, releaseBytes, theme: theme.retain() }; } catch (error) { releaseBytes(); throw error; }
  }
  retain(): ThemePair {
    if (!this.#state) throw new Error('Released theme pair');
    this.#references++; let held = true;
    const live = () => { if (!held || !this.#state) throw new Error('Released theme pair'); return this.#state; };
    return Object.freeze({ get snapshot() { return live().encoding.framed.snapshot; }, get runs() { return live().runs; },
      reserve: (bytes: number) => live().encoding.scope.reserve(bytes),
      retain: () => { live(); return this.retain(); }, release: () => {
        if (!held) return; held = false;
        if (--this.#references) return;
        this.release();
      } });
  }
  private release(): void {
    const state = this.#state; this.#state = undefined;
    if (!state) return;
    try { state.theme.release(); } finally { state.releaseBytes(); state.drop(); }
  }
}

// NativeTheme always compiles in Component's single runtime. This cache never crosses a session/runtime boundary.
export class ThemeCache {
  readonly #encodings = new Map<ScopeSnapshot, Map<string, Encoding>>();
  acquire(scope: ScopeLease, normalized: NormalizedTheme, theme: NativeTheme, input: Partial<InputLimits>, resolve: Partial<ResolveLimits>, framing: FramingPolicy = 'identity-v1'): Outcome<ThemePair> {
    if (framing === 'future010-product-lines-v1' && normalized.profile !== 'product') return { kind: 'unsupported', code: 'profile', location: { kind: 'request' } };
    const key = JSON.stringify([normalized.contentRevision, normalized.profile, input, resolve]);
    const inputKey = JSON.stringify([framing, input]);
    let encoding = this.#encodings.get(scope.snapshot)?.get(inputKey);
    if (!encoding) {
      const created = createEncoding(scope, input, inputKey, framing);
      if (created.kind !== 'ok') return created;
      encoding = created.value;
      const encodings = this.#encodings.get(scope.snapshot) ?? new Map<string, Encoding>();
      encodings.set(inputKey, encoding); this.#encodings.set(scope.snapshot, encodings);
    }
    encoding.uses++;
    try { return this.memo(encoding, key, normalized, theme, resolve); }
    finally { encoding.uses--; this.dropEmpty(encoding); }
  }
  private memo(encoding: Encoding, key: string, normalized: NormalizedTheme, theme: NativeTheme, resolve: Partial<ResolveLimits>): Outcome<ThemePair> {
    const previous = encoding.memos.get(key);
    if (previous) return { kind: 'ok', value: previous.retain(), warnings: [] };
    const result = theme.resolve(encoding.packet, resolve);
    if (result.kind !== 'ok') return result;
    const runs = fullRuns(encoding.framed, encoding.packet, result.value, normalized);
    const pair = new SharedPair(encoding, theme, runs, memoBytes(runs) + key.length * 2, () => {
      if (encoding.memos.get(key) === pair) encoding.memos.delete(key);
      this.dropEmpty(encoding);
    });
    encoding.memos.set(key, pair);
    return { kind: 'ok', value: pair.retain(), warnings: [] };
  }
  private dropEmpty(encoding: Encoding): void {
    if (encoding.released || encoding.uses || encoding.memos.size) return;
    const snapshot = encoding.scope.snapshot, encodings = this.#encodings.get(snapshot);
    encoding.released = true;
    if (encodings?.get(encoding.inputKey) === encoding) encodings.delete(encoding.inputKey);
    if (!encodings?.size) this.#encodings.delete(snapshot);
    encoding.scope.release();
  }
}
function createEncoding(scope: ScopeLease, input: Partial<InputLimits>, inputKey: string, framing: FramingPolicy): Outcome<Encoding> {
  const framed = scope.projectFraming(framing), snapshot = framed.snapshot;
  const paths = snapshot.dictionary.paths.map(path => path.map(id => snapshot.dictionary.names[id]));
  const packet = encodePathPacket(paths, input);
  if (packet.kind !== 'ok') return packet;
  const retained = scope.retain();
  try { retained.reserve(packet.value.bytes.length + packet.value.ids.length * 8 + inputKey.length * 2 + 128); }
  catch (error) { retained.release(); throw error; }
  return { kind: 'ok', value: { scope: retained, framed, packet: packet.value, memos: new Map(), inputKey, uses: 0, released: false }, warnings: [] };
}
function memoBytes(runs: readonly StyleRun[]): number {
  const styles = new Set(runs.map(run => run.style));
  return 128 + runs.length * 32 + Array.from(styles, styleBytes).reduce((sum, bytes) => sum + bytes, 0);
}
function styleBytes(style: StyleRun['style']): number {
  const background = 'background' in style ? style.background : '';
  const font = typeof style.fontStyle === 'object' ? Object.keys(style.fontStyle).length * 8 : (style.fontStyle?.length ?? 0) * 2;
  return 40 + (style.foreground?.length ?? 0) * 2 + background.length * 2 + font;
}
