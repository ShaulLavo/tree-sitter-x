import type { MismatchRun, Pair, Track } from '../reference-observations.ts'
import type { OracleProfileId } from './request.ts'

export type Cause = 'empty-line' | 'line-split' | 'line-cap' | 'engine' | 'registration' | 'coalescing'

export const CAUSE_TITLES: Readonly<Record<Cause, string>> = {
  'empty-line': 'Empty-line handling',
  'line-split': 'Line splitting',
  'line-cap': 'Line cap boundary',
  engine: 'Fork vs upstream engine',
  registration: 'Registration and injection history',
  coalescing: 'Token coalescing',
}

export const CAUSES = Object.keys(CAUSE_TITLES) as Cause[]

/**
 * A named, intentional difference between reference profiles. `lines` claims, per input, the
 * inclusive range of source lines whose content may differ; every mismatch run must lie inside one
 * claimed line and satisfy `accepts`, and every (input, pair, track) it claims must be observed.
 * `every-fixture` claims boundary-only differences, which carry no mismatch, on any original fixture.
 */
export interface ReferenceExpectation {
  readonly id: string
  readonly cause: Cause
  readonly minimalFixture: string
  readonly lines: Readonly<Record<string, readonly [number, number]>> | 'every-fixture'
  readonly pairs: readonly Pair[]
  readonly tracks: readonly Track[]
  readonly accepts: (run: MismatchRun) => boolean
  readonly why: string
}

const RAW: readonly OracleProfileId[] = ['raw', 'raw:shiki-fork']
const WRAPPERS: readonly OracleProfileId[] = ['shiki-api', 'product', 'product:warm']
const PRODUCT: readonly OracleProfileId[] = ['product', 'product:warm']
const NOT_PRODUCT: readonly OracleProfileId[] = ['raw', 'raw:shiki-fork', 'shiki-api']

const cross = (left: readonly OracleProfileId[], right: readonly OracleProfileId[]): Pair[] =>
  left.flatMap((a) => right.filter((b) => b !== a).map((b): Pair => [a, b]))

/** The run's value on the side whose profile is in `group`. */
const side = (run: MismatchRun, group: readonly OracleProfileId[]): string | undefined =>
  group.map((profileId) => run.values[profileId]).find((value) => value !== undefined)

const isStyle = (run: MismatchRun): boolean => run.theme !== undefined
const EMPTY_PATH = ''
const EMPTY_STYLE = '{}'
/** A resolved style with a foreground and no font style: the product's theme-default paint. */
const DEFAULT_PAINT = /^\{"foreground":"#[0-9a-f]+"\}$/
const plain = (value: string | undefined): boolean => value === EMPTY_PATH
const unstyledOrDefault = (value: string | undefined): boolean => value === EMPTY_STYLE || DEFAULT_PAINT.test(value ?? '')

/** A capped line on the wrapper side: no scopes, and an empty or theme-default style. */
const cappedWrapper = (run: MismatchRun): boolean =>
  isStyle(run) ? unstyledOrDefault(side(run, WRAPPERS)) : plain(side(run, WRAPPERS))

export const REFERENCE_EXPECTATIONS: readonly ReferenceExpectation[] = [
  {
    id: 'empty-line-state',
    cause: 'empty-line',
    minimalFixture: 'typescript/empty-line-declaration',
    lines: { 'typescript/empty-line-declaration': [2, 2] },
    pairs: cross(RAW, WRAPPERS),
    tracks: ['scopes'],
    accepts: (run) => {
      const [root, ...rest] = (side(run, RAW) ?? '').split(' ')
      return side(run, WRAPPERS) === [root, 'meta.var.expr.ts', ...rest].join(' ')
    },
    why: 'Raw TextMate tokenizes the empty line, where the TypeScript grammar\'s `^\\s*$` end closes `meta.var.expr.ts`; the product and Shiki skip empty lines with the state unchanged, so `  1` on the next line keeps `meta.var.expr.ts` under the root. No oracle theme colours the difference.',
  },
  {
    id: 'final-lone-cr-dropped',
    cause: 'line-split',
    minimalFixture: 'typescript/trailing-lone-cr',
    lines: {
      'typescript/only-cr': [0, 0],
      'typescript/trailing-lone-cr': [0, 0],
      'typescript/crlf-then-trailing-cr': [1, 1],
    },
    pairs: cross(PRODUCT, NOT_PRODUCT),
    tracks: ['scopes', 'styles'],
    accepts: (run) =>
      run.to === run.lineEnd && run.from === run.lineEnd - 1 && side(run, PRODUCT) === (isStyle(run) ? EMPTY_STYLE : EMPTY_PATH),
    why: 'The product\'s splitLines strips a CR that ends the final segment even with no LF after it, so that one unit gets no token and is tiled like a terminator (no scopes, no style). Raw TextMate and Shiki keep it as text in the last line and tokenize it.',
  },
  {
    id: 'line-cap-at-limit',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20000',
    lines: { 'typescript/line-20000': [0, 0], 'tsx/line-20000': [0, 0], 'json/line-20000': [0, 0] },
    pairs: cross(['shiki-api'], [...RAW, ...PRODUCT]),
    tracks: ['scopes', 'styles'],
    accepts: (run) => side(run, ['shiki-api']) === (isStyle(run) ? EMPTY_STYLE : EMPTY_PATH),
    why: 'At exactly 20000 units Shiki\'s token API leaves the line plain (`length >= tokenizeMaxLineLength`), with no scopes and an empty colour; the product tokenizes it (`length > maxLineLength`), and raw TextMate has no cap.',
  },
  {
    id: 'line-cap-over-limit',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20001',
    lines: { 'typescript/line-20001': [0, 0] },
    pairs: cross(RAW, WRAPPERS),
    tracks: ['scopes', 'styles'],
    accepts: cappedWrapper,
    why: 'Past the cap both wrappers emit one token with an empty scope path; raw TextMate tokenizes the line.',
  },
  {
    id: 'line-cap-state-passes-through',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20001-closes-open-comment',
    lines: { 'typescript/line-20001-closes-open-comment': [1, 2] },
    pairs: cross(RAW, WRAPPERS),
    tracks: ['scopes', 'styles'],
    accepts: (run) => {
      if (run.line === 1) return cappedWrapper(run)
      return isStyle(run) || (side(run, WRAPPERS) ?? '').startsWith('source.ts comment.block.ts')
    },
    why: 'The capped line would close the open block comment. Both wrappers pass the incoming state through it, so `let z = 2` on the next line stays in `comment.block.ts`; raw TextMate closes the comment and tokenizes that line as code.',
  },
  {
    id: 'line-cap-plain-style',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20001',
    lines: { 'typescript/line-20001': [0, 0], 'typescript/line-20001-closes-open-comment': [1, 1] },
    pairs: cross(['shiki-api'], PRODUCT),
    tracks: ['styles'],
    accepts: (run) => side(run, ['shiki-api']) === EMPTY_STYLE && DEFAULT_PAINT.test(side(run, PRODUCT) ?? ''),
    why: 'Both leave the capped line plain with an empty scope path, but Shiki paints it with an empty colour (no foreground) while the product resolves its theme\'s default foreground.',
  },
  {
    id: 'markdown-lazy-fences',
    cause: 'registration',
    minimalFixture: 'markdown/fences',
    lines: { 'markdown/fences': [2, 9] },
    pairs: cross(['product:warm'], ['raw', 'raw:shiki-fork', 'shiki-api', 'product']),
    tracks: ['scopes', 'styles'],
    accepts: (run) => {
      if (isStyle(run)) return true
      const warm = side(run, ['product:warm']) ?? ''
      const cold = side(run, ['raw', 'raw:shiki-fork', 'shiki-api', 'product']) ?? ''
      return warm === `${cold}.markdown` || warm.startsWith(`${cold} meta.embedded.block.`)
    },
    why: 'Every Markdown fence language is `embeddedLangsLazy`. Registered alone, Markdown leaves the ts and json fence bodies as `markup.fenced_code.block.markdown` and names the fence language `fenced_code.block.language`; once the embedded grammars are registered (product:warm), Shiki reloads Markdown, the language becomes `fenced_code.block.language.markdown` and the bodies gain `meta.embedded.block.typescript` and `meta.embedded.block.json`. The other profiles all register the Markdown module alone.',
  },
  {
    id: 'style-token-coalescing',
    cause: 'coalescing',
    minimalFixture: 'json/no-trailing-newline',
    lines: 'every-fixture',
    pairs: cross(NOT_PRODUCT, PRODUCT),
    tracks: ['style-boundaries'],
    accepts: () => false,
    why: '`tokenizeLine2` merges adjacent tokens with equal metadata, so raw and Shiki style spans are coarser; the product keeps one style span per scoped token. Every unit still resolves to the same style: a boundary-only difference carries no mismatch run.',
  },
]
