export { FONT_STYLE_BOLD, FONT_STYLE_ITALIC, FONT_STYLE_STRIKETHROUGH, FONT_STYLE_UNDERLINE, ScopeCompatError, } from './types.js';
export type { CompileThemeOptions, FallbackHighlightOptions, HighlightOptions, PackDefinition, ResolveThemeOptions, ScopeCompatErrorReason, ScopeLimits, ScopeResult, ScopeWindow, SessionChange, SessionInvalidation, StyledResult, TextEdit, TreeSitterBinding, TreeSitterCapture, TreeSitterCaptureRange, TreeSitterLanguage, TreeSitterNode, TreeSitterQuery, TreeSitterQueryOptions, TreeSitterRange, TreeSitterTextBuffer, TreeSitterTree, VscodeThemeInput, VscodeTokenColor, VscodeTokenSettings, } from './types.js';
export { ScopeCompat, ScopePack } from './runtime.js';
export { ScopeTheme, buildThemePacket, parseColorRgba } from './theme.js';
export type { CompiledThemePacket } from './theme.js';
export { ScopeHighlightSession } from './session.js';
export { ZED_PLUS_CAPTURE_MAP, highlightTreeWithFallback, resolveZedPlusScopes, } from './fallback.js';
export { BUILTIN_PACKS, LANGUAGE_ALIASES, getBuiltinPack, resolveLanguageAlias, } from './packs.js';
export type { BuiltinPackMetadata } from './packs.js';
