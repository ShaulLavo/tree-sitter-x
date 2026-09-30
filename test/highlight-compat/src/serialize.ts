import { readFileSync } from 'node:fs'
import type { DocumentResult, SpanTriples, StyleTrack } from './schema.ts'
import { canonicalStyle } from './style.ts'
import { parseResult } from './validate.ts'

type Entry = readonly [key: string, text: string]

const INDENT = '  '

/** One-line JSON with a space after each `,` and `:`. */
function compact(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(compact).join(', ')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${compact(item)}`).join(', ')}}`
  }
  return JSON.stringify(value)
}

function block(open: string, close: string, lines: readonly string[], depth: number): string {
  if (lines.length === 0) return `${open}${close}`
  const inner = INDENT.repeat(depth + 1)
  return `${open}\n${lines.map((line) => `${inner}${line}`).join(',\n')}\n${INDENT.repeat(depth)}${close}`
}

function object(entries: readonly Entry[], depth: number): string {
  return block('{', '}', entries.map(([key, text]) => `${JSON.stringify(key)}: ${text}`), depth)
}

function list(items: readonly unknown[], depth: number): string {
  return block('[', ']', items.map(compact), depth)
}

function spans(triples: SpanTriples, depth: number): string {
  const lines: string[] = []
  for (let i = 0; i < triples.length; i += 3) lines.push(`${triples[i]}, ${triples[i + 1]}, ${triples[i + 2]}`)
  return block('[', ']', lines, depth)
}

const sortedKeys = (record: object): string[] => Object.keys(record).sort()

function engine(record: Readonly<Record<string, string>>, depth: number): string {
  return object(sortedKeys(record).map((key) => [key, JSON.stringify(record[key])]), depth)
}

function theme(track: StyleTrack, depth: number): string {
  const styles = track.styles.map(canonicalStyle)
  return object([['styles', list(styles, depth + 1)], ['spans', spans(track.spans, depth + 1)]], depth)
}

function themes(record: Readonly<Record<string, StyleTrack>>, depth: number): string {
  return object(sortedKeys(record).map((themeId) => [themeId, theme(record[themeId], depth + 1)]), depth)
}

function optionalEntries(result: DocumentResult): Entry[] {
  if (result.status !== 'complete') return []
  const entries: Entry[] = []
  const { metadata, styles } = result
  if (metadata !== undefined) {
    entries.push(['metadata', object([['languageIds', list(metadata.languageIds, 2)], ['spans', spans(metadata.spans, 2)]], 1)])
  }
  if (styles !== undefined) entries.push(['styles', themes(styles, 1)])
  return entries
}

/** Deterministic, diff-friendly JSON. Pure: callers validate first. */
export function serializeResult(result: DocumentResult): string {
  const entries: Entry[] = [
    ['schema', JSON.stringify(result.schema)],
    ['profileId', JSON.stringify(result.profileId)],
    ['languageId', JSON.stringify(result.languageId)],
    ['sourceSha256', JSON.stringify(result.sourceSha256)],
    ['sourceLength', JSON.stringify(result.sourceLength)],
    ['documentRevision', JSON.stringify(result.documentRevision)],
    ['status', JSON.stringify(result.status)],
    ['diagnostics', list(result.diagnostics, 1)],
    ['engine', engine(result.engine, 1)],
    ['scopeNames', list(result.scopeNames, 1)],
    ['paths', list(result.paths, 1)],
    ['spans', spans(result.spans, 1)],
    ...optionalEntries(result),
  ]
  return `${object(entries, 0)}\n`
}

export function parseResultText(text: string, source?: string): DocumentResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  return parseResult(value, source)
}

export function readResultFile(path: string, source?: string): DocumentResult {
  const text = readFileSync(path, 'utf8')
  try {
    return parseResultText(text, source)
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}
