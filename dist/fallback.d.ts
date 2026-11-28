import type { FallbackHighlightOptions, ScopeResult, TreeSitterQuery, TreeSitterTree } from './types.ts';
/**
 * Universal Zed-plus Tree-sitter capture-to-TextMate scope stack map.
 * Covers standard Zed, Neovim, Helix, and upstream Tree-sitter highlights.scm captures
 * with longest-prefix dotted degradation (e.g. `keyword.control.async` -> `keyword.control`).
 */
export declare const ZED_PLUS_CAPTURE_MAP: Readonly<Record<string, readonly string[]>>;
export declare function resolveZedPlusScopes(captureName: string, scopeSuffix?: string): readonly string[];
export declare function highlightTreeWithFallback(query: TreeSitterQuery, tree: TreeSitterTree, source: string, options: FallbackHighlightOptions): ScopeResult;
