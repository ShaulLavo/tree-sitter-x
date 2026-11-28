export { FONT_STYLE_BOLD, FONT_STYLE_ITALIC, FONT_STYLE_STRIKETHROUGH, FONT_STYLE_UNDERLINE, ScopeCompatError, } from './types.js';
export { ScopeCompat, ScopePack } from './runtime.js';
export { ScopeTheme, buildThemePacket, parseColorRgba } from './theme.js';
export { ScopeHighlightSession } from './session.js';
export { ZED_PLUS_CAPTURE_MAP, highlightTreeWithFallback, resolveZedPlusScopes, } from './fallback.js';
export { BUILTIN_PACKS, LANGUAGE_ALIASES, getBuiltinPack, resolveLanguageAlias, } from './packs.js';
