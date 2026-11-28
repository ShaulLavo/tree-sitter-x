import type { ScopeCompat, ScopePack } from './runtime.js';
import type { ScopeTheme } from './theme.js';
import type { ResolveThemeOptions, ScopeLimits, ScopeResult, SessionChange, SessionInvalidation, StyledResult, TreeSitterTextBuffer, TreeSitterTree } from './types.js';
export declare class ScopeHighlightSession {
    #private;
    constructor(compat: ScopeCompat, pack: ScopePack, languageId: string);
    get current(): ScopeResult | undefined;
    get lastInvalidation(): SessionInvalidation | undefined;
    update(tree: TreeSitterTree, buffer: TreeSitterTextBuffer, change?: SessionChange, limits?: ScopeLimits): ScopeResult;
    resolveTheme(theme: ScopeTheme, options?: ResolveThemeOptions): StyledResult;
    reset(): void;
}
