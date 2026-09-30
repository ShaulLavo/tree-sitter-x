import type { Pair, Track } from '../reference-observations.ts'
import type { OracleProfileId } from './request.ts'

export type Cause = 'empty-line' | 'line-cap' | 'engine' | 'registration' | 'coalescing'

export const CAUSE_TITLES: Readonly<Record<Cause, string>> = {
  'empty-line': 'Empty-line handling',
  'line-cap': 'Line cap boundary',
  engine: 'Fork vs upstream engine',
  registration: 'Registration and injection history',
  coalescing: 'Token coalescing',
}

export const CAUSES = Object.keys(CAUSE_TITLES) as Cause[]

/**
 * A named, intentional difference between reference profiles. It claims each (input, pair, track)
 * in its cross product, and every claim must be observed; `every-fixture` claims boundary-only
 * differences wherever they occur and must be observed on its minimal fixture.
 */
export interface ReferenceExpectation {
  readonly id: string
  readonly cause: Cause
  readonly minimalFixture: string
  readonly inputs: readonly string[] | 'every-fixture'
  readonly pairs: readonly Pair[]
  readonly tracks: readonly Track[]
  readonly why: string
}

const RAW: readonly OracleProfileId[] = ['raw', 'raw:shiki-fork']
const WRAPPERS: readonly OracleProfileId[] = ['shiki-api', 'product', 'product:warm']
const PRODUCT: readonly OracleProfileId[] = ['product', 'product:warm']

const cross = (left: readonly OracleProfileId[], right: readonly OracleProfileId[]): Pair[] =>
  left.flatMap((a) => right.filter((b) => b !== a).map((b): Pair => [a, b]))

export const REFERENCE_EXPECTATIONS: readonly ReferenceExpectation[] = [
  {
    id: 'empty-line-state',
    cause: 'empty-line',
    minimalFixture: 'typescript/empty-line-declaration',
    inputs: ['typescript/empty-line-declaration'],
    pairs: cross(RAW, WRAPPERS),
    tracks: ['scopes'],
    why: 'Raw TextMate tokenizes the empty line, where the TypeScript grammar\'s `^\\s*$` end closes `meta.var.expr.ts`; the product and Shiki skip empty lines with the state unchanged, so `1` on the next line stays inside the declaration. No oracle theme colours the difference.',
  },
  {
    id: 'line-cap-at-limit',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20000',
    inputs: ['typescript/line-20000', 'tsx/line-20000', 'json/line-20000'],
    pairs: cross(['shiki-api'], [...RAW, ...PRODUCT]),
    tracks: ['scopes', 'styles'],
    why: 'At exactly 20000 units Shiki\'s token API leaves the line plain (`length >= tokenizeMaxLineLength`); the product tokenizes it (`length > maxLineLength`), and raw TextMate has no cap.',
  },
  {
    id: 'line-cap-over-limit',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20001',
    inputs: ['typescript/line-20001'],
    pairs: cross(RAW, WRAPPERS),
    tracks: ['scopes', 'styles'],
    why: 'Past the cap both wrappers emit one token with an empty scope path; raw TextMate tokenizes the line.',
  },
  {
    id: 'line-cap-state-passes-through',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20001-closes-open-comment',
    inputs: ['typescript/line-20001-closes-open-comment'],
    pairs: cross(RAW, WRAPPERS),
    tracks: ['scopes', 'styles'],
    why: 'The capped line would close the open block comment. Both wrappers pass the incoming state through it, so the next line stays in the comment; raw TextMate closes it and tokenizes `let z = 2` as code.',
  },
  {
    id: 'line-cap-plain-style',
    cause: 'line-cap',
    minimalFixture: 'typescript/line-20001',
    inputs: ['typescript/line-20001', 'typescript/line-20001-closes-open-comment'],
    pairs: cross(['shiki-api'], PRODUCT),
    tracks: ['styles'],
    why: 'Both leave the capped line plain with an empty scope path, but Shiki paints it with an empty colour (no foreground) while the product resolves its theme\'s default foreground.',
  },
  {
    id: 'markdown-lazy-fences',
    cause: 'registration',
    minimalFixture: 'markdown/fences',
    inputs: ['markdown/fences'],
    pairs: cross(['product:warm'], ['raw', 'raw:shiki-fork', 'shiki-api', 'product']),
    tracks: ['scopes', 'styles'],
    why: 'Every Markdown fence language is `embeddedLangsLazy`. Registered alone, Markdown leaves the ts and json fence bodies as `markup.fenced_code.block.markdown`; once the embedded grammars are registered (product:warm), Shiki reloads Markdown and the bodies take TypeScript and JSON scopes. The other profiles all register the Markdown module alone.',
  },
  {
    id: 'style-token-coalescing',
    cause: 'coalescing',
    minimalFixture: 'json/no-trailing-newline',
    inputs: 'every-fixture',
    pairs: cross(['raw', 'raw:shiki-fork', 'shiki-api'], PRODUCT),
    tracks: ['style-boundaries'],
    why: '`tokenizeLine2` merges adjacent tokens with equal metadata, so raw and Shiki style spans are coarser; the product keeps one style span per scoped token. Every unit still resolves to the same style.',
  },
]
