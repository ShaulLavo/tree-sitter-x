import { ScopeHighlightSession } from './session.js';
import { ScopeTheme } from './theme.js';
import type { ThemeHost } from './theme.js';
import type { CompileThemeOptions, HighlightOptions, PackDefinition, ScopeResult, TreeSitterBinding, TreeSitterLanguage, TreeSitterTextBuffer, TreeSitterTree, VscodeThemeInput } from './types.js';
export declare class ScopePack {
    #private;
    readonly language: TreeSitterLanguage;
    readonly languageId: string;
    readonly rootScope: string;
    readonly scopeSuffix: string;
    readonly localInvalidation: boolean;
    readonly scopes: readonly string[];
    readonly patternCount: number;
    constructor(compat: ScopeCompat, pointer: number, language: TreeSitterLanguage, definition: PackDefinition, scopes: readonly string[], patternCount: number);
    get disposed(): boolean;
    /** @internal */
    ownedBy(compat: ScopeCompat): boolean;
    /** @internal */
    pointer(): number;
    dispose(): void;
}
export declare class ScopeCompat implements ThemeHost {
    #private;
    private constructor();
    static load(binding: TreeSitterBinding, wasm: WebAssembly.Module | BufferSource): Promise<ScopeCompat>;
    heap(): Uint8Array;
    call(name: string, args?: readonly number[]): unknown;
    number(name: string, args?: readonly number[]): number;
    liveAllocations(): number;
    withBytes<T>(bytes: Uint8Array, action: (pointer: number, length: number) => T): T;
    private withString;
    compilePack(language: TreeSitterLanguage, definition: PackDefinition): ScopePack;
    private assertPackCompiled;
    private assertThemeCompiled;
    compileTheme(input: VscodeThemeInput | readonly VscodeThemeInput[], options?: CompileThemeOptions): ScopeTheme;
    highlightTree(pack: ScopePack, tree: TreeSitterTree, buffer: TreeSitterTextBuffer, options?: HighlightOptions): ScopeResult;
    createSession(pack: ScopePack, languageId?: string): ScopeHighlightSession;
}
