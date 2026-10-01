import { sourceLines } from '../oracles/lines.ts'

export interface CaptureInterval {
  readonly from: number
  readonly to: number
  readonly name: string
  readonly pattern: number
  readonly ordinal: number
}

export interface ScopeInterval {
  readonly from: number
  readonly to: number
  readonly scopes: readonly string[]
}

const compareNames = (a: string, b: string): number => a < b ? -1 : Number(a > b)

const captureOrder = (a: CaptureInterval, b: CaptureInterval): number =>
  a.from - b.from || b.to - a.to || a.pattern - b.pattern || a.ordinal - b.ordinal || compareNames(a.name, b.name)

export function composeCaptures(source: string, rootScope: string, captures: readonly CaptureInterval[], map: (name: string) => readonly string[]): ScopeInterval[] {
  const starts = new Map<number, CaptureInterval[]>()
  const ends = new Map<number, CaptureInterval[]>()
  const boundaries = new Set<number>([0, source.length])
  for (const capture of captures) {
    if (capture.to <= capture.from) continue
    const from = Math.max(0, capture.from), to = Math.min(source.length, capture.to)
    if (from >= to) continue
    const clipped = { ...capture, from, to }
    starts.set(from, [...(starts.get(from) ?? []), clipped])
    ends.set(to, [...(ends.get(to) ?? []), clipped])
    boundaries.add(from)
    boundaries.add(to)
  }
  const separators = new Map<number, number>()
  for (const line of sourceLines(source)) {
    const end = line.start + line.text.length
    if (end === line.next) continue
    separators.set(end, line.next)
    boundaries.add(end)
    boundaries.add(line.next)
  }
  const points = [...boundaries].sort((a, b) => a - b)
  const active = new Set<CaptureInterval>()
  const output: ScopeInterval[] = []
  let separatorEnd = -1
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index] as number, to = points[index + 1] as number
    for (const capture of ends.get(from) ?? []) active.delete(capture)
    for (const capture of starts.get(from) ?? []) active.add(capture)
    separatorEnd = separators.get(from) ?? separatorEnd
    const scopes = from < separatorEnd ? [] : [rootScope, ...[...active].sort(captureOrder).flatMap(capture => map(capture.name))]
    output.push({ from, to, scopes })
  }
  return output
}
