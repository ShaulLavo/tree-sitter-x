import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as fork from '@shikijs/vscode-textmate'
import upstream from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'
import { PINS, pinLabel } from './pins.ts'

export interface TextmateToken {
  readonly startIndex: number
  readonly endIndex: number
  readonly scopes: readonly string[]
}

/** Opaque rule stack; only the engine that produced it reads it. */
export type TextmateState = { readonly __textmateState: never }

interface LineResult<T> {
  readonly tokens: T
  readonly ruleStack: TextmateState
  readonly stoppedEarly: boolean
}

export interface TextmateGrammar {
  tokenizeLine(line: string, state: TextmateState | null): LineResult<readonly TextmateToken[]>
  tokenizeLine2(line: string, state: TextmateState | null): LineResult<Uint32Array>
}

export interface RawThemeSetting {
  readonly scope?: string | readonly string[]
  readonly settings: { readonly foreground?: string; readonly background?: string; readonly fontStyle?: string }
}

export interface RawTheme {
  readonly name: string
  readonly settings: readonly RawThemeSetting[]
}

export interface TextmateRegistry {
  loadGrammar(scopeName: string): Promise<TextmateGrammar | null>
  setTheme(theme: RawTheme): void
  getColorMap(): string[]
}

/** The grammars a registry may load and the injections it reports, by scope name. */
export interface GrammarSet {
  readonly rootScope: string
  grammar(scopeName: string): object | undefined
  injections(scopeName: string): string[] | undefined
}

export interface TextmateEngine {
  readonly identity: Readonly<Record<string, string>>
  createRegistry(grammars: GrammarSet): TextmateRegistry
}

export type EngineId = 'upstream' | 'shiki-fork'

interface OnigLib {
  createOnigScanner(patterns: string[]): oniguruma.OnigScanner
  createOnigString(text: string): oniguruma.OnigString
}

const ONIGURUMA_IDENTITY = {
  oniguruma: pinLabel(PINS.vscodeOniguruma),
  onigurumaCommit: PINS.vscodeOniguruma.commit,
  onigurumaWasmSha256: PINS.vscodeOniguruma.wasmSha256,
}

// loadWASM initialises module state, so each process (one oracle worker) calls it once.
async function onigLib(): Promise<OnigLib> {
  const require = createRequire(import.meta.url)
  await oniguruma.loadWASM(readFileSync(require.resolve(`${PINS.vscodeOniguruma.name}/${PINS.vscodeOniguruma.wasm}`)))
  return {
    createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
    createOnigString: (text) => new oniguruma.OnigString(text),
  }
}

// The two registries take structurally identical grammars, themes and token results; their
// declarations differ only in class identity, so the casts stay at this boundary.
function upstreamEngine(lib: OnigLib): TextmateEngine {
  return {
    identity: { textmate: pinLabel(PINS.vscodeTextmate), textmateCommit: PINS.vscodeTextmate.commit, ...ONIGURUMA_IDENTITY },
    createRegistry: (grammars) => {
      const registry = new upstream.Registry({
        onigLib: Promise.resolve(lib),
        loadGrammar: async (scopeName) => (grammars.grammar(scopeName) as upstream.IRawGrammar | undefined) ?? null,
        getInjections: (scopeName) => grammars.injections(scopeName),
      })
      return {
        loadGrammar: async (scopeName) => (await registry.loadGrammar(scopeName)) as TextmateGrammar | null,
        setTheme: (theme) => registry.setTheme(theme as upstream.IRawTheme),
        getColorMap: () => registry.getColorMap(),
      }
    },
  }
}

function forkEngine(lib: OnigLib): TextmateEngine {
  return {
    identity: { textmate: pinLabel(PINS.shikiTextmate), ...ONIGURUMA_IDENTITY },
    createRegistry: (grammars) => {
      const registry = new fork.Registry({
        onigLib: lib as fork.IOnigLib,
        loadGrammar: (scopeName) => (grammars.grammar(scopeName) as fork.IRawGrammar | undefined) ?? null,
        getInjections: (scopeName) => grammars.injections(scopeName),
      })
      return {
        loadGrammar: async (scopeName) => registry.loadGrammar(scopeName) as TextmateGrammar | null,
        setTheme: (theme) => registry.setTheme(theme as fork.IRawTheme),
        getColorMap: () => registry.getColorMap(),
      }
    },
  }
}

export async function textmateEngine(id: EngineId): Promise<TextmateEngine> {
  const lib = await onigLib()
  return id === 'upstream' ? upstreamEngine(lib) : forkEngine(lib)
}

export { upstream as upstreamTextmate }
